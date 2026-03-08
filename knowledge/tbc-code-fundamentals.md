# TBC 节点代码基础原理学习笔记

## 1. 基础数据结构

### 1.1 uint256 - 256位无符号整数

**文件**: `uint256.h`

比特币使用256位（32字节）的哈希值作为交易ID、区块哈希等。

```cpp
template <unsigned int BITS> class base_blob {
protected:
    enum { WIDTH = BITS / 8 };
    uint8_t data[WIDTH];  // 32字节原始数据

public:
    // 比较操作
    int Compare(const base_blob &other) const {
        return memcmp(data, other.data, sizeof(data));
    }
    
    // 转换为十六进制字符串
    std::string GetHex() const;
    void SetHex(const char *psz);
    
    // 获取64位片段（用于哈希表）
    uint64_t GetUint64(int pos) const {
        const uint8_t *ptr = data + pos * 8;
        return ((uint64_t)ptr[0]) | ((uint64_t)ptr[1]) << 8 |
               ((uint64_t)ptr[2]) << 16 | ((uint64_t)ptr[3]) << 24 |
               ((uint64_t)ptr[4]) << 32 | ((uint64_t)ptr[5]) << 40 |
               ((uint64_t)ptr[6]) << 48 | ((uint64_t)ptr[7]) << 56;
    }
};

class uint256 : public base_blob<256> {
public:
    uint64_t GetCheapHash() const { return ReadLE64(data); }
};
```

**用途**:
- 交易ID (TxId)
- 区块哈希
- Merkle根
- 公钥哈希

### 1.2 arith_uint256 - 支持算术运算的256位整数

**文件**: `arith_uint256.h`

用于难度计算和挖矿目标值。

```cpp
template <unsigned int BITS> class base_uint {
protected:
    enum { WIDTH = BITS / 32 };
    uint32_t pn[WIDTH];  // 8个32位整数 = 256位

public:
    // 算术运算
    base_uint &operator+=(const base_uint &b);
    base_uint &operator-=(const base_uint &b);
    base_uint &operator*=(const base_uint &b);
    base_uint &operator/=(const base_uint &b);
    base_uint &operator<<=(unsigned int shift);
    base_uint &operator>>=(unsigned int shift);
    
    // 位运算
    base_uint &operator&=(const base_uint &b);
    base_uint &operator|=(const base_uint &b);
    base_uint &operator^=(const base_uint &b);
    
    // 紧凑格式转换（用于nBits字段）
    arith_uint256 &SetCompact(uint32_t nCompact);
    uint32_t GetCompact() const;
};
```

**难度计算原理**:
```
nBits 是紧凑格式的难度目标值
最大目标值: 0x1d00ffff (约 2^224)
当前难度 = 最大目标值 / 当前目标值
```

---

## 2. 哈希算法

### 2.1 SHA-256 实现

**文件**: `crypto/sha256.cpp`

SHA-256 是比特币的核心哈希算法，区块哈希是双 SHA-256。

```cpp
// SHA-256 常量
static const uint32_t k[] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    // ... 64个常量
};

// 初始化向量
void Initialize(uint32_t *s) {
    s[0] = 0x6a09e667ul;  // 前8个质数的平方根的小数部分
    s[1] = 0xbb67ae85ul;
    s[2] = 0x3c6ef372ul;
    s[3] = 0xa54ff53aul;
    s[4] = 0x510e527ful;
    s[5] = 0x9b05688cul;
    s[6] = 0x1f83d9abul;
    s[7] = 0x5be0cd19ul;
}

// 核心轮函数
inline void Round(uint32_t a, uint32_t b, uint32_t c, uint32_t &d,
                  uint32_t e, uint32_t f, uint32_t g, uint32_t &h,
                  uint32_t k, uint32_t w) {
    uint32_t t1 = h + Sigma1(e) + Ch(e, f, g) + k + w;
    uint32_t t2 = Sigma0(a) + Maj(a, b, c);
    d += t1;
    h = t1 + t2;
}
```

**比特币哈希函数**:
```cpp
// 双 SHA-256（区块哈希、交易ID）
uint256 Hash(const T1 pbegin, const T1 pend) {
    uint256 result;
    CHash256()
        .Write(data, len)
        .Finalize((uint8_t *)&result);  // 第一次SHA256
    // 内部进行第二次SHA256
}

// Hash160 (P2PKH地址)
uint160 Hash160(const T1 pbegin, const T1 pend) {
    // SHA256 + RIPEMD160
    uint8_t buf[CSHA256::OUTPUT_SIZE];
    sha.Finalize(buf);
    CRIPEMD160().Write(buf, CSHA256::OUTPUT_SIZE).Finalize(hash);
}
```

### 2.2 Merkle 树

**文件**: `consensus/merkle.cpp`

Merkle树用于高效验证区块中的交易存在性。

```cpp
// 计算Merkle根
uint256 ComputeMerkleRoot(const std::vector<uint256> &leaves, bool *mutated) {
    uint256 hash;
    MerkleComputation(leaves, &hash, mutated, -1, nullptr);
    return hash;
}

// 计算Merkle分支（用于SPV证明）
std::vector<uint256> ComputeMerkleBranch(const std::vector<uint256> &leaves,
                                         uint32_t position) {
    std::vector<uint256> ret;
    MerkleComputation(leaves, nullptr, nullptr, position, &ret);
    return ret;
}

// 从分支验证Merkle根
uint256 ComputeMerkleRootFromBranch(const uint256 &leaf,
                                    const std::vector<uint256> &vMerkleBranch,
                                    uint32_t nIndex) {
    uint256 hash = leaf;
    for (auto it = vMerkleBranch.begin(); it != vMerkleBranch.end(); ++it) {
        if (nIndex & 1) {
            hash = Hash(it->begin(), it->end(), hash.begin(), hash.end());
        } else {
            hash = Hash(hash.begin(), hash.end(), it->begin(), it->end());
        }
        nIndex >>= 1;
    }
    return hash;
}
```

**Merkle树构建过程**:
```
交易: [Tx1, Tx2, Tx3, Tx4, Tx5, Tx6]

Level 0 (叶子): [H1, H2, H3, H4, H5, H6]
Level 1:        [H12, H34, H56, H56]  // 奇数个时复制最后一个
Level 2:        [H1234, H5656]
Level 3 (根):   [H12345656]

其中 H12 = Hash(H1 || H2)
```

**CVE-2012-2459 漏洞防护**:
- 如果最后两个哈希相同，标记为 mutated
- 防止通过重复交易伪造相同Merkle根

---

## 3. 椭圆曲线加密 (secp256k1)

### 3.1 私钥 (CKey)

**文件**: `key.h`

```cpp
class CKey {
private:
    bool fValid;           // 是否有效
    bool fCompressed;      // 是否压缩格式
    std::vector<uint8_t, secure_allocator<uint8_t>> keydata;  // 32字节私钥

public:
    // 生成新私钥
    void MakeNewKey(bool fCompressed);
    
    // 签名
    bool Sign(const uint256 &hash, std::vector<uint8_t> &vchSig) const;
    
    // 紧凑签名（65字节，可恢复公钥）
    bool SignCompact(const uint256 &hash, std::vector<uint8_t> &vchSig) const;
    
    // 获取公钥
    CPubKey GetPubKey() const;
    
    // BIP32 子密钥派生
    bool Derive(CKey &keyChild, ChainCode &ccChild, 
                unsigned int nChild, const ChainCode &cc) const;
};
```

### 3.2 公钥 (CPubKey)

**文件**: `pubkey.h`

```cpp
class CPubKey {
private:
    uint8_t vch[65];  // 公钥数据
    
    // 长度计算
    static unsigned int GetLen(uint8_t chHeader) {
        if (chHeader == 2 || chHeader == 3) return 33;  // 压缩
        if (chHeader == 4 || chHeader == 6 || chHeader == 7) return 65;  // 未压缩
        return 0;
    }

public:
    // 验证签名
    bool Verify(const uint256 &hash, const std::vector<uint8_t> &vchSig) const;
    
    // 从紧凑签名恢复公钥
    bool RecoverCompact(const uint256 &hash, const std::vector<uint8_t> &vchSig);
    
    // 获取KeyID (Hash160)
    CKeyID GetID() const { return CKeyID(Hash160(vch, vch + size())); }
    
    // 是否压缩格式
    bool IsCompressed() const { return size() == 33; }
};
```

**公钥格式**:
- 压缩格式 (33字节): `0x02/0x03` + X坐标 (Y的奇偶性由前缀区分)
- 未压缩格式 (65字节): `0x04` + X坐标 + Y坐标

### 3.3 BIP32 分层确定性钱包

```cpp
struct CExtKey {
    uint8_t nDepth;                    // 深度
    uint8_t vchFingerprint[4];         // 父密钥指纹
    unsigned int nChild;               // 子密钥索引
    ChainCode chaincode;               // 链码
    CKey key;                          // 私钥
    
    // 派生子密钥
    bool Derive(CExtKey &out, unsigned int nChild) const;
    
    // 转为公钥版本
    CExtPubKey Neuter() const;
};

// 派生路径: m/0'/1/2'
// m: 主密钥
// ' : 硬化派生 (索引 >= 2^31)
```

---

## 4. 区块结构

### 4.1 区块头 (CBlockHeader)

**文件**: `primitives/block.h`

```cpp
class CBlockHeader {
public:
    int32_t nVersion;           // 版本号
    uint256 hashPrevBlock;      // 前一区块哈希
    uint256 hashMerkleRoot;     // Merkle根
    uint32_t nTime;             // 时间戳
    uint32_t nBits;             // 难度目标（紧凑格式）
    uint32_t nNonce;            // 随机数

    uint256 GetHash() const;    // 计算区块哈希（双SHA256）
    int64_t GetBlockTime() const { return (int64_t)nTime; }
};
```

### 4.2 区块 (CBlock)

```cpp
class CBlock : public CBlockHeader {
public:
    std::vector<CTransactionRef> vtx;  // 交易列表
    mutable bool fChecked;              // 是否已验证
    
    // 从Coinbase获取区块高度
    uint64_t GetHeightFromCoinbase() const;
    
    // 获取不含Coinbase的大小
    size_t GetSizeWithoutCoinbase();
    
    // 序列化后的区块头
    CBlockHeader GetBlockHeader() const;
};
```

### 4.3 区块索引 (CBlockIndex)

**文件**: `chain.h`

```cpp
class CBlockIndex {
public:
    uint256 phashBlock;         // 区块哈希
    CBlockIndex* pprev;         // 前一区块
    CBlockIndex* pskip;         // 跳表指针（加速祖先查找）
    
    int nHeight;                // 区块高度
    int64_t nTime;              // 时间戳
    uint32_t nBits;             // 难度目标
    uint32_t nNonce;            // 随机数
    uint256 hashMerkleRoot;     // Merkle根
    
    arith_uint256 nChainWork;   // 累计工作量
    
    // 区块状态
    BlockStatus nStatus;
    
    // 磁盘位置
    CDiskBlockPos nFile;
    unsigned int nDataPos;
    unsigned int nUndoPos;
    
    // 获取祖先（O(log n) 使用跳表）
    CBlockIndex* GetAncestor(int height);
    
    // 获取Median Time Past
    int64_t GetMedianTimePast() const;
};
```

**跳表 (Skip List) 优化**:
```cpp
// 构建跳表，使查找祖先从 O(n) 降到 O(log n)
void CBlockIndex::BuildSkip() {
    if (pprev)
        pskip = pprev->GetAncestor(GetSkipHeight(nHeight));
}

// 获取跳表高度
static inline int GetSkipHeight(int nHeight) {
    if (nHeight < 2) return 0;
    
    // 返回最高设置位的位置
    return (nHeight & 1) ? InvertLowestOne(InvertLowestOne(nHeight - 1)) + 1
                         : InvertLowestOne(nHeight);
}
```

---

## 5. 交易结构

### 5.1 交易输入 (CTxIn)

**文件**: `primitives/transaction.h`

```cpp
class COutPoint {
public:
    TxId txid;           // 引用的交易ID
    uint32_t n;          // 输出索引
};

class CTxIn {
public:
    COutPoint prevout;   // 引用的UTXO
    CScript scriptSig;   // 解锁脚本
    uint32_t nSequence;  // 序列号（用于BIP68相对时间锁）
    
    // 序列号常量
    static const uint32_t SEQUENCE_FINAL = 0xffffffff;
    static const uint32_t SEQUENCE_LOCKTIME_DISABLE_FLAG = (1 << 31);
    static const uint32_t SEQUENCE_LOCKTIME_TYPE_FLAG = (1 << 22);
};
```

### 5.2 交易输出 (CTxOut)

```cpp
class CTxOut {
public:
    Amount nValue;           // 金额（以satoshi为单位）
    CScript scriptPubKey;    // 锁定脚本
    
    bool IsNull() const { return nValue == Amount(-1); }
};
```

### 5.3 交易 (CTransaction)

```cpp
class CTransaction {
public:
    int32_t nVersion;                    // 版本号
    std::vector<CTxIn> vin;              // 输入列表
    std::vector<CTxOut> vout;            // 输出列表
    uint32_t nLockTime;                  // 锁定时间
    
    // 计算交易ID（双SHA256）
    TxId GetId() const;
    
    // 计算交易哈希（可能包含见证数据）
    TxHash GetHash() const;
    
    // 是否是Coinbase交易
    bool IsCoinBase() const { return vin.size() == 1 && vin[0].prevout.IsNull(); }
};
```

---

## 6. 工作量证明 (POW)

### 6.1 难度调整

**文件**: `pow.cpp`

```cpp
// 计算下一个难度目标
uint32_t GetNextWorkRequired(const CBlockIndex *pindexPrev, 
                             const CBlockHeader *pblock,
                             const Config &config) {
    const Consensus::Params &params = config.GetChainParams().GetConsensus();
    
    // 每2016个区块调整一次难度
    if ((pindexPrev->nHeight + 1) % params.DifficultyAdjustmentInterval() == 0) {
        return CalculateNextWorkRequired(pindexPrev, config);
    }
    
    // 否则保持当前难度
    return pindexPrev->nBits;
}

// 计算新难度
uint32_t CalculateNextWorkRequired(const CBlockIndex *pindexLast,
                                   const Config &config) {
    // 获取2016个区块前的区块
    const CBlockIndex *pindexFirst = pindexLast->GetAncestor(
        pindexLast->nHeight - params.DifficultyAdjustmentInterval());
    
    // 计算实际用时
    int64_t nActualTimespan = pindexLast->GetBlockTime() - pindexFirst->GetBlockTime();
    
    // 限制调整范围（4倍以内）
    if (nActualTimespan < params.nPowTargetTimespan / 4)
        nActualTimespan = params.nPowTargetTimespan / 4;
    if (nActualTimespan > params.nPowTargetTimespan * 4)
        nActualTimespan = params.nPowTargetTimespan * 4;
    
    // 新目标 = 旧目标 * 实际用时 / 目标用时
    arith_uint256 bnNew;
    bnNew.SetCompact(pindexLast->nBits);
    bnNew *= nActualTimespan;
    bnNew /= params.nPowTargetTimespan;
    
    // 不能超过最大目标
    if (bnNew > UintToArith256(params.powLimit))
        bnNew = UintToArith256(params.powLimit);
    
    return bnNew.GetCompact();
}
```

### 6.2 难度验证

```cpp
// 检查区块哈希是否满足难度目标
bool CheckProofOfWork(uint256 hash, uint32_t nBits, const Consensus::Params &params) {
    arith_uint256 bnTarget;
    bnTarget.SetCompact(nBits);
    
    // 检查是否超过最大目标
    if (bnTarget <= 0 || bnTarget > UintToArith256(params.powLimit))
        return false;
    
    // 检查哈希是否小于目标值
    if (UintToArith256(hash) > bnTarget)
        return false;
    
    return true;
}
```

---

## 7. 脚本执行原理

### 7.1 栈式虚拟机

比特币脚本是一种基于栈的逆波兰表示法语言。

**执行模型**:
```
初始: 空栈

执行 OP_2:
栈: [2]

执行 OP_3:
栈: [2, 3]

执行 OP_ADD:
弹出 3 和 2，相加，压入结果
栈: [5]
```

### 7.2 脚本验证流程

```cpp
// 1. 复制脚本到栈
CScript scriptCopy = scriptPubKey;

// 2. 执行解锁脚本 (scriptSig)
if (!EvalScript(stack, scriptSig, flags, checker))
    return false;

// 3. 复制栈状态（用于P2SH）
std::vector<std::vector<uint8_t>> stackCopy = stack;

// 4. 执行锁定脚本 (scriptPubKey)
if (!EvalScript(stack, scriptPubKey, flags, checker))
    return false;

// 5. 检查栈顶是否为真
if (stack.empty() || !CastToBool(stack.back()))
    return false;

// 6. P2SH 额外验证
if (isP2SH) {
    // 用 stackCopy 替换栈，执行赎回脚本
}
```

### 7.3 P2PKH 脚本示例

```
解锁脚本 (scriptSig):  <sig> <pubkey>
锁定脚本 (scriptPubKey): OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG

执行过程:
1. <sig> 入栈
   栈: [<sig>]
   
2. <pubkey> 入栈
   栈: [<sig>, <pubkey>]
   
3. OP_DUP (复制栈顶)
   栈: [<sig>, <pubkey>, <pubkey>]
   
4. OP_HASH160 (计算Hash160)
   栈: [<sig>, <pubkey>, <pubKeyHash>]
   
5. <pubKeyHash> 入栈
   栈: [<sig>, <pubkey>, <pubKeyHash>, <pubKeyHash>]
   
6. OP_EQUALVERIFY (比较并验证)
   栈: [<sig>, <pubkey>]
   
7. OP_CHECKSIG (验证签名)
   栈: [true]
```

---

## 8. UTXO 模型

### 8.1 UTXO 集

UTXO (Unspent Transaction Output) 是比特币的账户模型。

```cpp
// UTXO 输出
class CTxOut {
    Amount nValue;           // 金额
    CScript scriptPubKey;    // 锁定脚本
};

// UTXO 引用
class COutPoint {
    TxId txid;      // 交易ID
    uint32_t n;     // 输出索引
};

// Coin (UTXO + 元数据)
class Coin {
    CTxOut out;           // 输出
    unsigned int nHeight; // 创建高度
    bool fCoinBase;       // 是否是Coinbase输出
    
    bool IsSpent() const { return out.IsNull(); }
    void Clear() { out.SetNull(); }
};
```

### 8.2 UTXO 缓存

```cpp
class CCoinsViewCache : public CCoinsViewBacked {
protected:
    mutable uint256 hashBlock;                    // 当前区块哈希
    mutable CCoinsMap cacheCoins;                 // UTXO缓存
    mutable size_t cachedCoinsUsage;              // 缓存内存使用

public:
    // 获取UTXO
    const Coin& AccessCoin(const COutPoint &output) const;
    
    // 添加UTXO
    void AddCoin(const COutPoint &outpoint, Coin&& coin, bool possible_overwrite);
    
    // 花费UTXO
    bool SpendCoin(const COutPoint &outpoint, Coin* pcoin = nullptr);
    
    // 批量修改
    bool BatchWrite(CCoinsMap &mapCoins, const uint256 &hashBlock);
    
    // 刷新到后端
    bool Flush();
};
```

### 8.3 UTXO 花费规则

```cpp
bool CheckTxInputs(const CTransaction& tx, CValidationState& state, 
                   const CCoinsViewCache& inputs) {
    for (const auto& in : tx.vin) {
        const Coin& coin = inputs.AccessCoin(in.prevout);
        
        // 1. 检查UTXO是否存在
        if (coin.IsSpent())
            return false;
        
        // 2. 检查Coinbase成熟度
        if (coin.fCoinBase && nSpendHeight - coin.nHeight < COINBASE_MATURITY)
            return false;
        
        // 3. 累加输入金额
        nValueIn += coin.out.nValue;
    }
    
    // 4. 检查输出不超过输入
    if (nValueIn < tx.GetValueOut())
        return false;
    
    return true;
}
```

---

## 9. 网络协议

### 9.1 消息结构

```cpp
// P2P消息头
struct CMessageHeader {
    uint32_t nMagic;        // 魔数 (0xE8F3E1E3 for TBC)
    char pchCommand[12];    // 命令名
    uint32_t nMessageSize;  // 消息体大小
    uint8_t pchChecksum[4]; // 校验和 (双SHA256的前4字节)
};

// 序列化消息
class CSerializedNetMsg {
    std::string mCommand;
    uint256 mHash;
    size_t mSize;
    std::unique_ptr<CForwardAsyncReadonlyStream> mData;
};
```

### 9.2 核心消息类型

```cpp
// 版本协商
struct CVersionMessage {
    int32_t nVersion;           // 协议版本
    uint64_t nServices;         // 服务标志
    int64_t nTime;              // 时间戳
    CAddress addrFrom;          // 发送方地址
    CAddress addrTo;            // 接收方地址
    uint64_t nNonce;            // 随机数
    std::string strSubVer;      // 版本字符串
    int32_t nStartingHeight;    // 起始高度
    bool fRelay;                // 是否中继交易
};

// 库存向量
struct CInv {
    int type;       // MSG_TX (1), MSG_BLOCK (2)
    uint256 hash;   // 交易或区块哈希
};

// 区块消息
struct CBlockMessage {
    CBlock block;
};

// 交易消息
struct CTxMessage {
    CTransaction tx;
};
```

### 9.3 消息处理流程

```cpp
// 1. 接收消息
bool ProcessMessages(CNode* pfrom) {
    // 读取消息头
    CMessageHeader hdr;
    if (!pfrom->vRecvMsg.GetHeader(hdr))
        return false;
    
    // 读取消息体
    CNetMessage msg;
    if (!pfrom->vRecvMsg.GetMessage(msg))
        return false;
    
    // 分发到处理器
    auto it = netMsgHandlers.find(msg.hdr.pchCommand);
    if (it != netMsgHandlers.end()) {
        return it->second(pfrom, msg);
    }
}

// 2. 处理区块消息
bool ProcessMessageBlock(CNode* pfrom, CNetMessage& msg) {
    CBlock block;
    msg.vRecv >> block;
    
    // 验证并处理区块
    ProcessNewBlock(block, pfrom);
}

// 3. 处理交易消息
bool ProcessMessageTx(CNode* pfrom, CNetMessage& msg) {
    CTransaction tx;
    msg.vRecv >> tx;
    
    // 验证并加入内存池
    AcceptToMemoryPool(tx);
    
    // 中继给对等节点
    RelayTransaction(tx);
}
```

---

## 10. 关键设计模式

### 10.1 验证状态机

```cpp
enum class BlockValidity : uint32_t {
    UNKNOWN = 0,        // 未知
    HEADER = 1,         // 区块头有效
    TREE = 2,           // 连接到主链
    TRANSACTIONS = 3,   // 交易有效
    CHAIN = 4,          // 输入输出有效
    SCRIPTS = 5,        // 脚本签名有效
};
```

### 10.2 内存管理

```cpp
// 安全分配器（用于私钥）
template <typename T>
struct secure_allocator : public std::allocator<T> {
    // 使用mlock锁定内存，防止交换到磁盘
    // 清零后释放
};

// 预分配向量（优化小容器）
template <unsigned int N, typename T>
class prevector {
    // 小数据使用栈数组，大数据使用堆
    // 避免频繁内存分配
};
```

### 10.3 序列化

```cpp
// 自动序列化宏
#define ADD_SERIALIZE_METHODS                                         \
    template <typename Stream, typename Operation>                    \
    inline void SerializationOp(Stream &s, Operation ser_action) {    \
        READWRITE(nVersion);                                          \
        READWRITE(vin);                                               \
        READWRITE(vout);                                              \
        READWRITE(nLockTime);                                         \
    }

// 使用示例
class CTransaction {
    ADD_SERIALIZE_METHODS;
};
```

---

## 11. TBC 特有功能

### 11.1 大区块支持

```cpp
// Genesis 升级后限制
MAX_TX_SIZE_CONSENSUS_AFTER_GENESIS = 1GB;
MAX_OPS_PER_SCRIPT_AFTER_GENESIS = UINT32_MAX;
MAX_SCRIPT_SIZE_AFTER_GENESIS = UINT32_MAX;
MAX_SCRIPT_NUM_LENGTH_AFTER_GENESIS = 750KB;
DEFAULT_STACK_MEMORY_USAGE_CONSENSUS_AFTER_GENESIS = INT64_MAX;
```

### 11.2 排序网络难度调整

```cpp
// TBC 使用排序网络而非简单的中位数
void SortingNetwork(const CBlockIndex *pindex, 
                    const int32_t selectSortingNum,
                    std::map<uint32_t, const CBlockIndex*> &mapBlocks) {
    // 根据区块时间排序选择中间值
    // 更抗ASIC优化
}
```

### 11.3 快速确认

```cpp
// TBC Coinbase 只需 1 个确认即可花费
static const int COINBASE_MATURITY = 1;
// 比特币是 100 个确认
```

---

## 总结

TBC 节点代码基于比特币核心，主要修改包括：

1. **大区块支持**: 移除 Genesis 升级后的各种限制
2. **快速确认**: Coinbase 1 个确认即可花费
3. **排序网络难度调整**: 更公平的挖矿算法
4. **TBC 特有操作码**: OP_PUSH_META, OP_PARTIAL_HASH

核心架构保持不变：
- UTXO 模型
- POW 共识
- P2P 网络
- 脚本系统
