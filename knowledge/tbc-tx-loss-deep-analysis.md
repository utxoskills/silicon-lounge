# TBC 节点交易丢失深度分析 - 费率和内存池正常情况

## 问题背景

- 节点都在新加坡，网络联通正常
- 交易费率正常
- 内存池未满
- 但偶尔仍有交易丢失

## 深入代码发现的问题

### 1. 交易验证队列竞争

```cpp
// ProcessTxMessage
if (!IsTxnKnown(inv)) {
    // Forward transaction to the validator thread.
    connman.EnqueueTxnForValidator(
        std::make_shared<CTxInputData>(
            connman.GetTxIdTracker(),
            std::move(ptx),
            TxSource::p2p,
            TxValidationPriority::high,  // 高优先级
            GetTime(),
            true,           // fLimitFree
            Amount(0),      // nAbsurdFee
            pfrom));
} else {
    // 如果交易已知，只对白名单节点强制中继
    if (pfrom->fWhitelisted && fWhiteListForceRelay) {
        RelayTransaction(*ptx, connman);
    }
}
```

**问题 1：验证期间交易不可见**
```
时间线：
T1: 交易到达节点 A，进入验证队列
T2: 交易到达节点 B，进入验证队列
T3: 节点 A 验证完成，广播给 B
T4: 节点 B 发现交易已知（已在队列中），不广播
T5: 节点 B 验证失败（如双花），丢弃交易
T6: 节点 A 以为 B 已收到，实际 B 丢弃了
```

### 2. 交易 ID 追踪器的竞态条件

```cpp
// CTxIdTracker - 跟踪正在处理的交易
class CTxIdTracker {
    std::set<uint256> mTxIds;
    mutable std::mutex mMtx;
    
public:
    bool InsertTxId(const uint256& txid) {
        std::lock_guard<std::mutex> lock(mMtx);
        return mTxIds.insert(txid).second;  // 返回是否插入成功
    }
    
    void RemoveTxId(const uint256& txid) {
        std::lock_guard<std::mutex> lock(mMtx);
        mTxIds.erase(txid);
    }
    
    bool ContainsTxId(const uint256& txid) const {
        std::lock_guard<std::mutex> lock(mMtx);
        return mTxIds.count(txid) > 0;
    }
};

// IsTxnKnown 检查
bool IsTxnKnown(const CInv& inv) {
    // 检查内存池
    if (mempool.Exists(inv.hash)) return true;
    
    // 检查最近拒绝的交易
    if (recentRejects.Contains(inv.hash)) return true;
    
    // 检查正在处理的交易
    if (txIdTracker.ContainsTxId(inv.hash)) return true;
    
    return false;
}
```

**问题 2：追踪器移除时机**
```
场景：
1. 交易 X 到达节点 A
2. A 将 X 加入追踪器 (InsertTxId)
3. A 开始验证 X
4. B 广播 X 给 A
5. A 发现 X 在追踪器中，认为"已知"
6. A 验证 X 失败，从追踪器移除 (RemoveTxId)
7. B 以为 A 已收到 X，但 A 丢弃了 X
8. X 在网络中丢失
```

### 3. 验证失败后的处理不一致

```cpp
// validation.cpp: ProcessValidatedTxn
void ProcessValidatedTxn(...) {
    if (!state.IsValid()) {
        // 交易验证失败
        
        // 1. 记录到 recent rejects
        handlers.mpTxnRecentRejects->insert(tx.GetId());
        
        // 2. 如果是孤儿交易，添加到孤儿池
        if (state.IsMissingInputs()) {
            handlers.mpOrphanTxns->addTxn(txStatus.mTxInputData);
        }
        
        // 3. 从追踪器移除
        txIdTracker.RemoveTxId(tx.GetId());
        
        // ❌ 问题：不通知其他节点该交易已失败
        // ❌ 其他节点继续传播该交易
    }
}
```

**问题 3：失败交易不广播**
- 交易验证失败只记录本地
- 其他节点可能继续尝试广播该交易
- 导致交易在网络中"半死不活"

### 4. 内存池替换规则 (RBF)

```cpp
// txmempool.cpp
bool CTxMemPool::addUnchecked(...) {
    // 检查是否可替换
    if (mempool.Exists(txid)) {
        // 交易已存在，检查是否可替换
        const CTxMemPoolEntry& existing = mapTx.find(txid);
        
        // RBF 检查
        if (!existing.GetTx().IsOptInRBF()) {
            return false;  // 不可替换，直接返回
        }
        
        // 检查新交易费率是否足够高
        if (newFee < existing.GetFee() + minRelayFee) {
            return false;  // 费率不够，拒绝
        }
        
        // 替换旧交易
        RemoveRecursive(existing.GetTx());
    }
    
    // 添加新交易
    // ...
}
```

**问题 4：替换失败导致丢失**
```
场景：
1. 用户发送交易 X (费率 1000 sat/kB)
2. 交易 X 到达节点 A，进入内存池
3. 用户发送替换交易 X' (费率 1100 sat/kB)
4. X' 到达节点 B，替换成功
5. X' 到达节点 A，但 A 的 X 已被打包进区块
6. X' 被 A 拒绝（双花）
7. 节点 C 只收到 X'，没收到 X
8. X' 在 C 处被视为双花，丢弃
9. 如果 X 最终没被打包，交易丢失
```

### 5. 区块打包期间的竞态

```cpp
// mining/assembler.cpp
std::unique_ptr<CBlockTemplate> BlockAssembler::CreateNewBlock(...) {
    // 1. 获取当前内存池状态
    auto journal = mJournalBuilder->getCurrentJournal();
    
    // 2. 遍历交易
    for (auto it = lock.begin(); it != lock.end(); ++it) {
        const auto& entry = it.at();
        
        // 3. 检查交易是否仍然有效
        if (!it.valid()) continue;
        
        // 4. 添加到区块
        addTransaction(entry);
    }
    
    // 5. 返回区块模板
}
```

**问题 5：打包期间的并发修改**
```
场景：
1. 矿工开始打包区块
2. 遍历内存池中的交易 X
3. 此时 X 被另一个区块打包（网络延迟）
4. 矿工继续打包 X
5. 矿工区块广播后，X 成为双花
6. 其他节点丢弃 X
7. 如果矿工区块被孤立，X 丢失
```

### 6. 网络消息队列溢出

```cpp
// net.cpp
void CConnman::ThreadMessageHandler() {
    while (!flagInterruptMsgProc) {
        for (const CNodePtr& pnode : vNodesCopy) {
            // 接收消息
            bool fMoreNodeWork = GetNodeSignals().ProcessMessages(...);
            
            // 发送消息
            {
                LOCK(pnode->cs_sendProcessing);
                GetNodeSignals().SendMessages(...);
            }
        }
        
        // 100ms 处理一次
        condMsgProc.wait_until(lock, 
            std::chrono::steady_clock::now() + std::chrono::milliseconds(100));
    }
}
```

**问题 6：消息处理延迟**
```
场景：
1. 节点 A 同时收到大量交易（如 1000 笔）
2. 消息队列堆积
3. 处理线程每 100ms 处理一轮
4. 交易 X 在队列中等待
5. 节点 B 请求交易 X (GETDATA)
6. 节点 A 还未处理到 X，返回 NOTFOUND
7. B 认为 X 不存在，不再请求
8. X 丢失
```

### 7. INV 广播的随机性

```cpp
// SendInventory
if (fSendTrickle) {
    SendTxnInventory(config, pto, connman, msgMaker, vInv);
}

// SendTxnInventory
std::vector<CTxnSendingDetails> vInvTx { 
    pto->FetchNInventory(GetInventoryBroadcastMax(config)) 
};
```

**问题 7：广播限制导致遗漏**
```
场景：
1. 内存池有 10000 笔交易
2. 每次只广播 1000 笔 (GetInventoryBroadcastMax)
3. 新交易 X 排在第 1001 位
4. 本轮广播不包含 X
5. 下一轮广播前，连接断开
6. X 从未广播给该节点
```

### 8. 交易过期时间不一致

```cpp
// 内存池过期
static const unsigned int DEFAULT_MEMPOOL_EXPIRY = 336; // 14 天

// mapRelay 过期
vRelayExpiration.push_back(std::make_pair(nNow + 15 * 60 * 1000000, ret.first));
// 15 分钟！
```

**问题 8：过期时间不匹配**
```
场景：
1. 交易 X 到达节点 A，加入内存池 (14 天过期)
2. A 广播 INV 给 B
3. B 请求 X，但网络延迟
4. 15 分钟后，A 的 mapRelay 中 X 过期
5. B 终于发送 GETDATA
6. A 从 mapRelay 找不到 X
7. A 检查内存池，X 还在
8. 但 A 不响应 GETDATA（代码逻辑问题）
```

## 根本原因总结

### 核心问题：异步处理的竞态条件

```
┌─────────────────────────────────────────────────────────────┐
│                    交易生命周期                              │
├─────────────────────────────────────────────────────────────┤
│  接收 → 验证 → 内存池 → 广播 → 区块打包 → 确认              │
│    ↓      ↓       ↓       ↓       ↓                        │
│   队列   队列    锁竞争   限制    竞态                        │
│   延迟   延迟    条件    随机    条件                        │
└─────────────────────────────────────────────────────────────┘
```

### 新加坡节点场景分析

```
节点 A (新加坡)          节点 B (新加坡)          节点 C (新加坡)
     │                        │                        │
     │  1. 接收交易 X          │                        │
     │  2. 验证队列            │                        │
     │                        │                        │
     │───── INV (X) ─────────→│                        │
     │                        │  3. X 在验证队列中       │
     │                        │  4. 收到 A 的 INV        │
     │                        │  5. IsTxnKnown = true    │
     │                        │  6. 不广播给 C           │
     │                        │                        │
     │  7. 验证完成            │                        │
     │  8. 广播给 B (但 B 已知) │                        │
     │                        │  9. 验证失败 (双花?)     │
     │                        │  10. 丢弃 X              │
     │                        │                        │
     │                        │───── INV (X) ────────→  │
     │                        │                        │ 11. C 收到 INV
     │                        │                        │ 12. GETDATA
     │                        │  13. B 已丢弃 X          │
     │                        │  14. NOTFOUND            │
     │                        │←──── GETDATA ──────────│
     │                        │                        │
     │←──── GETDATA ──────────│                        │
     │  15. A 响应 X          │                        │
     │───── TX (X) ─────────→│                        │
     │                        │  16. B 已丢弃，忽略      │
     │                        │                        │
     │                        │                        │ 17. C 未收到 X
     │                        │                        │ 18. X 丢失！
```

## 解决方案

### 1. 增加验证队列同步

```cpp
// 建议修改
void ProcessTxMessage(...) {
    if (IsTxnKnown(inv)) {
        // 即使已知，如果是新节点发送的，更新来源
        if (!pfrom->fWhitelisted) {
            // 记录该节点也知道此交易
            AddPeerKnownTx(pfrom->GetId(), inv.hash);
        }
        return;
    }
    
    // 添加交易时立即广播（不等待验证完成）
    // 但标记为"未验证"
    RelayTransactionUnconfirmed(tx);
}
```

### 2. 增加交易重广播

```cpp
// 建议添加
class CTxRebroadcaster {
    void ScheduleRebroadcast(const uint256& txid, int64_t delay) {
        // 延迟重广播
        scheduler.schedule([this, txid]() {
            if (mempool.Exists(txid) && !IsConfirmed(txid)) {
                RelayTransaction(mempool.Get(txid));
            }
        }, delay);
    }
};
```

### 3. 增加内存池同步协议

```cpp
// 建议添加
void SyncMempoolWithPeer(CNode* pnode) {
    // 定期同步内存池差异
    std::vector<uint256> myTxids = mempool.GetTxids();
    
    // 请求对方内存池摘要
    pnode->PushMessage(NetMsgType::MEMPOOLHASHES, 
        CalculateMempoolHash(myTxids));
    
    // 对方响应差异
    // 请求缺失的交易
}
```

## 当前缓解措施

### 对于用户

1. **发送后检查**：
   ```bash
   # 检查交易是否在内存池
   bitcoin-cli getmempoolentry <txid>
   
   # 检查多个节点
   for node in node1 node2 node3; do
       $node getmempoolentry <txid>
   done
   ```

2. **等待确认**：
   - 至少等待 1 个确认
   - 大额交易等待 6 个确认

3. **手动重发**：
   ```bash
   # 如果丢失，从原始节点重发
   rawtx=$(bitcoin-cli getrawtransaction <txid>)
   bitcoin-cli sendrawtransaction $rawtx
   ```

### 对于节点运营者

1. **增加连接数**：
   ```bash
   maxconnections=125
   maxoutbound=8
   ```

2. **禁用过滤**：
   ```bash
   feefilter=0
   whitelistrelay=1
   ```

3. **增加日志**：
   ```bash
   debug=mempool
   debug=txnval
   debug=net
   ```

## 结论

交易丢失的根本原因是**异步处理的竞态条件**，而非网络问题。即使节点在同一机房、网络联通正常，代码层面的并发处理仍可能导致交易丢失。

这不是单一 bug，而是 P2P 网络设计的固有限制。关键交易应该：
1. 从多个节点确认传播
2. 等待链上确认
3. 必要时手动重发
