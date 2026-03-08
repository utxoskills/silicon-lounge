# TBC 节点代码学习 - 阶段六：挖矿与内存池

## 1. 挖矿接口

### 1.1 getblocktemplate (GBT)

```cpp
// getblocktemplate RPC 返回一个可挖矿的区块模板
static UniValue getblocktemplate(const Config &config,
                                 const JSONRPCRequest &request) {
    // 检查同步状态
    if (IsInitialBlockDownload())
        throw JSONRPCError(RPC_CLIENT_IN_INITIAL_DOWNLOAD, 
                          "Bitcoin is downloading blocks...");

    // 获取内存池
    LOCK2(cs_main, mempool.cs);
    
    // 创建新区块模板
    std::unique_ptr<CBlockTemplate> pblocktemplate(
        mining::g_miningFactory->GetAssembler()->CreateNewBlock(
            coinbaseScript, pindexPrev));
    
    if (!pblocktemplate.get())
        throw JSONRPCError(RPC_OUT_OF_MEMORY, "Out of memory");

    CBlock *pblock = &pblocktemplate->GetBlockRef();
    
    // 构建返回结果
    UniValue result(UniValue::VOBJ);
    result.push_back(Pair("version", pblock->nVersion));
    result.push_back(Pair("previousblockhash", pblock->hashPrevBlock.GetHex()));
    result.push_back(Pair("transactions", transactions));
    result.push_back(Pair("coinbaseaux", aux));
    result.push_back(Pair("coinbasevalue", (int64_t)pblock->vtx[0]->GetValueOut().GetSatoshis()));
    result.push_back(Pair("longpollid", chainActive.Tip()->GetBlockHash().GetHex() + i64tostr(nTransactionsUpdatedLast)));
    result.push_back(Pair("target", hashTarget.GetHex()));
    result.push_back(Pair("mintime", (int64_t)pindexPrev->GetMedianTimePast() + 1));
    result.push_back(Pair("mutable", aMutable));
    result.push_back(Pair("noncerange", "00000000ffffffff"));
    result.push_back(Pair("sigoplimit", (int64_t)maxBlockSigOps));
    result.push_back(Pair("sizelimit", (int64_t)maxBlockSize));
    result.push_back(Pair("curtime", pblock->GetBlockTime()));
    result.push_back(Pair("bits", strprintf("%08x", pblock->nBits)));
    result.push_back(Pair("height", (int64_t)(pindexPrev->nHeight + 1)));
    
    return result;
}
```

### 1.2 生成区块

```cpp
UniValue generateBlocks(const Config &config,
                        std::shared_ptr<CReserveScript> coinbaseScript,
                        int nGenerate, uint64_t nMaxTries, bool keepScript) {
    static const int nInnerLoopCount = 0x100000;
    int nHeightStart = 0;
    int nHeightEnd = 0;
    int nHeight = 0;

    {
        LOCK(cs_main);
        nHeightStart = chainActive.Height();
        nHeight = nHeightStart;
        nHeightEnd = nHeightStart + nGenerate;
    }

    unsigned int nExtraNonce = 0;
    UniValue blockHashes(UniValue::VARR);
    CBlockIndex* pindexPrev {nullptr};
    
    while (nHeight < nHeightEnd) {
        // 创建新区块模板
        std::unique_ptr<CBlockTemplate> pblocktemplate(
            mining::g_miningFactory->GetAssembler()->CreateNewBlock(
                coinbaseScript->reserveScript, pindexPrev));

        if (!pblocktemplate.get()) {
            throw JSONRPCError(RPC_INTERNAL_ERROR, "Couldn't create new block");
        }

        CBlockRef blockRef = pblocktemplate->GetBlockRef();
        CBlock *pblock = blockRef.get();
        
        // 递增 extra nonce（用于 Coinbase）
        IncrementExtraNonce(pblock, pindexPrev, nExtraNonce);

        // 挖矿循环
        while (nMaxTries > 0 && pblock->nNonce < nInnerLoopCount &&
               !CheckProofOfWork(pblock->GetHash(), pblock->nBits, config)) {
            ++pblock->nNonce;
            --nMaxTries;
        }

        if (nMaxTries == 0) break;
        if (pblock->nNonce == nInnerLoopCount) continue;

        // 处理新区块
        std::shared_ptr<const CBlock> shared_pblock =
            std::make_shared<const CBlock>(*pblock);

        if (!ProcessNewBlock(config, shared_pblock, true, nullptr)) {
            throw JSONRPCError(RPC_INTERNAL_ERROR,
                               "ProcessNewBlock, block not accepted");
        }
        
        ++nHeight;
        blockHashes.push_back(pblock->GetHash().GetHex());

        if (keepScript) {
            coinbaseScript->KeepScript();
        }
    }

    return blockHashes;
}
```

### 1.3 计算网络算力

```cpp
static UniValue GetNetworkHashPS(int lookup, int height) {
    CBlockIndex *pb = chainActive.Tip();

    if (height >= 0 && height < chainActive.Height()) {
        pb = chainActive[height];
    }

    if (pb == nullptr || !pb->nHeight) {
        return 0;
    }

    // 如果 lookup 为 -1，使用上次难度调整以来的区块
    if (lookup <= 0) {
        lookup = pb->nHeight %
                     Params().GetConsensus().DifficultyAdjustmentInterval() +
                 1;
    }

    // 如果 lookup 大于链长度，设为链长度
    if (lookup > pb->nHeight) {
        lookup = pb->nHeight;
    }

    CBlockIndex *pb0 = pb;
    int64_t minTime = pb0->GetBlockTime();
    int64_t maxTime = minTime;
    
    for (int i = 0; i < lookup; i++) {
        pb0 = pb0->pprev;
        int64_t time = pb0->GetBlockTime();
        minTime = std::min(time, minTime);
        maxTime = std::max(time, maxTime);
    }

    // 避免除零
    if (minTime == maxTime) {
        return 0;
    }

    // 计算工作量差值和时间差
    arith_uint256 workDiff = pb->nChainWork - pb0->nChainWork;
    int64_t timeDiff = maxTime - minTime;

    // 返回每秒哈希数
    return workDiff.getdouble() / timeDiff;
}
```

---

## 2. 区块组装器 (Block Assembler)

### 2.1 BlockAssembler 基类

```cpp
namespace mining {

// 区块模板
class CBlockTemplate {
private:
    CBlockRef mBlock { std::make_shared<CBlock>() };

public:
    CBlockRef GetBlockRef() const { return mBlock; }
    std::vector<Amount> vTxFees;           // 每笔交易的手续费
    std::vector<int64_t> vTxSigOpsCount;   // 每笔交易的签名操作数
};

// 区块组装器接口
class BlockAssembler {
public:
    BlockAssembler(const Config& config) : mConfig(config) {}
    virtual ~BlockAssembler() = default;

    // 创建新区块模板
    virtual std::unique_ptr<CBlockTemplate> CreateNewBlock(
        const CScript& scriptPubKeyIn, CBlockIndex*& pindexPrev) = 0;

    // 获取最大生成区块大小
    virtual uint64_t GetMaxGeneratedBlockSize() const = 0;

protected:
    uint64_t ComputeMaxGeneratedBlockSize(const CBlockIndex* pindexPrev) const {
        // 获取配置的最大区块大小
        uint64_t maxGeneratedBlockSize = mConfig.GetMaxBlockSize();
        
        // 限制为协议允许的最大值
        maxGeneratedBlockSize = std::min(maxGeneratedBlockSize, 
            static_cast<uint64_t>(MAX_BLOCK_SIZE));
        
        return maxGeneratedBlockSize;
    }

    // 填充区块头
    void FillBlockHeader(CBlockRef& block, const CBlockIndex* pindex, 
                        const CScript& scriptPubKeyIn) const {
        // 设置版本
        block->nVersion = ComputeBlockVersion(pindex, mConfig.GetChainParams().GetConsensus());
        
        // 设置前一区块哈希
        if (pindex == nullptr) {
            block->hashPrevBlock.SetNull();
        } else {
            block->hashPrevBlock = pindex->GetBlockHash();
        }
        
        // 设置时间戳
        block->nTime = std::max(pindex->GetMedianTimePast() + 1, GetAdjustedTime());
        
        // 设置难度目标
        block->nBits = GetNextWorkRequired(pindex, block.get(), mConfig);
        
        // 重置 nonce
        block->nNonce = 0;
    }

    const Config& mConfig;
    Amount mBlockFees {0};  // 区块总手续费
};

} // namespace mining
```

### 2.2 交易选择策略

```cpp
// 交易选择优先级计算
class CTxMemPoolEntry {
public:
    // 获取修改后的费率（包含祖先交易）
    Amount GetModifiedFee() const { return nModFeesWithAncestors; }
    
    // 获取包含祖先的大小
    size_t GetSizeWithAncestors() const { return nSizeWithAncestors; }
    
    // 计算祖先费率（用于排序）
    double GetAncestorFeeRate() const {
        return double(GetModifiedFee().GetSatoshis()) / GetSizeWithAncestors();
    }
    
    // 获取优先级（旧式，基于币龄）
    double GetPriority(unsigned int currentBlockHeight) const {
        // 优先级 = 输入币龄总和 / 交易大小
        double dResult = 0;
        for (const auto& coin : nCoinAge)
            dResult += coin.first.GetSatoshis() * 
                      (currentBlockHeight - coin.second);
        return dResult / GetTxSize();
    }
};

// 区块组装器选择交易
void BlockAssembler::addTransaction(const CTxMemPoolEntry& entry) {
    // 检查区块大小限制
    if (nBlockSize + entry.GetTxSize() > nMaxBlockSize)
        return;
    
    // 检查签名操作限制
    if (nBlockSigOps + entry.GetSigOpCount() > nMaxBlockSigOps)
        return;
    
    // 检查交易是否已过期（时间锁）
    if (!IsFinalTx(entry.GetTx(), nHeight, nLockTimeCutoff))
        return;
    
    // 检查祖先交易是否都已包含
    for (const auto& ancestor : entry.GetAncestors()) {
        if (!inBlock.count(ancestor))
            return;
    }
    
    // 添加到区块
    pblock->vtx.push_back(entry.GetSharedTx());
    nBlockSize += entry.GetTxSize();
    nBlockSigOps += entry.GetSigOpCount();
    nFees += entry.GetFee();
    inBlock.insert(entry.GetTxId());
}
```

---

## 3. 挖矿日志 (Journal)

### 3.1 CJournal 类

```cpp
namespace mining {

// 日志条目
class CJournalEntry {
public:
    const TxId& GetTxId() const { return mTxId; }
    CTransactionRef GetTx() const { return mTx; }
    Amount GetFee() const { return mFee; }
    size_t GetSize() const { return mSize; }
    
private:
    TxId mTxId;
    CTransactionRef mTx;
    Amount mFee;
    size_t mSize;
};

// 挖矿日志 - 跟踪内存池变化
class CJournal {
public:
    // 应用变更集
    void applyChanges(const CJournalChangeSet& changeSet);
    
    // 检查交易是否存在
    bool checkTxnExists(const TxId& txid) const;
    
    // 获取大小
    size_t size() const;
    
    // 获取最后无效化时间
    int64_t getLastInvalidatingTime() const { return mInvalidatingTime; }
    
    // 获取/设置是否当前最佳日志
    bool getCurrent() const { return mCurrent; }
    void setCurrent(bool current) { mCurrent = current; }

private:
    // 多索引容器：按交易ID唯一，按顺序可遍历
    using TransactionList = boost::multi_index_container<
        CJournalEntry,
        boost::multi_index::indexed_by<
            // 唯一交易ID索引
            boost::multi_index::ordered_unique<
                boost::multi_index::const_mem_fun<CJournalEntry, const TxId, &CJournalEntry::GetTxId>
            >,
            // 顺序索引（用于重放）
            boost::multi_index::sequenced<>
        >
    >;
    
    TransactionList mTransactions;
    std::atomic_int64_t mInvalidatingTime {0};
    std::atomic_bool mCurrent {true};
    mutable std::shared_mutex mMtx;
};

// 日志变更集
class CJournalChangeSet {
public:
    enum class Operation { ADD, REMOVE, REPLACE };
    
    void addOperation(Operation op, const CJournalEntry& entry);
    void apply(CJournal& journal) const;
};

// 日志构建器
class CJournalBuilder {
public:
    // 获取新的变更集
    CJournalChangeSetPtr getNewChangeSet(JournalUpdateReason updateReason);
    
    // 获取当前日志
    CJournalPtr getCurrentJournal() const;
    
    // 清空日志
    void clearJournal();

private:
    void applyChangeSet(const CJournalChangeSet& changeSet);
    
    mutable std::shared_mutex mMtx;
    CJournalPtr mJournal;
};

} // namespace mining
```

### 3.2 日志使用流程

```cpp
// 1. 内存池添加交易时创建变更集
void CTxMemPool::addUnchecked(...) {
    // 创建变更集
    auto changeSet = mJournalBuilder->getNewChangeSet(
        mining::JournalUpdateReason::NEW_TXN);
    
    // 添加交易到变更集
    changeSet->addOperation(
        mining::CJournalChangeSet::Operation::ADD,
        mining::CJournalEntry(tx, fee, size));
    
    // 应用变更
    changeSet->apply(*mJournalBuilder->getCurrentJournal());
}

// 2. 区块组装器读取日志构建区块
std::unique_ptr<CBlockTemplate> BlockAssembler::CreateNewBlock(...) {
    // 获取当前日志
    auto journal = mJournalBuilder->getCurrentJournal();
    mining::CJournal::ReadLock lock(journal);
    
    // 遍历日志中的交易
    for (auto it = lock.begin(); it != lock.end(); ++it) {
        const auto& entry = it.at();
        
        // 验证交易仍然有效
        if (!it.valid()) continue;
        
        // 添加到区块
        addTransaction(entry);
    }
}
```

---

## 4. 费率估算

### 4.1 费率过滤器

```cpp
// 费率过滤轮询器（用于隐私）
class FeeFilterRounder {
private:
    std::set<Amount> feeset;  // 预定义的费率桶
    FastRandomContext insecure_rand;

public:
    FeeFilterRounder(const CFeeRate &minIncrementalFee) {
        // 创建指数间隔的费率桶
        for (double bucket = 1000; bucket <= 1e7; bucket *= FEE_SPACING) {
            feeset.insert(Amount(static_cast<int64_t>(bucket)));
        }
    }

    // 将费率四舍五入到最近的桶（保护隐私）
    Amount round(const Amount currentMinFee) {
        auto it = feeset.lower_bound(currentMinFee);
        if (it == feeset.end()) return Amount(static_cast<int64_t>(1e7));
        
        // 随机选择向上或向下取整
        if (it != feeset.begin() && insecure_rand.rand32() % 2 == 0)
            --it;
        
        return *it;
    }
};

// 发送费率过滤器
void PushFeeFilter(CNode* pto, Amount feerate) {
    // 四舍五入费率以保护隐私
    Amount roundedFee = feeFilterRounder.round(feerate);
    pto->PushMessage(NetMsgType::FEEFILTER, roundedFee);
}
```

### 4.2 智能手续费估算

```cpp
// ⚠️ 修正：TBC 已移除 Bitcoin Core 的 estimateSmartFee RPC
// TBC 仅保留简单的内存池费率估算方法（非 RPC 暴露）
CFeeRate CTxMemPool::estimateFee() const {
    // 基于当前内存池状态返回简单费率估算
    // 无复杂的 CBlockPolicyEstimator 统计
    std::vector<Amount> fees;
    for (const auto& entry : mapTx) {
        fees.push_back(entry.GetFeeRate().GetFeePerK());
    }
    
    std::sort(fees.begin(), fees.end());
    
    // 根据紧急程度选择分位数
    size_t index = fees.size() * nBlocks / (nBlocks + 10);
    return CFeeRate(fees[index]);
}
```

---

## 5. 交易优先级

### 5.1 优先交易处理

```cpp
// 优先交易百分比（默认 5%）
static const int DEFAULT_BLOCK_PRIORITY_PERCENTAGE = 5;

// 检查是否允许免费交易
bool AllowFree(double dPriority) {
    // 优先级阈值（约 1 个 BTC 一天）
    static const double PRIORITY_THRESHOLD = 57 * COIN.GetSatoshis() * 144 / 250;
    return dPriority > PRIORITY_THRESHOLD;
}

// 计算交易优先级
double ComputePriority(const CTransaction &tx, 
                       const std::vector<uint32_t>& inputHeights,
                       int nBlockHeight) {
    double dResult = 0;
    
    for (size_t i = 0; i < tx.vin.size(); i++) {
        // 输入金额 * 确认数
        dResult += inputValues[i].GetSatoshis() * 
                  (nBlockHeight - inputHeights[i]);
    }
    
    return dResult / GetSerializeSize(tx, SER_NETWORK, PROTOCOL_VERSION);
}

// 优先交易空间预留
void BlockAssembler::addPriorityTxns() {
    // 预留区块空间的 5% 给高优先级交易
    uint64_t nBlockPrioritySize = nMaxBlockSize * 
        gArgs.GetArg("-blockprioritypercentage", DEFAULT_BLOCK_PRIORITY_PERCENTAGE) / 100;
    
    // 按优先级排序交易
    std::vector<const CTxMemPoolEntry*> vPriorityTxns;
    for (const auto& entry : mempool.mapTx) {
        if (entry.GetPriority(nHeight) > 0)
            vPriorityTxns.push_back(&entry);
    }
    
    std::sort(vPriorityTxns.begin(), vPriorityTxns.end(),
        [](const CTxMemPoolEntry* a, const CTxMemPoolEntry* b) {
            return a->GetPriority(nHeight) > b->GetPriority(nHeight);
        });
    
    // 添加优先交易
    for (const auto* entry : vPriorityTxns) {
        if (nBlockSize >= nBlockPrioritySize) break;
        addTransaction(*entry);
    }
}
```

---

## 6. 内存池管理

### 6.1 内存池限制

```cpp
// 默认内存池大小限制 (1000 MB = 1GB)
// 注意：TBC 已从 Bitcoin Core 的 300MB 增大到 1000MB
static const unsigned int DEFAULT_MAX_MEMPOOL_SIZE = 1000;

// 修剪内存池
std::vector<TxId> CTxMemPool::TrimToSize(size_t limit, ...) {
    std::vector<TxId> vRemovedTxIds;
    
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

// 过期交易清理
int CTxMemPool::Expire(int64_t time, ...) {
    int expired = 0;
    
    // 找到过期交易
    indexed_transaction_set::index<entry_time>::type::iterator it = 
        mapTx.get<entry_time>().begin();
    
    while (it != mapTx.get<entry_time>().end() && it->GetTime() < time) {
        RemoveRecursive(it->GetTx(), ...);
        ++expired;
        it = mapTx.get<entry_time>().begin();
    }
    
    return expired;
}
```

### 6.2 孤儿交易处理

```cpp
// 孤儿交易映射
std::map<TxId, COrphanTx> mapOrphanTransactions;
std::map<COutPoint, std::set<TxId>> mapOrphanTransactionsByPrev;

// 添加孤儿交易
bool AddOrphanTx(const CTransaction& tx, NodeId peer) {
    const TxId& hash = tx.GetId();
    
    // 检查大小限制
    if (mapOrphanTransactions.size() >= MAX_ORPHAN_TRANSACTIONS)
        return false;
    
    // 添加到孤儿池
    mapOrphanTransactions[hash] = COrphanTx(tx, peer);
    
    // 按前序输出索引
    for (const auto& txin : tx.vin) {
        mapOrphanTransactionsByPrev[txin.prevout].insert(hash);
    }
    
    return true;
}

// 处理孤儿交易（当父交易到达时）
void ProcessOrphanTx(CNode* pfrom, const CTransaction& tx) {
    std::set<TxId> setOrphanToProcess;
    
    // 查找依赖此交易的孤儿
    auto itByPrev = mapOrphanTransactionsByPrev.find(COutPoint(tx.GetId(), 0));
    if (itByPrev != mapOrphanTransactionsByPrev.end()) {
        for (const TxId& orphanHash : itByPrev->second) {
            setOrphanToProcess.insert(orphanHash);
        }
    }
    
    // 尝试处理孤儿交易
    for (const TxId& orphanHash : setOrphanToProcess) {
        auto it = mapOrphanTransactions.find(orphanHash);
        if (it == mapOrphanTransactions.end()) continue;
        
        const CTransaction& orphanTx = it->second.tx;
        
        // 验证并尝试接受
        if (AcceptToMemoryPool(orphanTx, ...)) {
            // 成功，从孤儿池移除
            EraseOrphanTx(orphanHash);
            
            // 递归处理依赖此交易的孤儿
            ProcessOrphanTx(pfrom, orphanTx);
        }
    }
}
```

---

## 7. 挖矿统计信息

### 7.1 getmininginfo RPC

```cpp
static UniValue getmininginfo(const Config &config,
                              const JSONRPCRequest &request) {
    LOCK(cs_main);

    UniValue obj(UniValue::VOBJ);
    obj.push_back(Pair("blocks", int(chainActive.Height())));
    obj.push_back(Pair("currentblocksize", uint64_t(nLastBlockSize)));
    obj.push_back(Pair("currentblocktx", uint64_t(nLastBlockTx)));
    obj.push_back(Pair("difficulty", double(GetDifficulty(chainActive.Tip()))));
    obj.push_back(Pair("blockprioritypercentage",
        uint8_t(gArgs.GetArg("-blockprioritypercentage",
                             DEFAULT_BLOCK_PRIORITY_PERCENTAGE))));
    obj.push_back(Pair("errors", GetWarnings("statusbar")));
    obj.push_back(Pair("networkhashps", getnetworkhashps(config, request)));
    obj.push_back(Pair("pooledtx", uint64_t(mempool.Size())));
    obj.push_back(Pair("chain", config.GetChainParams().NetworkIDString()));
    
    return obj;
}
```

---

## 学习总结

阶段六完成。至此，TBC 节点代码学习计划全部完成！

### 学习文档汇总

| 阶段 | 主题 | 文档 |
|------|------|------|
| 阶段一 | 核心数据结构与算法 | tbc-learning-phase1.md |
| 阶段二 | 共识机制 | tbc-learning-phase2.md |
| 阶段三 | 脚本与合约 | tbc-learning-phase3.md |
| 阶段四 | 网络与P2P | tbc-learning-phase4.md |
| 阶段五 | 存储与数据库 | tbc-learning-phase5.md |
| 阶段六 | 挖矿与内存池 | tbc-learning-phase6.md |

### 核心知识点总结

1. **数据结构与算法** - 序列化、安全内存、UTXO缓存
2. **共识机制** - 区块验证、分叉处理、检查点、时间锁
3. **脚本系统** - 执行引擎、P2PKH/P2SH、Genesis升级
4. **网络协议** - P2P消息、地址管理、DoS防护
5. **存储系统** - LevelDB、区块文件、Undo数据
6. **挖矿系统** - GBT、区块组装、费率估算
