# TBC 节点代码学习 - 阶段二：共识机制

## 1. 区块验证完整流程

### 1.1 区块验证状态机

```cpp
enum class BlockValidity : uint32_t {
    UNKNOWN = 0,        // 未知状态
    HEADER = 1,         // 区块头验证通过
    TREE = 2,           // 连接到主链
    TRANSACTIONS = 3,   // 交易验证通过
    CHAIN = 4,          // 输入输出验证通过
    SCRIPTS = 5,        // 脚本签名验证通过
};
```

### 1.2 区块验证主流程

```cpp
// 1. 检查区块头
bool CheckBlockHeader(const CBlockHeader& block, CValidationState& state, 
                      const Consensus::Params& consensusParams) {
    // 检查工作量证明
    if (!CheckProofOfWork(block.GetHash(), block.nBits, consensusParams))
        return state.DoS(50, false, REJECT_INVALID, "high-hash");
    
    return true;
}

// 2. 检查区块内容
bool CheckBlock(const CBlock& block, CValidationState& state, 
                const Config& config, bool fCheckPOW = true) {
    // 检查区块大小
    if (block.GetSerializeSize(SER_NETWORK, PROTOCOL_VERSION) > maxBlockSize)
        return state.DoS(100, false, REJECT_INVALID, "bad-blk-length");
    
    // 检查交易数量
    if (block.vtx.empty() || block.vtx.size() > maxTxCount)
        return state.DoS(100, false, REJECT_INVALID, "bad-blk-txns");
    
    // 检查第一个交易是Coinbase
    if (!block.vtx[0]->IsCoinBase())
        return state.DoS(100, false, REJECT_INVALID, "bad-cb-missing");
    
    // 检查其他交易不是Coinbase
    for (size_t i = 1; i < block.vtx.size(); i++) {
        if (block.vtx[i]->IsCoinBase())
            return state.DoS(100, false, REJECT_INVALID, "bad-cb-multiple");
    }
    
    // 检查Merkle根
    bool mutated;
    uint256 hashMerkleRoot2 = BlockMerkleRoot(block, &mutated);
    if (block.hashMerkleRoot != hashMerkleRoot2)
        return state.DoS(100, false, REJECT_INVALID, "bad-txnmrklroot");
    
    // 检查是否有重复交易（CVE-2012-2459）
    if (mutated)
        return state.DoS(100, false, REJECT_INVALID, "bad-txns-duplicate");
    
    return true;
}

// 3. 上下文验证（需要父区块）
bool ContextualCheckBlock(const CBlock& block, CValidationState& state, 
                          const Config& config, CBlockIndex* pindexPrev) {
    const int nHeight = pindexPrev->nHeight + 1;
    
    // 检查时间戳
    if (block.GetBlockTime() <= pindexPrev->GetMedianTimePast())
        return state.Invalid(false, REJECT_INVALID, "time-too-old");
    
    // 检查未来时间戳
    if (block.GetBlockTime() > nAdjustedTime + MAX_FUTURE_BLOCK_TIME)
        return state.Invalid(false, REJECT_INVALID, "time-too-new");
    
    // 检查难度目标
    if (block.nBits != GetNextWorkRequired(pindexPrev, &block, config))
        return state.DoS(100, false, REJECT_INVALID, "bad-diffbits");
    
    // 检查Coinbase高度（BIP34）
    if (block.nVersion >= 2) {
        // Coinbase脚本必须以区块高度开头
        CScript expect = CScript() << nHeight;
        if (block.vtx[0]->vin[0].scriptSig.size() < expect.size() ||
            !std::equal(expect.begin(), expect.end(), 
                       block.vtx[0]->vin[0].scriptSig.begin())) {
            return state.DoS(100, false, REJECT_INVALID, "bad-cb-height");
        }
    }
    
    return true;
}

// 4. 连接区块到链
bool ConnectBlock(const CBlock& block, CValidationState& state, 
                  CBlockIndex* pindex, CCoinsViewCache& view) {
    // 检查区块是否已连接
    assert(pindex->GetBlockHash() == block.GetHash());
    
    // 获取区块高度
    int nHeight = pindex->nHeight;
    
    // 创建区块的UTXO视图快照
    CCoinsViewCache viewNew(&view);  // 在临时视图上操作
    
    // 验证并执行所有交易
    Amount nFees = Amount(0);
    for (size_t i = 0; i < block.vtx.size(); i++) {
        const CTransaction &tx = *(block.vtx[i]);
        
        // 检查交易输入
        if (!CheckTxInputs(tx, state, viewNew, nHeight))
            return false;
        
        // 执行脚本验证
        if (!CheckInputs(tx, state, viewNew, fScriptChecks, flags))
            return false;
        
        // 更新UTXO集
        UpdateCoins(tx, viewNew, nHeight);
        
        // 累加手续费
        if (!tx.IsCoinBase())
            nFees += viewNew.GetValueIn(tx) - tx.GetValueOut();
    }
    
    // 验证Coinbase奖励
    Amount nCoinbaseReward = block.vtx[0]->GetValueOut() - nFees;
    if (nCoinbaseReward > GetBlockSubsidy(nHeight) + nFees)
        return state.DoS(100, false, REJECT_INVALID, "bad-cb-amount");
    
    // 提交UTXO更改
    viewNew.Flush();
    
    return true;
}
```

### 1.3 激活最佳链

```cpp
bool ActivateBestChain(CValidationState& state, const Config& config, 
                       std::shared_ptr<const CBlock> pblock) {
    CBlockIndex *pindexMostWork = nullptr;
    
    do {
        // 查找工作量最大的区块
        pindexMostWork = FindMostWorkChain();
        
        // 如果已经是当前链，直接返回
        if (pindexMostWork == chainActive.Tip())
            break;
        
        // 激活该链
        if (!ActivateBestChainStep(state, config, pindexMostWork, pblock))
            return false;
        
    } while (pindexMostWork != chainActive.Tip());
    
    return true;
}

bool ActivateBestChainStep(CValidationState& state, const Config& config,
                           CBlockIndex* pindexMostWork, 
                           const std::shared_ptr<const CBlock>& pblock) {
    // 找到分叉点
    CBlockIndex *pindexFork = chainActive.FindFork(pindexMostWork);
    
    // 断开当前链（如果需要重组）
    if (pindexFork != pindexMostWork->pprev) {
        // 发生链重组
        if (!DisconnectTip(state, config, pindexFork))
            return false;
    }
    
    // 连接新区块
    if (!ConnectTip(state, config, pindexMostWork, pblock))
        return false;
    
    return true;
}
```

---

## 2. 分叉处理和链重组

### 2.1 链重组流程

```cpp
bool DisconnectTip(CValidationState& state, const Config& config,
                   CBlockIndex* pindexNewTip) {
    CBlockIndex *pindexOldTip = chainActive.Tip();
    
    // 断开区块直到到达新的分叉点
    while (chainActive.Tip() != pindexNewTip) {
        CBlockIndex *pindexDelete = chainActive.Tip();
        
        // 读取区块
        CBlock block;
        if (!ReadBlockFromDisk(block, pindexDelete, config))
            return false;
        
        // 回滚区块（反向执行交易）
        if (!DisconnectBlock(block, pindexDelete, view))
            return false;
        
        // 从活跃链移除
        chainActive.SetTip(pindexDelete->pprev);
    }
    
    return true;
}

bool DisconnectBlock(const CBlock& block, CBlockIndex* pindex, 
                     CCoinsViewCache& view) {
    // 反向遍历交易（除了Coinbase）
    for (int i = block.vtx.size() - 1; i >= 0; i--) {
        const CTransaction &tx = *(block.vtx[i]);
        
        // 恢复输入（将UTXO标记为未花费）
        if (!tx.IsCoinBase()) {
            for (const CTxIn &txin : tx.vin) {
                view.SpendCoin(txin.prevout, &coin);  // 实际上是恢复
            }
        }
        
        // 删除输出（从UTXO集移除）
        for (size_t j = 0; j < tx.vout.size(); j++) {
            view.SpendCoin(COutPoint(tx.GetId(), j));
        }
    }
    
    return true;
}
```

### 2.2 最长链规则

```cpp
// 计算链工作量
arith_uint256 CBlockIndex::GetBlockWork() const {
    arith_uint256 bnTarget;
    bnTarget.SetCompact(nBits);
    // 工作量 = 2^256 / (目标值 + 1)
    return (arith_uint256(1) << 256) / (bnTarget + 1);
}

// 累计工作量
void CBlockIndex::BuildAccumulatedWork() {
    if (pprev) {
        nChainWork = pprev->nChainWork + GetBlockWork();
    } else {
        nChainWork = GetBlockWork();
    }
}

// 选择最佳链
CBlockIndex* FindMostWorkChain() {
    CBlockIndex *pindexBest = nullptr;
    arith_uint256 bnBestWork = 0;
    
    // 遍历所有候选区块
    for (CBlockIndex* pindex : setBlockIndexCandidates) {
        if (pindex->nChainWork > bnBestWork) {
            bnBestWork = pindex->nChainWork;
            pindexBest = pindex;
        }
    }
    
    return pindexBest;
}
```

---

## 3. 检查点机制

### 3.1 检查点定义

```cpp
// chainparams.cpp
class CMainParams : public CChainParams {
public:
    CMainParams() {
        // ...
        checkpointData = { {
            {11111, uint256S("0000000069e244f73d78e8fd29ba2fd2ed618bd6fa2ee"
                             "92559f542fdb26e7c1d")},
            {33333, uint256S("000000002dd5588a74784eaa7ab0507a18ad16a236e7b"
                             "1ce69f00d7ddfb5d0a6")},
            {74000, uint256S("0000000000573993a3c9e41ce34471c079dcf5f52a0e8"
                             "24a81e7f953b8661a20")},
            // ... 更多检查点
        }};
    }
};
```

### 3.2 检查点验证

```cpp
// checkpoints.cpp
namespace Checkpoints {

// 验证区块是否匹配检查点
bool CheckBlock(const CCheckpointData &data, int nHeight, const uint256 &hash) {
    const MapCheckpoints &checkpoints = data.mapCheckpoints;
    
    MapCheckpoints::const_iterator i = checkpoints.find(nHeight);
    if (i == checkpoints.end()) {
        return true;  // 该高度没有检查点
    }
    
    // 检查哈希是否匹配
    return hash == i->second;
}

// 获取最后一个已知检查点
CBlockIndex *GetLastCheckpoint(const CCheckpointData &data) {
    const MapCheckpoints &checkpoints = data.mapCheckpoints;
    
    // 从后往前遍历，找到第一个在mapBlockIndex中的检查点
    for (const MapCheckpoints::value_type &i : boost::adaptors::reverse(checkpoints)) {
        const uint256 &hash = i.second;
        BlockMap::const_iterator t = mapBlockIndex.find(hash);
        if (t != mapBlockIndex.end()) {
            return t->second;
        }
    }
    
    return nullptr;
}

} // namespace Checkpoints
```

### 3.3 检查点的作用

1. **防止深度重组攻击**: 检查点之前的区块被视为最终确认
2. **加速同步**: 跳过早期区块的完整验证
3. **防止分叉**: 强制使用特定的链历史

---

## 4. 时间锁实现

### 4.1 BIP65 - OP_CHECKLOCKTIMEVERIFY

```cpp
// 检查绝对时间锁
bool CheckLockTime(const CScriptNum &nLockTime) const {
    // 比较类型必须匹配（区块高度 vs 时间戳）
    if (!((txTo->nLockTime < LOCKTIME_THRESHOLD &&	nLockTime < LOCKTIME_THRESHOLD) ||
          (txTo->nLockTime >= LOCKTIME_THRESHOLD && nLockTime >= LOCKTIME_THRESHOLD)))
        return false;
    
    // 检查序列号是否启用时间锁
    if (txTo->vin[nIn].nSequence == CTxIn::SEQUENCE_FINAL)
        return false;
    
    // 检查锁定时间是否已满足
    if (nLockTime > (int64_t)txTo->nLockTime)
        return false;
    
    return true;
}
```

### 4.2 BIP68 - 相对时间锁（基于序列号）

```cpp
// 序列号标志
static const uint32_t SEQUENCE_LOCKTIME_DISABLE_FLAG = (1 << 31);  // 禁用相对时间锁
static const uint32_t SEQUENCE_LOCKTIME_TYPE_FLAG = (1 << 22);      // 时间单位标志
static const uint32_t SEQUENCE_LOCKTIME_MASK = 0x0000ffff;           // 值掩码
static const int SEQUENCE_LOCKTIME_GRANULARITY = 9;                  // 时间粒度（512秒）

// 计算序列锁
std::pair<int, int64_t> CalculateSequenceLocks(
    const CTransaction &tx, int flags,
    std::vector<int> *prevHeights,
    const CBlockIndex &block) {
    
    int nMinHeight = -1;
    int64_t nMinTime = -1;
    
    // 只有交易版本 >= 2 支持 BIP68
    bool fEnforceBIP68 = static_cast<uint32_t>(tx.nVersion) >= 2 &&
                         flags & LOCKTIME_VERIFY_SEQUENCE;
    
    if (!fEnforceBIP68) {
        return std::make_pair(nMinHeight, nMinTime);
    }
    
    for (size_t i = 0; i < tx.vin.size(); i++) {
        const CTxIn &txin = tx.vin[i];
        
        // 禁用标志设置时跳过
        if (txin.nSequence & CTxIn::SEQUENCE_LOCKTIME_DISABLE_FLAG)
            continue;
        
        int nCoinHeight = (*prevHeights)[i];
        
        if (txin.nSequence & CTxIn::SEQUENCE_LOCKTIME_TYPE_FLAG) {
            // 基于时间的相对锁
            int64_t nCoinTime = block.GetAncestor(std::max(nCoinHeight - 1, 0))
                                    ->GetMedianTimePast();
            int64_t nLockTime = (txin.nSequence & SEQUENCE_LOCKTIME_MASK) 
                                << SEQUENCE_LOCKTIME_GRANULARITY;
            nMinTime = std::max(nMinTime, nCoinTime + nLockTime - 1);
        } else {
            // 基于区块高度的相对锁
            int nLockHeight = txin.nSequence & SEQUENCE_LOCKTIME_MASK;
            nMinHeight = std::max(nMinHeight, nCoinHeight + nLockHeight - 1);
        }
    }
    
    return std::make_pair(nMinHeight, nMinTime);
}

// 评估序列锁
bool EvaluateSequenceLocks(const CBlockIndex &block,
                          std::pair<int, int64_t> lockPair) {
    assert(block.pprev);
    int64_t nBlockTime = block.pprev->GetMedianTimePast();
    
    // 检查是否满足锁定条件
    if (lockPair.first >= block.nHeight || lockPair.second >= nBlockTime)
        return false;
    
    return true;
}
```

### 4.3 BIP112 - OP_CHECKSEQUENCEVERIFY

```cpp
// 检查相对时间锁（脚本操作码）
bool CheckSequence(const CScriptNum &nSequence) const {
    // 比较类型必须匹配
    int64_t txToSequence = (int64_t)txTo->vin[nIn].nSequence;
    
    if (txTo->nVersion < 2)
        return false;
    
    if (txToSequence & CTxIn::SEQUENCE_LOCKTIME_DISABLE_FLAG)
        return false;
    
    // 比较序列号
    if (!((txToSequence < CTxIn::SEQUENCE_LOCKTIME_TYPE_FLAG &&
           nSequence < CTxIn::SEQUENCE_LOCKTIME_TYPE_FLAG) ||
          (txToSequence >= CTxIn::SEQUENCE_LOCKTIME_TYPE_FLAG &&
           nSequence >= CTxIn::SEQUENCE_LOCKTIME_TYPE_FLAG)))
        return false;
    
    if ((nSequence & CTxIn::SEQUENCE_LOCKTIME_MASK) >
        (txToSequence & CTxIn::SEQUENCE_LOCKTIME_MASK))
        return false;
    
    return true;
}
```

---

## 5. TBC 特有共识规则

### 5.1 TBC 分叉高度

```cpp
// TBC 主网激活高度
#define GENESIS_ACTIVATION_MAIN 620538

// TBC 第一个区块高度
consensus.TBCFirstBlockHeight = 824190;
consensus.TBCFirstBlockHash = uint256S(
    "0000000058968601042df9b0d57e41b092c76d6f91f333dc231cdd4cc4fd861d");

// 检查是否启用 Genesis
bool IsGenesisEnabled(const Config& config, int nHeight) {
    return (uint64_t)nHeight >= config.GetGenesisActivationHeight();
}
```

### 5.2 KYC 矿工验证

```cpp
// KYC 激活高度
int kycV1ActivationHeight = 824189;
int kycV2ActivationHeight = 927000;

// 验证矿工账单 V2
bool FilledMinerBillV2(const CTransaction& tx, const uint256& tipBlockHash) {
    // 解析输出脚本
    const CScript &chargeOutputScript = tx.vout[0].scriptPubKey;
    
    // 提取 KYC 权限高度
    std::vector<uint8_t> kycPermissionHeightVec;
    // ... 解析脚本
    
    // 检查权限是否有效
    if (kycPermissionHeight < currentChainHeight) {
        LogPrintf("KYC permission Height is less than current chain height !!!\n");
        return false;
    }
    
    // 验证矿工签名
    uint256 msgHashMiner = Hash(msgMiner.begin(), msgMiner.end());
    if (!pubkeyMiner.VerifySchnorr(msgHashMiner, sigMinerVec)) {
        LogPrintf("Miner signature verification failed !!!\n");
        return false;
    }
    
    // 验证管理者签名
    bool ret = false;
    for (auto pubkeyManager : pubkeyManagerArr) {
        if (pubkeyManager.VerifySchnorr(msgHashManager, sigManagerVec)) {
            ret = true;
            break;
        }
    }
    
    return ret;
}

// Coinbase 检查
bool CheckCoinbase(const CTransaction& tx, CValidationState& state, ...) {
    // 检查交易版本
    if (scriptSigHeight >= kycV1ActivationHeight && tx.nVersion != 10) {
        return state.Invalid(false, 0, "", "bad-cbtx-nVersion");
    }
    
    // KYC 验证
    if (chainActive.Height() >= kycV1ActivationTipHeight) {
        if (scriptSigHeight >= kycV2ActivationHeight) {
            if (!FilledMinerBillV2(tx, prevBlockHash)) {
                return state.DoS(100, false, REJECT_INVALID, "bad-miner-bill-v2");
            }
        } else {
            if (!FilledMinerBill(tx)) {
                return state.DoS(100, false, REJECT_INVALID, "bad-miner-bill");
            }
        }
    }
    
    return true;
}
```

### 5.3 Genesis 升级规则

```cpp
// Genesis 升级后移除的限制
bool CheckRegularTransaction(const CTransaction &tx, ...) {
    // ...
    
    if (isGenesisEnabled) {
        // Genesis 后禁止 P2SH 输出
        bool hasP2SHOutput = std::any_of(tx.vout.begin(), tx.vout.end(), 
            [](const CTxOut& o){ 
                return IsP2SH(o.scriptPubKey); 
            });
        
        if(hasP2SHOutput) {
            return state.DoS(100, false, REJECT_INVALID, "bad-txns-vout-p2sh");
        }
    }
    
    // ...
}

// Genesis 宽限期
bool IsGenesisGracefulPeriod(const Config& config, int spendHeight) {
    uint64_t uSpendHeight = static_cast<uint64_t>(spendHeight);
    if (((config.GetGenesisActivationHeight() - config.GetGenesisGracefulPeriod()) < uSpendHeight) &&
        ((config.GetGenesisActivationHeight() + config.GetGenesisGracefulPeriod()) > uSpendHeight)) {
        return true;
    }
    return false;
}
```

---

## 6. 交易验证状态机

### 6.1 CValidationState

```cpp
class CValidationState {
private:
    int nDoS;                   // 惩罚分数
    std::string strRejectReason; // 拒绝原因
    uint32_t chRejectCode;       // 拒绝代码
    bool corruptionPossible;     // 是否可能是数据损坏
    std::string strDebugMessage; // 调试信息

public:
    // 设置无效状态
    bool DoS(int nDoSIn, bool bIn, uint32_t chRejectCodeIn,
             const std::string &strRejectReasonIn,
             bool corruptionIn = false,
             const std::string &strDebugMessageIn = "") {
        nDoS = nDoSIn;
        chRejectCode = chRejectCodeIn;
        strRejectReason = strRejectReasonIn;
        corruptionPossible = corruptionIn;
        strDebugMessage = strDebugMessageIn;
        return bIn;
    }
    
    // 检查状态
    bool IsValid() const { return nDoS == 0 && strRejectReason.empty(); }
    bool IsInvalid() const { return !IsValid(); }
    int GetNDoS() const { return nDoS; }
    const std::string &GetRejectReason() const { return strRejectReason; }
};
```

### 6.2 拒绝代码

```cpp
enum {
    REJECT_MALFORMED = 0x01,       // 格式错误
    REJECT_INVALID = 0x10,         // 无效
    REJECT_OBSOLETE = 0x11,        // 过时
    REJECT_DUPLICATE = 0x12,       // 重复
    REJECT_NONSTANDARD = 0x40,     // 非标准
    REJECT_DUST = 0x41,            // 粉尘输出
    REJECT_INSUFFICIENTFEE = 0x42, // 手续费不足
    REJECT_CHECKPOINT = 0x43,      // 检查点失败
};
```

---

## 下一步

阶段二完成。接下来进入**阶段三：脚本与合约**，将学习：
1. 脚本执行引擎详细实现
2. 高级脚本类型（P2SH、Multisig）
3. TBC 特有脚本功能
4. 脚本优化（缓存机制）
