# TBC 偶尔丢交易原因分析

## 关键发现

根据代码分析，"偶尔丢一个交易"的根本原因是：**交易广播的随机性和限制导致的覆盖遗漏**

## 核心问题代码

### 1. 广播限制 - `FetchNInventory`

```cpp
void SendTxnInventory(const Config &config, const CNodePtr& pto, CConnman &connman, 
                      const CNetMsgMaker& msgMaker, std::vector<CInv>& vInv) {
    // 关键：每次只取有限数量的交易！
    std::vector<CTxnSendingDetails> vInvTx { 
        pto->FetchNInventory(GetInventoryBroadcastMax(config)) 
    };
    // ...
}
```

**问题**：如果内存池很大，新交易可能排不上队

### 2. 广播时机 - `fSendTrickle`

```cpp
void SendInventory(...) {
    // 检查是否应该发送
    bool fSendTrickle = pto->fWhitelisted;
    if (pto->nNextInvSend < nNow) {
        fSendTrickle = true;
        pto->nNextInvSend = nNow + Fixed_delay_microsecs; 
    }
    
    // 只有 fSendTrickle 为 true 时才广播交易
    if (fSendTrickle) {
        SendTxnInventory(config, pto, connman, msgMaker, vInv);
    }
}
```

**问题**：广播有固定间隔，如果交易在间隔内到达，可能延迟广播

### 3. 具体丢失场景

```
场景：高并发时偶尔丢交易

时间线：
T0: 内存池已有 10000 笔交易
T1: 新交易 X 到达节点 A
T2: A 将 X 加入内存池
T3: A 准备广播 INV

    问题 1: FetchNInventory 只取 1000 笔
    - 如果 X 排在 1001 位，本轮不广播
    - 等待下一轮...
    
T4: 下一轮广播前，高费率交易 Y 到达
T5: Y 排在 X 前面（按费率排序）
T6: X 被挤到 1001 位
T7: 下一轮广播，X 仍然没排上

    问题 2: 如果此时连接断开...
    T8: 节点 B 断开连接
    T9: X 从未广播给 B
    T10: 网络恢复，但 X 已不在广播队列前端
    
最终结果：X 只在节点 A 有，其他节点永远收不到
```

## 根本原因

### 1. 广播队列溢出

```cpp
// 假设配置
GetInventoryBroadcastMax(config) = 1000  // 每次最多广播 1000 笔
内存池大小 = 10000 笔
新交易到达速率 = 100 笔/秒

问题：
- 每秒产生 100 笔新交易
- 但每秒只能广播 1000 笔（所有节点合计）
- 如果网络延迟或节点多，某些交易可能延迟很久
- 如果延迟期间发生其他事件（如连接断开），交易丢失
```

### 2. 排序竞争

```cpp
// 内存池按祖先费率排序
indexed_transaction_set::index<ancestor_score>::type

// 新交易如果费率不够高，排在后面
// 高费率交易不断插队
// 低费率交易可能一直排不上队
```

### 3. 连接不稳定性

```cpp
// 广播是"尽力而为"
- 节点 A 广播 INV 给 B
- B 收到 INV，发送 GETDATA
- 网络抖动，GETDATA 丢失
- A 不重试
- 交易丢失
```

## 为什么"偶尔"丢

```
大部分时间：
- 内存池不大 (< 1000 笔)
- 所有交易都能排上队
- 广播正常

偶尔丢的情况：
- 网络拥堵，内存池突增
- 大量高费率交易涌入
- 新交易被挤到队列后面
- 广播窗口期内连接问题
- 特定交易错过广播窗口
```

## 解决方案

### 方案 1：增加广播限制

```conf
# bitcoin.conf
# 增加每次广播数量
maxinvbroadcast=5000

# 缩短广播间隔
invbroadcastinterval=100  # 毫秒
```

### 方案 2：优先广播新交易

```cpp
// 修改代码
void SendTxnInventory(...) {
    // 优先取新到达的交易
    std::vector<CTxnSendingDetails> vInvTx { 
        pto->FetchNInventory(GetInventoryBroadcastMax(config), 
                            true,  // 优先新交易
                            nLastBroadcastTime)  // 只取新于上次广播的
    };
}
```

### 方案 3：确保广播完成

```cpp
// 修改代码
void AddUnchecked(...) {
    // 交易加入内存池后，立即广播
    // 不等待定期广播窗口
    RelayTransactionImmediately(tx);
}
```

### 方案 4：重广播机制

```cpp
// 添加重广播
class CTxRebroadcaster {
    void CheckAndRebroadcast() {
        for (const auto& tx : mempool.GetUnconfirmed()) {
            if (tx.nTime + 60 < GetTime() && tx.nBroadcastCount < 3) {
                // 60 秒未确认，重广播
                RelayTransaction(tx);
                tx.nBroadcastCount++;
            }
        }
    }
};
```

## 当前缓解措施

### 对于用户

1. **提高费率**：确保交易排在前面
   ```bash
   # 使用高费率
   bitcoin-cli sendtoaddress <addr> <amount> "" "" true  # true = 使用高费率
   ```

2. **检查广播**：发送后检查多个节点
   ```bash
   # 检查节点 A
   node_a getmempoolentry <txid>
   
   # 检查节点 B
   node_b getmempoolentry <txid>
   
   # 如果 B 没有，手动广播
   rawtx=$(node_a getrawtransaction <txid>)
   node_b sendrawtransaction $rawtx
   ```

3. **等待确认**：不要假设交易一定成功
   - 等待 1-2 个确认
   - 如果长时间未确认，检查是否丢失

### 对于节点运营者

1. **监控内存池大小**：
   ```bash
   watch -n 1 'bitcoin-cli getmempoolinfo | grep size'
   ```

2. **监控广播队列**：
   ```bash
   tail -f ~/.bitcoin/debug.log | grep -E "(SendTxnInventory|FetchNInventory)"
   ```

3. **增加连接稳定性**：
   ```conf
   # 使用静态连接
   addnode=<trusted_node_1>
   addnode=<trusted_node_2>
   addnode=<trusted_node_3>
   ```

## 结论

偶尔丢交易的原因是：
1. **广播队列限制**：每次只能广播部分交易
2. **排序竞争**：高费率交易插队，低费率交易被挤到后面
3. **连接不稳定性**：广播窗口期内连接问题导致遗漏

这不是代码 bug，而是设计权衡。解决方案是：
- 提高交易费率
- 增加广播限制
- 添加重广播机制
