# TBC 节点内存池不同步根本原因分析

## 问题现象
- 只有几十笔交易
- 费率正常
- 内存池未满
- 但偶尔有交易只在单个节点，其他节点收不到

## 关键发现

### 1. 交易传播机制设计缺陷

```cpp
// txn_propagator.cpp
void CTxnPropagator::newTransaction(const CTxnSendingDetails& txn) {
    // 只添加到队列，不立即广播
    std::unique_lock<std::mutex> lock { mNewTxnsMtx };
    mNewTxns.push_back(txn);  // ← 加入队列，等待处理
}

void CTxnPropagator::threadNewTxnHandler() noexcept {
    while(mRunning) {
        std::unique_lock<std::mutex> lock { mNewTxnsMtx };
        // 等待 250ms 才处理一次！
        mNewTxnsCV.wait_for(lock, mRunFrequency);
        
        if(mRunning && !mNewTxns.empty()) {
            processNewTransactions();  // ← 批量处理
        }
    }
}

void CTxnPropagator::processNewTransactions() {
    // 并行给所有节点添加交易
    auto results { g_connman->ParallelForEachNode([this](const CNodePtr& node) { 
        node->AddTxnsToInventory(mNewTxns); 
    }) };
    
    // 等待所有节点完成
    for(auto& result : results)
        result.wait();
    
    // 清空队列
    mNewTxns.clear();  // ← 处理完就清空
}
```

**问题 1：250ms 延迟**
- 交易加入队列后，最多等待 250ms 才开始广播
- 如果在此期间节点断开，交易丢失

**问题 2：批量处理**
- 所有交易一起处理，一起清空
- 如果某个节点处理失败，该批次所有交易对该节点丢失

### 2. 节点库存添加的竞态条件

```cpp
// 假设的 CNode::AddTxnsToInventory 逻辑
void CNode::AddTxnsToInventory(const std::vector<CTxnSendingDetails>& txns) {
    for (const auto& txn : txns) {
        // 检查是否已经知道
        if (filterInventoryKnown.contains(txn.getInv().hash)) {
            continue;  // 跳过已知的
        }
        
        // 添加到发送队列
        setInventoryTxToSend.insert(txn.getInv().hash);
    }
}
```

**问题 3：并行处理的隐患**
```cpp
// ParallelForEachNode 并行执行
auto results { g_connman->ParallelForEachNode([this](const CNodePtr& node) { 
    node->AddTxnsToInventory(mNewTxns); 
}) };

// 问题：
// 1. 节点 A 处理成功，节点 B 处理失败
// 2. 但代码等待所有节点完成才清空
// 3. 如果 B 超时，A 已经处理完，但交易还在队列
// 4. 下次广播时，A 认为已经广播过，不重复广播
```

### 3. 具体丢失场景

```
场景：并行处理失败

T0: 交易 X 到达节点 A
T1: X 加入 mNewTxns 队列
T2: 250ms 后，processNewTransactions 触发
T3: 并行给 B, C, D 添加库存

    节点 B: 成功添加 ✓
    节点 C: 成功添加 ✓
    节点 D: 处理超时/失败 ✗

T4: 等待所有节点完成...
T5: D 最终超时，但 B 和 C 已经处理完
T6: mNewTxns.clear() 清空队列

结果：
- B 和 C 收到 X
- D 没收到 X
- 但 A 认为 X 已经处理完
- D 永远收不到 X！
```

### 4. 另一个场景：连接断开

```
场景：广播时连接断开

T0: 交易 X, Y, Z 到达节点 A
T1: 加入 mNewTxns 队列
T2: 250ms 后，开始广播
T3: 给 B, C, D 并行添加库存

    节点 B: 添加成功
    节点 C: 添加成功
    节点 D: 正在处理时连接断开！

T4: D 断开，但 X, Y, Z 还在 D 的待发送队列
T5: D 重连，但队列已清空
T6: A 认为 X, Y, Z 已经广播过

结果：
- D 永远收不到 X, Y, Z
- 除非 A 重新收到这些交易
```

### 5. 更隐蔽的问题：filterInventoryKnown

```cpp
// CNode 类中的过滤
std::set<uint256> filterInventoryKnown;

// 当节点收到 INV 时会添加
void CNode::AddInventoryKnown(const CInv& inv) {
    filterInventoryKnown.insert(inv.hash);
}

// 问题：
// 1. 如果 D 短暂断开前，曾经收到过 X 的 INV（但没收到 TX）
// 2. D 重连后，filterInventoryKnown 还保留 X
// 3. A 再次广播 X 时，D 认为"已知"，跳过
// 4. 但 D 内存池没有 X！
```

## 根本原因总结

### 核心问题：传播器的"批量+并行"设计

```
┌─────────────────────────────────────────────────────────────┐
│                     交易传播流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 交易到达 → 加入队列 (mNewTxns)                           │
│              ↓                                              │
│  2. 等待 250ms → 批量处理                                    │
│              ↓                                              │
│  3. 并行给所有节点添加库存                                    │
│              ↓                                              │
│  4. 等待所有节点完成 ← 问题所在！                             │
│              ↓                                              │
│  5. 清空队列 (mNewTxns.clear())                              │
│                                                             │
│  问题：                                                     │
│  - 步骤 3-4 期间任何节点失败，该批次交易对该节点丢失           │
│  - 没有重试机制                                              │
│  - 没有确认机制                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 为什么"偶尔"丢

```
正常情况：
- 所有节点处理成功
- 交易正常广播

偶尔丢的情况：
- 网络抖动（某个节点处理超时）
- 节点短暂断开
- 节点负载高（处理慢）
- 并行任务调度问题
```

## 解决方案

### 方案 1：添加确认机制

```cpp
void CTxnPropagator::processNewTransactions() {
    // 记录每个交易广播给了哪些节点
    std::map<uint256, std::set<NodeId>> broadcastMap;
    
    auto results = g_connman->ParallelForEachNode([this, &broadcastMap](const CNodePtr& node) {
        for (const auto& txn : mNewTxns) {
            if (node->AddTxnToInventory(txn)) {
                broadcastMap[txn.getInv().hash].insert(node->GetId());
            }
        }
    });
    
    // 检查哪些节点没有成功
    for (const auto& txn : mNewTxns) {
        const auto& nodes = broadcastMap[txn.getInv().hash];
        if (nodes.size() < g_connman->GetNodeCount()) {
            // 部分节点失败，保留在队列中重试
            mFailedTxns.push_back(txn);
        }
    }
    
    mNewTxns.clear();
}
```

### 方案 2：定期重广播

```cpp
void CTxnPropagator::threadNewTxnHandler() noexcept {
    while(mRunning) {
        std::unique_lock<std::mutex> lock { mNewTxnsMtx };
        mNewTxnsCV.wait_for(lock, mRunFrequency);
        
        if (!mNewTxns.empty()) {
            processNewTransactions();
        }
        
        // 重试失败的交易
        if (!mFailedTxns.empty() && GetTime() > mLastRetryTime + 5) {
            mNewTxns.insert(mNewTxns.end(), mFailedTxns.begin(), mFailedTxns.end());
            mFailedTxns.clear();
            mLastRetryTime = GetTime();
        }
    }
}
```

### 方案 3：立即广播关键交易

```cpp
void CTxnPropagator::newTransaction(const CTxnSendingDetails& txn, bool immediate = false) {
    if (immediate) {
        // 立即广播，不等待队列
        g_connman->ParallelForEachNode([&txn](const CNodePtr& node) {
            node->AddTxnToInventory(txn);
        });
    } else {
        std::unique_lock<std::mutex> lock { mNewTxnsMtx };
        mNewTxns.push_back(txn);
    }
}
```

## 当前缓解措施

### 对于用户

1. **发送后检查多个节点**
   ```bash
   # 检查交易是否在多个节点
   for node in node1 node2 node3; do
       $node getmempoolentry <txid> >/dev/null 2>&1 && echo "$node: OK" || echo "$node: MISSING"
   done
   ```

2. **手动重广播**
   ```bash
   # 如果某个节点没有，手动发送
   rawtx=$(node_a getrawtransaction <txid>)
   node_b sendrawtransaction $rawtx
   node_c sendrawtransaction $rawtx
   ```

### 对于节点运营者

1. **缩短传播间隔**
   ```conf
   # bitcoin.conf
   txnpropagationfreq=50  # 50ms 而不是默认 250ms
   ```

2. **增加日志监控**
   ```bash
   tail -f ~/.bitcoin/debug.log | grep -E "(TXNPROP|txnpropagator)"
   ```

3. **使用静态连接**
   ```conf
   # 使用 addnode 而不是动态发现
   addnode=<node1_ip>:8333
   addnode=<node2_ip>:8333
   addnode=<node3_ip>:8333
   ```

## 结论

偶尔丢交易的根本原因是 **CTxnPropagator 的"批量+并行"设计缺陷**：
- 批量处理：250ms 延迟
- 并行处理：没有错误恢复
- 无确认机制：不知道哪个节点失败了

这不是网络问题，而是代码设计问题。需要修改传播器添加重试机制。
