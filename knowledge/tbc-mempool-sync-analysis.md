# TBC 节点内存池不同步问题分析

## 问题描述

新加坡节点之间网络联通正常，但偶尔出现交易丢失，表现为内存池不同步。

## 代码分析发现的问题

### 1. 交易广播机制缺陷

```cpp
// net/net_processing.cpp: SendTxnInventory
void SendTxnInventory(const Config &config, const CNodePtr& pto, CConnman &connman, 
                      const CNetMsgMaker& msgMaker, std::vector<CInv>& vInv) {
    // Get as many TX inventory msgs to send as we can for this peer
    std::vector<CTxnSendingDetails> vInvTx { pto->FetchNInventory(GetInventoryBroadcastMax(config)) };

    for(const CTxnSendingDetails& txn : vInvTx) {
        vInv.emplace_back(txn.getInv());
        
        // 如果消息太大，立即发送
        if (vInv.size() == pto->maxInvElements) {
            connman.PushMessage(pto, msgMaker.Make(NetMsgType::INV, vInv));
            vInv.clear();
        }

        // 添加到 relay map
        auto ret = mapRelay.insert(std::make_pair(std::move(txn.getInv().hash), std::move(txn.getTxnRef())));
        if(ret.second) {
            vRelayExpiration.push_back(std::make_pair(nNow + 15 * 60 * 1000000, ret.first));
        }
    }
}
```

**问题 1：广播限制**
- `FetchNInventory()` 每次只取有限数量的交易
- 如果内存池很大，新交易可能排队等待广播
- 如果节点在此期间断开，交易可能丢失

### 2. INV 消息处理竞争条件

```cpp
// ProcessTxMessage
static void ProcessTxMessage(const Config& config, const CNodePtr& pfrom, ...) {
    CTransactionRef ptx;
    vRecv >> ptx;
    const CTransaction &tx = *ptx;

    CInv inv(MSG_TX, tx.GetId());
    pfrom->AddInventoryKnown(inv);
    
    // 如果交易已知，直接返回
    if (IsTxnKnown(inv)) {
        // 白名单节点强制中继
        if (pfrom->fWhitelisted && fWhiteListForceRelay) {
            RelayTransaction(*ptx, connman);
        }
        return;
    }
    
    // 入队验证
    connman.EnqueueTxnForValidator(...);
}
```

**问题 2：验证队列竞争**
- 交易先入队验证，验证通过后才广播
- 如果验证失败或被拒绝，不会广播
- 验证期间交易在内存池中不可见

### 3. 内存池修剪机制

```cpp
// txmempool.cpp
std::vector<TxId> CTxMemPool::TrimToSize(size_t limit, ...) {
    // 按祖先费率排序（低到高）
    indexed_transaction_set::index<ancestor_score>::type::iterator it = 
        mapTx.get<ancestor_score>().begin();
    
    // 移除低费率交易直到满足大小限制
    while (DynamicMemoryUsage() > limit && it != mapTx.get<ancestor_score>().end()) {
        const TxId& txid = it->GetTxId();
        
        // 移除交易及其后代
        setEntries stage;
        CalculateDescendants(mapTx.project_to_me(it), stage);
        
        for (const txiter& removeIt : stage) {
            vRemovedTxIds.push_back(removeIt->GetTxId());
        }
        
        RemoveStaged(stage, ...);
        it = mapTx.get<ancestor_score>().begin();
    }
    
    return vRemovedTxIds;
}
```

**问题 3：修剪导致交易丢失**
- 内存池满时低费率交易被移除
- 被移除的交易不会通知其他节点
- 如果交易只在部分节点，可能全网丢失

### 4. 费率过滤不一致

```cpp
// ProcessMempoolMessage
static void ProcessMempoolMessage(const CNodePtr& pfrom, CDataStream& vRecv, CConnman& connman) {
    if(!(pfrom->GetLocalServices() & NODE_BLOOM) && !pfrom->fWhitelisted) {
        pfrom->fDisconnect = true;
        return;
    }

    LOCK(pfrom->cs_inventory);
    pfrom->fSendMempool = true;
}

// SendInventory
if (fSendTrickle && pto->fSendMempool) {
    auto vtxinfo = mempool.InfoAll();
    pto->fSendMempool = false;
    
    for (const auto &txinfo : vtxinfo) {
        // 费率过滤
        if (filterrate != Amount(0)) {
            if (txinfo.feeRate.GetFeePerK() < filterrate) {
                continue;  // 跳过低费率交易
            }
        }
        
        // Bloom 过滤
        if (!pto->mFilter.IsRelevantAndUpdate(*txinfo.tx)) {
            continue;  // 跳过不相关交易
        }
    }
}
```

**问题 4：过滤不一致**
- 不同节点的费率过滤器可能不同
- Bloom 过滤器导致交易被过滤
- 内存池请求可能被拒绝

### 5. 交易验证失败处理

```cpp
// validation.cpp: ProcessValidatedTxn
void ProcessValidatedTxn(...) {
    if (!state.IsValid()) {
        // 交易验证失败
        if (TxSource::p2p == source) {
            const bool fOrphanTxn = txStatus.mTxInputData->IsOrphanTxn();
            if (fOrphanTxn) {
                HandleInvalidP2POrphanTxn(txStatus, handlers);
            } else {
                HandleInvalidP2PNonOrphanTxn(txStatus, handlers);
            }
        }
        
        // 记录到 recent rejects
        handlers.mpTxnRecentRejects->insert(tx.GetId());
    }
}
```

**问题 5：验证失败不传播**
- 交易验证失败只记录本地
- 其他节点可能继续尝试广播该交易
- 导致交易在网络中"半死不活"

## 根本原因总结

### 主要原因：交易广播的"最佳努力"特性

```
交易广播流程：
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 创建交易 │───→│ 本地验证 │───→│ 广播INV │───→│ 等待GETDATA│
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     ↑              │              │              │
     │              ↓              ↓              ↓
     │         验证失败?      连接断开?      节点不响应?
     │              │              │              │
     │              ↓              ↓              ↓
     └──────── 交易丢失 ←─────────┴──────────────┘
```

### 具体场景

**场景 1：广播时连接断开**
```
时间线：
T1: 节点 A 收到交易
T2: 节点 A 开始广播给 B, C, D
T3: 节点 C 断开连接（广播未完成）
T4: 交易到达 B, D，但未到达 C
T5: 网络恢复，C 永远收不到该交易
```

**场景 2：内存池修剪**
```
时间线：
T1: 节点 A 内存池满，修剪低费率交易 X
T2: 交易 X 被从 A 的内存池移除
T3: 节点 B 向 A 请求交易 X
T4: A 返回 NOTFOUND
T5: B 也修剪交易 X
T6: 交易 X 全网丢失
```

**场景 3：费率过滤**
```
时间线：
T1: 节点 A 设置高费率过滤器 (1000 sat/kB)
T2: 交易 X (500 sat/kB) 到达 A
T3: A 拒绝接收交易 X
T4: 交易 X 在其他节点传播
T5: 网络分区，A 和 B 分开
T6: 分区恢复，A 永远收不到 X
```

## 解决方案建议

### 1. 增加重广播机制

```cpp
// 建议添加
class CTxRebroadcast {
    // 定期重广播未确认交易
    void RebroadcastUnconfirmed() {
        for (const auto& tx : wallet.GetUnconfirmed()) {
            if (tx.GetTime() + REBROADCAST_INTERVAL < GetTime()) {
                RelayTransaction(tx);
            }
        }
    }
};
```

### 2. 内存池同步改进

```cpp
// 建议添加
void SyncMempoolWithPeer(CNode* pnode) {
    // 定期同步内存池差异
    std::vector<TxId> myTxids = mempool.GetTxids();
    std::vector<TxId> peerTxids = GetPeerTxids(pnode);
    
    // 找出差异并请求
    std::vector<TxId> missing = Diff(myTxids, peerTxids);
    RequestTransactions(pnode, missing);
}
```

### 3. 交易持久化

```cpp
// 建议添加
class CPendingTxStore {
    // 持久化未广播成功的交易
    void StorePending(const CTransaction& tx) {
        db.Write(tx.GetId(), tx);
    }
    
    void RetryPending() {
        for (const auto& tx : db.GetAll()) {
            if (!mempool.Exists(tx.GetId())) {
                RelayTransaction(tx);
            }
        }
    }
};
```

## 当前缓解措施

### 对于用户

1. **等待确认**：发送后等待 1-2 个区块确认
2. **检查内存池**：使用 `getmempoolentry` 检查交易是否存在
3. **手动重发**：如果丢失，使用 `sendrawtransaction` 重发
4. **提高费率**：使用较高费率避免被修剪

### 对于节点运营者

1. **增加连接数**：`maxconnections=125`
2. **禁用费率过滤**：`feefilter=0`
3. **增加内存池大小**：`maxmempool=500`
4. **监控日志**：检查 `mempoolrej` 和 `txnval` 日志

## 结论

交易丢失的根本原因是比特币 P2P 网络的"最佳努力"广播机制，加上 TBC 可能存在的：
- 节点数量较少
- 内存池策略较严格
- 缺乏交易重广播机制

这不是代码 bug，而是设计权衡。关键交易应该：
1. 使用足够高的费率
2. 发送后主动确认
3. 必要时手动重发
