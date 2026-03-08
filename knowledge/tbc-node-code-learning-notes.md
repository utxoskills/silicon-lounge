# TBC 节点代码详细学习笔记

## 模块概览

| 模块 | 代码行数 | 核心功能 |
|------|----------|----------|
| script/ | ~7,400 | 脚本解释器、操作码执行 |
| validation | ~8,000 | 区块验证、链管理 |
| net/ | ~6,500 | P2P 网络通信 |
| rpc/ | ~9,400 | RPC 接口实现 |
| wallet/ | ~4,500 | 钱包功能 |
| primitives/ | ~800 | 基础数据结构 |
| crypto/ | ~2,000 | 加密算法 |
| txmempool | ~2,100 | 交易内存池 |

---

## 1. 脚本系统 (script/)

### 1.1 interpreter.cpp/h (2,695 行)
脚本解释器核心。

**核心函数**:
```cpp
// 脚本执行
std::optional<bool> EvalScript(
    const CScriptConfig& config,
    bool consensus,           // true=共识规则, false=策略规则
    LimitedStack& stack,      // 执行堆栈
    const CScript& script,    // 待执行脚本
    uint32_t flags,           // 脚本标志
    const BaseSignatureChecker& checker,  // 签名检查器
    ScriptError* serror       // 错误输出
);

// 脚本验证
bool VerifyScript(
    const CScriptConfig& config,
    bool consensus,
    const CScript& scriptSig,      // 解锁脚本
    const CScript& scriptPubKey,   // 锁定脚本
    uint32_t flags,
    const BaseSignatureChecker& checker,
    ScriptError* serror
);
```

**关键操作码实现**:
- `RShift()`: OP_RSHIFT 位右移
- `LShift()`: OP_LSHIFT 位左移
- `CastToBool()`: 栈元素转布尔值
- `CheckDataSig()`: OP_CHECKDATASIG 数据签名验证

### 1.2 script.h/cpp - CScript 类
```cpp
class CScript : public CScriptBase {
public:
    // 构建脚本
    CScript& operator<<(opcodetype opcode);
    CScript& operator<<(const std::vector<uint8_t>& data);
    CScript& operator<<(int64_t value);
    
    // 解析脚本
    bool GetOp(const_iterator& pc, opcodetype& opcodeRet, 
               std::vector<uint8_t>& vchRet) const;
    
    // 指令迭代
    bsv::instruction_iterator begin_instructions() const;
    bsv::instruction_iterator end_instructions() const;
};
```

### 1.3 opcodes.h - 操作码定义
```cpp
// 压栈操作
OP_0 = 0x00, OP_1 = 0x51 ... OP_16 = 0x60
OP_PUSHDATA1 = 0x4c, OP_PUSHDATA2 = 0x4d, OP_PUSHDATA4 = 0x4e

// 控制流
OP_IF = 0x63, OP_NOTIF = 0x64, OP_ELSE = 0x67, OP_ENDIF = 0x68
OP_VERIFY = 0x69, OP_RETURN = 0x6a

// 栈操作
OP_DUP = 0x76, OP_DROP = 0x75, OP_SWAP = 0x7c, OP_ROT = 0x7b

// 拼接操作 (Monolith 升级后)
OP_CAT = 0x7e, OP_SPLIT = 0x7f, OP_NUM2BIN = 0x80, OP_BIN2NUM = 0x81

// 位运算
OP_AND = 0x84, OP_OR = 0x85, OP_XOR = 0x86, OP_INVERT = 0x83
OP_LSHIFT = 0x98, OP_RSHIFT = 0x99

// 算术运算
OP_ADD = 0x93, OP_SUB = 0x94, OP_MUL = 0x95, OP_DIV = 0x96, OP_MOD = 0x97

// 加密操作
OP_RIPEMD160 = 0xa6, OP_SHA1 = 0xa7, OP_SHA256 = 0xa8
OP_HASH160 = 0xa9, OP_HASH256 = 0xaa
OP_CHECKSIG = 0xac, OP_CHECKMULTISIG = 0xae
OP_CHECKDATASIG = 0xbc  // BSV/TBC 特有

// TBC 特有
OP_PUSH_META = 0xba, OP_PARTIAL_HASH = 0xbb
```

### 1.4 limitedstack.h - 执行堆栈
```cpp
class LimitedStack {
    std::vector<StackItem> stack;
    size_t maxSize;        // 最大内存限制
    size_t maxElements;    // 最大元素数量
public:
    void push(const StackItem& item);
    StackItem pop();
    const StackItem& top() const;
    size_t size() const;
};
```

### 1.5 script_num.h - 大整数支持
```cpp
class CScriptNum {
    int64_t m_value;                    // 小数值
    std::vector<uint8_t> vch;           // 大数值 (Genesis 后)
public:
    // 算术运算
    CScriptNum operator+(const CScriptNum& rhs) const;
    CScriptNum operator-(const CScriptNum& rhs) const;
    CScriptNum operator*(const CScriptNum& rhs) const;
    CScriptNum operator/(const CScriptNum& rhs) const;
    
    // 位运算
    CScriptNum operator<<(int n) const;
    CScriptNum operator>>(int n) const;
};
```

---

## 2. 交易内存池 (txmempool)

### 2.1 CTxMemPoolEntry - 内存池条目
```cpp
class CTxMemPoolEntry {
    CTransactionRef tx;           // 交易引用
    Amount nFee;                  // 手续费
    size_t nTxSize;              // 交易大小
    int64_t nTime;               // 进入时间
    unsigned int entryHeight;    // 进入时区块高度
    int64_t sigOpCount;          // 签名操作数
    Amount feeDelta;             // 费用调整
    LockPoints lockPoints;       // 锁定点 (BIP68)
    
    // 祖先/后代统计
    AncestorDescendantCountsPtr ancestorDescendantCounts;
    uint64_t nSizeWithDescendants;
    Amount nModFeesWithDescendants;
};
```

### 2.2 CTxMemPool - 内存池主类
```cpp
class CTxMemPool {
    // 多索引容器
    indexed_transaction_set mapTx;
    
public:
    // 添加交易
    bool addUnchecked(const TxId& txid, const CTxMemPoolEntry& entry);
    
    // 移除交易
    void removeRecursive(const CTransaction& tx);
    void removeForBlock(const std::vector<CTransactionRef>& vtx);
    
    // 查询
    bool exists(const TxId& txid) const;
    CTransactionRef get(const TxId& txid) const;
    
    // 获取祖先/后代
    void GetAncestors(const TxId& txid, setEntries& ancestors) const;
    void GetDescendants(const TxId& txid, setEntries& descendants) const;
    
    // 修剪
    void Expire(int64_t time);
    void TrimToSize(size_t sizeLimit);
};
```

---

## 3. 区块验证 (validation)

### 3.1 全局状态
```cpp
CCriticalSection cs_main;                 // 主锁
BlockMap mapBlockIndex;                   // 区块索引映射
CChain chainActive;                       // 当前活跃链
CBlockIndex* pindexBestHeader = nullptr;  // 最佳区块头
CTxMemPool mempool;                       // 内存池
CCoinsViewCache* pcoinsTip = nullptr;     // UTXO 缓存
```

### 3.2 区块验证流程
```cpp
// 1. 检查区块头
bool CheckBlockHeader(const CBlockHeader& block, CValidationState& state, 
                      const Consensus::Params& consensusParams);

// 2. 检查区块内容
bool CheckBlock(const CBlock& block, CValidationState& state, 
                const Config& config, bool fCheckPOW = true);

// 3. 上下文验证
bool ContextualCheckBlock(const CBlock& block, CValidationState& state, 
                          const Config& config, CBlockIndex* pindexPrev);

// 4. 连接区块
bool ConnectBlock(const CBlock& block, CValidationState& state, 
                  CBlockIndex* pindex, CCoinsViewCache& view);

// 5. 激活最佳链
bool ActivateBestChain(CValidationState& state, const Config& config);
```

---

## 4. 网络层 (net/)

### 4.1 CNode - 对等节点
```cpp
class CNode {
    NodeId id;                    // 节点ID
    CService addr;               // 地址
    SOCKET hSocket;              // 套接字
    
    // 消息队列
    std::deque<CSerializedNetMsg> vSendMsg;
    std::list<CNetMessage> listRecvMsg;
    
    // 统计
    uint64_t nSendBytes = 0;
    uint64_t nRecvBytes = 0;
    
    // 服务标志
    ServiceFlags nServices = NODE_NONE;
    bool fInbound = false;       // 入站连接
    
public:
    void PushMessage(const char* pszCommand);
    bool Misbehaving(int howmuch);  // 惩罚分数
};
```

### 4.2 CConnman - 连接管理
```cpp
class CConnman {
    std::vector<CNodePtr> vNodes;
    CAddrMan addrman;            // 地址管理
    
public:
    bool Start(CScheduler& scheduler);
    void Stop();
    bool ConnectNode(const CAddress& addrConnect);
    void RelayTransaction(const CTransaction& tx);
};
```

---

## 5. 钱包系统 (wallet/)

### 5.1 CWallet - 钱包主类
```cpp
class CWallet : public CCryptoKeyStore {
    std::shared_ptr<CWalletDBWrapper> dbw;
    std::map<TxId, CWalletTx> mapWallet;
    std::map<COutPoint, COutput> mapUtxos;
    
public:
    // 密钥操作
    bool AddKeyPubKey(const CKey& key, const CPubKey& pubkey);
    CPubKey GetNewKey();
    
    // 交易操作
    bool CreateTransaction(const std::vector<CRecipient>& vecSend,
                          CWalletTx& wtxNew, CReserveKey& reservekey,
                          Amount& nFeeRet);
    bool SignTransaction(CMutableTransaction& tx);
    
    // 余额查询
    Amount GetBalance() const;
};
```

### 5.2 CWalletTx - 钱包交易
```cpp
class CWalletTx : public CMerkleTx {
    mapValue_t mapValue;
    int64_t nTimeReceived = 0;
    bool fFromMe = false;
    
public:
    int GetDepthInMainChain() const;
    Amount GetCredit() const;
    Amount GetDebit() const;
    Amount GetAvailableCredit() const;
};
```

---

## 6. RPC 接口 (rpc/)

### 6.1 核心命令
```cpp
// 区块链查询
UniValue getblockcount(const Config& config, const JSONRPCRequest& request);
UniValue getbestblockhash(const Config& config, const JSONRPCRequest& request);
UniValue getblock(const Config& config, const JSONRPCRequest& request);
UniValue getblockchaininfo(const Config& config, const JSONRPCRequest& request);

// 交易操作
UniValue getrawtransaction(const Config& config, const JSONRPCRequest& request);
UniValue sendrawtransaction(const Config& config, const JSONRPCRequest& request);
UniValue createrawtransaction(const Config& config, const JSONRPCRequest& request);

// 钱包 RPC
UniValue getbalance(const Config& config, const JSONRPCRequest& request);
UniValue sendtoaddress(const Config& config, const JSONRPCRequest& request);
UniValue getnewaddress(const Config& config, const JSONRPCRequest& request);
```

---

## 7. 基础数据结构 (primitives/)

### 7.1 交易结构
```cpp
class CTransaction {
    int32_t nVersion;
    std::vector<CTxIn> vin;      // 输入列表
    std::vector<CTxOut> vout;    // 输出列表
    uint32_t nLockTime;
};

class CTxIn {
    COutPoint prevout;           // 引用的 UTXO
    CScript scriptSig;           // 解锁脚本
    uint32_t nSequence;
};

class CTxOut {
    Amount nValue;
    CScript scriptPubKey;        // 锁定脚本
};

class COutPoint {
    TxId txid;
    uint32_t n;                  // 输出索引
};
```

### 7.2 区块结构
```cpp
class CBlockHeader {
    int32_t nVersion;
    uint256 hashPrevBlock;       // 前一区块哈希
    uint256 hashMerkleRoot;      // Merkle 根
    uint32_t nTime;
    uint32_t nBits;              // 难度目标
    uint32_t nNonce;             // 随机数
};

class CBlock : public CBlockHeader {
    std::vector<CTransactionRef> vtx;  // 交易列表
};
```

---

## 8. 加密模块 (crypto/)

### 8.1 哈希算法
```cpp
// SHA256
class CSHA256 {
    void Write(const uint8_t* data, size_t len);
    void Finalize(uint8_t hash[OUTPUT_SIZE]);
};

// RIPEMD160
class CRIPEMD160 {
    void Write(const uint8_t* data, size_t len);
    void Finalize(uint8_t hash[OUTPUT_SIZE]);
};

// 比特币哈希
uint256 Hash(const T1 pbegin, const T1 pend);  // 双 SHA256
uint160 Hash160(const T1 pbegin, const T1 pend);  // SHA256 + RIPEMD160
```

### 8.2 密钥类
```cpp
class CKey {
    std::vector<uint8_t> vch;    // 私钥数据
    bool fCompressed;            // 是否压缩格式
    
public:
    bool Sign(const uint256& hash, std::vector<uint8_t>& vchSig) const;
    CPubKey GetPubKey() const;
};

class CPubKey {
    uint8_t vch[65];             // 公钥数据
    
public:
    bool Verify(const uint256& hash, const std::vector<uint8_t>& vchSig) const;
    bool IsCompressed() const;
};
```

---

## 9. TBC 特有功能

### 9.1 大区块支持
```cpp
// 默认配置
static const uint64_t DEFAULT_MAX_BLOCK_SIZE = 10GB;
static const uint64_t DEFAULT_MAX_TX_SIZE = 1GB;
static const uint64_t DEFAULT_STACK_MEMORY = 100MB;

// Genesis 后限制
MAX_TX_SIZE_CONSENSUS_AFTER_GENESIS = 1GB;
MAX_OPS_PER_SCRIPT_AFTER_GENESIS = UINT32_MAX;
MAX_SCRIPT_SIZE_AFTER_GENESIS = UINT32_MAX;
```

### 9.2 共识参数
```cpp
// TBC 分叉高度
#define TBC_FORK_BLOCK_HEIGHT 824190

// Coinbase 成熟高度 (TBC 为 1，比特币为 100)
static const int COINBASE_MATURITY = 1;
```

### 9.3 特有操作码
```cpp
// TBC 新增操作码
OP_PUSH_META = 0xba,      // 推送元数据
OP_PARTIAL_HASH = 0xbb,   // 部分哈希
```

---

## 10. 关键流程总结

### 10.1 交易验证流程
1. `CheckTransaction()` - 检查交易格式
2. `ContextualCheckTransaction()` - 上下文检查
3. `AcceptToMemoryPool()` - 接受进内存池
4. `VerifyScript()` - 验证脚本

### 10.2 区块处理流程
1. `CheckBlockHeader()` - 验证区块头
2. `CheckBlock()` - 验证区块内容
3. `ContextualCheckBlock()` - 上下文验证
4. `ConnectBlock()` - 连接区块到链
5. `ActivateBestChain()` - 激活最佳链

### 10.3 网络消息处理
1. `ProcessMessages()` - 处理接收消息
2. 根据命令分发到对应处理器
3. `SendMessages()` - 发送待发送消息
