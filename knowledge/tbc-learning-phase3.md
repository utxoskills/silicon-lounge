# TBC 节点代码学习 - 阶段三：脚本与合约

## 1. 脚本执行引擎

### 1.1 EvalScript 主函数

```cpp
std::optional<bool> EvalScript(
    const CScriptConfig& config,      // 脚本配置
    bool consensus,                   // 是否共识规则
    const task::CCancellationToken& token,  // 取消令牌
    LimitedStack& stack,              // 主栈
    const CScript& script,            // 执行脚本
    uint32_t flags,                   // 脚本标志
    const BaseSignatureChecker& checker,    // 签名检查器
    LimitedStack& altstack,           // 备用栈
    long& ipc,                        // 指令指针
    std::vector<bool>& vfExec,       // 条件执行栈
    std::vector<bool>& vfElse,      // ELSE 条件栈
    ScriptError* serror)              // 错误输出
{
    CScript::const_iterator pc = script.begin();
    CScript::const_iterator pend = script.end();
    CScript::const_iterator pbegincodehash = script.begin();
    opcodetype opcode;
    valtype vchPushValue;
    
    uint64_t nOpCount = 0;  // 操作码计数
    bool nonTopLevelReturnAfterGenesis = false;
    
    while (pc < pend) {
        // 读取指令
        if (!script.GetOp(pc, opcode, vchPushValue)) {
            return set_error(serror, SCRIPT_ERR_BAD_OPCODE);
        }
        ipc = pc - script.begin();
        
        // 检查脚本大小限制
        if (script.size() > config.GetMaxScriptSize(utxo_after_genesis, consensus)) {
            return set_error(serror, SCRIPT_ERR_SCRIPT_SIZE);
        }
        
        // 确定是否执行（条件分支）
        bool fExec = !count(vfExec.begin(), vfExec.end(), false) && 
                     (!nonTopLevelReturnAfterGenesis || opcode == OP_RETURN);
        
        // 检查操作码数量限制
        if ((opcode > OP_16) && 
            !IsValidMaxOpsPerScript(++nOpCount, config, utxo_after_genesis, consensus)) {
            return set_error(serror, SCRIPT_ERR_OP_COUNT);
        }
        
        // 检查禁用操作码
        if (IsOpcodeDisabled(opcode) && (!utxo_after_genesis || fExec)) {
            return set_error(serror, SCRIPT_ERR_DISABLED_OPCODE);
        }
        
        if (fExec && 0 <= opcode && opcode <= OP_PUSHDATA4) {
            // 压栈操作
            if (fRequireMinimal && !CheckMinimalPush(vchPushValue, opcode)) {
                return set_error(serror, SCRIPT_ERR_MINIMALDATA);
            }
            stack.push_back(vchPushValue);
        } else if (fExec || (OP_IF <= opcode && opcode <= OP_ENDIF)) {
            // 执行操作码
            switch (opcode) {
                // ... 操作码处理
            }
        }
    }
    
    return set_success(serror);
}
```

### 1.2 条件执行流程

```cpp
// OP_IF - 如果栈顶为真，执行后续代码
case OP_IF: {
    bool fValue = false;
    if (fExec) {
        if (stack.size() < 1)
            return set_error(serror, SCRIPT_ERR_UNBALANCED_CONDITIONAL);
        fValue = CastToBool(stack.stacktop(-1));
        stack.pop_back();
    }
    vfExec.push_back(fValue);
    vfElse.push_back(false);
} break;

// OP_NOTIF - 如果栈顶为假，执行后续代码
case OP_NOTIF: {
    bool fValue = false;
    if (fExec) {
        if (stack.size() < 1)
            return set_error(serror, SCRIPT_ERR_UNBALANCED_CONDITIONAL);
        fValue = !CastToBool(stack.stacktop(-1));
        stack.pop_back();
    }
    vfExec.push_back(fValue);
    vfElse.push_back(false);
} break;

// OP_ELSE - 切换执行状态
case OP_ELSE: {
    if (vfExec.empty())
        return set_error(serror, SCRIPT_ERR_UNBALANCED_CONDITIONAL);
    if (vfElse.empty())
        return set_error(serror, SCRIPT_ERR_UNBALANCED_CONDITIONAL);
    
    // 如果 vfElse.back() 为 true，表示已经执行过 ELSE，报错
    if (vfElse.back())
        return set_error(serror, SCRIPT_ERR_UNBALANCED_CONDITIONAL);
    
    vfElse.back() = true;  // 标记已执行 ELSE
    vfExec.back() = !vfExec.back();  // 切换执行状态
} break;

// OP_ENDIF - 结束条件分支
case OP_ENDIF: {
    if (vfExec.empty())
        return set_error(serror, SCRIPT_ERR_UNBALANCED_CONDITIONAL);
    if (vfElse.empty())
        return set_error(serror, SCRIPT_ERR_UNBALANCED_CONDITIONAL);
    
    vfExec.pop_back();
    vfElse.pop_back();
} break;
```

### 1.3 栈操作

```cpp
// OP_DUP - 复制栈顶
case OP_DUP: {
    if (stack.size() < 1)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    stack.push_back(stack.stacktop(-1));
} break;

// OP_DROP - 丢弃栈顶
case OP_DROP: {
    if (stack.size() < 1)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    stack.pop_back();
} break;

// OP_SWAP - 交换栈顶两个元素
case OP_SWAP: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    swap(stack.stacktop(-2), stack.stacktop(-1));
} break;

// OP_PICK - 从栈深n处取元素
case OP_PICK: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    int64_t n = CScriptNum(stack.stacktop(-1), fRequireMinimal).getint();
    stack.pop_back();
    if (n < 0 || n >= (int64_t)stack.size())
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    stack.push_back(stack.stacktop(-n - 1));
} break;

// OP_ROLL - 从栈深n处取元素并移除
case OP_ROLL: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    int64_t n = CScriptNum(stack.stacktop(-1), fRequireMinimal).getint();
    stack.pop_back();
    if (n < 0 || n >= (int64_t)stack.size())
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    valtype vch = stack.stacktop(-n - 1);
    stack.erase(stack.end() - n - 1);
    stack.push_back(vch);
} break;
```

### 1.4 算术运算

```cpp
// OP_ADD - 加法
case OP_ADD: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    CScriptNum bn1(stack.stacktop(-2), fRequireMinimal, maxScriptNumLength);
    CScriptNum bn2(stack.stacktop(-1), fRequireMinimal, maxScriptNumLength);
    stack.pop_back();
    stack.pop_back();
    stack.push_back((bn1 + bn2).getvch());
} break;

// OP_SUB - 减法
case OP_SUB: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    CScriptNum bn1(stack.stacktop(-2), fRequireMinimal, maxScriptNumLength);
    CScriptNum bn2(stack.stacktop(-1), fRequireMinimal, maxScriptNumLength);
    stack.pop_back();
    stack.pop_back();
    stack.push_back((bn1 - bn2).getvch());
} break;

// OP_MUL - 乘法 (Genesis 后启用)
case OP_MUL: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    CScriptNum bn1(stack.stacktop(-2), fRequireMinimal, maxScriptNumLength);
    CScriptNum bn2(stack.stacktop(-1), fRequireMinimal, maxScriptNumLength);
    stack.pop_back();
    stack.pop_back();
    stack.push_back((bn1 * bn2).getvch());
} break;

// OP_DIV - 除法 (Genesis 后启用)
case OP_DIV: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    CScriptNum bn1(stack.stacktop(-2), fRequireMinimal, maxScriptNumLength);
    CScriptNum bn2(stack.stacktop(-1), fRequireMinimal, maxScriptNumLength);
    if (bn2 == 0)
        return set_error(serror, SCRIPT_ERR_DIV_BY_ZERO);
    stack.pop_back();
    stack.pop_back();
    stack.push_back((bn1 / bn2).getvch());
} break;
```

### 1.5 加密操作

```cpp
// OP_RIPEMD160
case OP_RIPEMD160: {
    if (stack.size() < 1)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    valtype vch = stack.stacktop(-1);
    uint160 hash = Hash160(vch.begin(), vch.end());
    stack.pop_back();
    stack.push_back(std::vector<uint8_t>(hash.begin(), hash.end()));
} break;

// OP_SHA256
case OP_SHA256: {
    if (stack.size() < 1)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    valtype vch = stack.stacktop(-1);
    uint256 hash = Hash(vch.begin(), vch.end());
    stack.pop_back();
    stack.push_back(std::vector<uint8_t>(hash.begin(), hash.end()));
} break;

// OP_HASH160 - SHA256 + RIPEMD160
case OP_HASH160: {
    if (stack.size() < 1)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    valtype vch = stack.stacktop(-1);
    uint160 hash = Hash160(vch);
    stack.pop_back();
    stack.push_back(std::vector<uint8_t>(hash.begin(), hash.end()));
} break;

// OP_HASH256 - 双 SHA256
case OP_HASH256: {
    if (stack.size() < 1)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    valtype vch = stack.stacktop(-1);
    uint256 hash = Hash(vch.begin(), vch.end());
    stack.pop_back();
    stack.push_back(std::vector<uint8_t>(hash.begin(), hash.end()));
} break;
```

### 1.6 签名验证

```cpp
// OP_CHECKSIG
case OP_CHECKSIG: {
    if (stack.size() < 2)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    
    valtype vchSig = stack.stacktop(-2);
    valtype vchPubKey = stack.stacktop(-1);
    
    // 清空非标准签名（允许空签名失败）
    if (!IsValidSignatureEncoding(vchSig, flags, serror)) {
        return set_error(serror, SCRIPT_ERR_SIG_DER);
    }
    
    // 验证签名
    bool fSuccess = checker.CheckSig(vchSig, vchPubKey, scriptCode, 
                                     flags & SCRIPT_ENABLE_SIGHASH_FORKID);
    
    stack.pop_back();
    stack.pop_back();
    stack.push_back(fSuccess ? vchTrue : vchFalse);
    
    if (opcode == OP_CHECKSIGVERIFY) {
        if (fSuccess)
            stack.pop_back();
        else
            return set_error(serror, SCRIPT_ERR_CHECKSIGVERIFY);
    }
} break;

// OP_CHECKMULTISIG
case OP_CHECKMULTISIG:
case OP_CHECKMULTISIGVERIFY: {
    // 格式: <n> <pubkey1> ... <pubkeym> <m> <sig1> ... <sign>
    int i = 1;
    if ((int)stack.size() < i)
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    
    int nKeysCount = CScriptNum(stack.stacktop(-i), fRequireMinimal).getint();
    if (nKeysCount < 0 || nKeysCount > MAX_PUBKEYS_PER_MULTISIG)
        return set_error(serror, SCRIPT_ERR_PUBKEY_COUNT);
    
    // ... 验证逻辑
    
    // 尝试用每个签名匹配公钥
    int nSigsGood = 0;
    while (nSigsGood < nSigsCount) {
        // 如果所有签名都已验证，停止
        if (ikey == nKeysCount)
            break;
        
        // 验证签名
        if (checker.CheckSig(vchSig, vchPubKey, scriptCode, 
                            flags & SCRIPT_ENABLE_SIGHASH_FORKID)) {
            nSigsGood++;
        }
        ikey++;
    }
    
    bool fSuccess = nSigsGood >= nSigsCount;
    
    // ... 清理栈并返回结果
} break;
```

---

## 2. 高级脚本类型

### 2.1 P2PKH (Pay-to-PubKey-Hash)

```cpp
// 锁定脚本 (scriptPubKey)
OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG

// 解锁脚本 (scriptSig)
<sig> <pubkey>

// 执行流程:
// 1. <sig> 入栈
// 2. <pubkey> 入栈
// 3. OP_DUP: 复制 <pubkey>
// 4. OP_HASH160: 计算 pubkey 的 Hash160
// 5. <pubKeyHash> 入栈
// 6. OP_EQUALVERIFY: 比较两个哈希，不相等则失败
// 7. OP_CHECKSIG: 验证签名
```

### 2.2 P2SH (Pay-to-Script-Hash)

```cpp
// 锁定脚本
OP_HASH160 <scriptHash> OP_EQUAL

// 解锁脚本
<sig1> ... <sigN> <redeemScript>

// 执行流程:
// 第一阶段: 验证 redeemScript 哈希
// 1. 所有签名入栈
// 2. <redeemScript> 入栈
// 3. OP_HASH160: 计算 redeemScript 的 Hash160
// 4. <scriptHash> 入栈
// 5. OP_EQUAL: 比较哈希

// 第二阶段: 执行 redeemScript
// 将栈复制，用 redeemScript 替换脚本，重新执行
```

**P2SH 在 Genesis 后被禁用**:
```cpp
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
```

### 2.3 Multisig (多签名)

```cpp
// 锁定脚本
<m> <pubkey1> ... <pubkeyN> <n> OP_CHECKMULTISIG

// 解锁脚本
OP_0 <sig1> ... <sigM>

// 说明:
// - m: 需要的最少签名数
// - n: 公钥总数
// - OP_0: 由于历史 bug 需要的前导零

// Solver 验证
if (typeRet == TX_MULTISIG) {
    int m = CScriptNum(vSolutionsRet.front(), false).getint();
    int n = CScriptNum(vSolutionsRet.back(), false).getint();
    
    if (m < 1 || n < 1 || m > n || 
        vSolutionsRet.size() - 2 != static_cast<uint64_t>(n)) {
        return false;
    }
}
```

### 2.4 OP_RETURN (数据输出)

```cpp
// 锁定脚本
OP_RETURN <data>

// Genesis 前: 直接以 OP_RETURN 开头
// Genesis 后: OP_FALSE OP_RETURN 开头

// 检测逻辑
bool isOpReturn = false;
int offset = 0;

if (!genesisEnabled && scriptPubKey.size() > 0 && scriptPubKey[0] == OP_RETURN) {
    isOpReturn = true;
    offset = 1;
} else if (scriptPubKey.size() > 1 && 
           scriptPubKey[0] == OP_FALSE && 
           scriptPubKey[1] == OP_RETURN) {
    isOpReturn = true;
    offset = 2;
}

if (isOpReturn && scriptPubKey.IsPushOnly(scriptPubKey.begin() + offset)) {
    typeRet = TX_NULL_DATA;
    return true;
}
```

---

## 3. TBC 特有脚本功能

### 3.1 OP_PUSH_META (TBC 特有)

```cpp
case OP_PUSH_META: {
    // 确保栈中至少有一个元素
    if (stack.size() < 1) {
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION); 
    }
    
    // 获取栈顶元素
    LimitedVector &vch = stack.stacktop(-1);
    if (vch.size() != 1) {
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    }
    
    // 检查条件值范围 (1-7)
    if (vch[0] < 1 || vch[0] > 7) {
        return set_error(serror, SCRIPT_ERR_INVALID_STACK_OPERATION);
    }
    
    // 根据条件处理元数据
    // ...
} break;
```

### 3.2 Genesis 升级后的脚本变化

```cpp
// Genesis 后启用的操作码
// - OP_MUL, OP_DIV, OP_MOD
// - OP_LSHIFT, OP_RSHIFT
// - OP_CAT, OP_SPLIT, OP_NUM2BIN, OP_BIN2NUM
// - OP_AND, OP_OR, OP_XOR, OP_INVERT

// Genesis 后移除的限制
// - 脚本大小限制: 4GB
// - 操作码数量: 无限制
// - 栈元素大小: 无限制 (受内存限制)
// - 栈深度: 无限制

// 检查 Genesis 状态
const bool utxo_after_genesis = (flags & SCRIPT_UTXO_AFTER_GENESIS) != 0;
const uint64_t maxScriptNumLength = config.GetMaxScriptNumLength(
    utxo_after_genesis, consensus);

if (script.size() > config.GetMaxScriptSize(utxo_after_genesis, consensus)) {
    return set_error(serror, SCRIPT_ERR_SCRIPT_SIZE);
}
```

---

## 4. 脚本缓存机制

### 4.1 签名缓存 (CSignatureCache)

```cpp
class CSignatureCache {
private:
    uint256 nonce;  // 随机盐值
    map_type setValid;    // 有效签名缓存
    map_type setInvalid;  // 无效签名缓存
    boost::shared_mutex cs_sigcache;

public:
    // 计算缓存键
    template<typename PubKeyType>
    void ComputeEntry(uint256 &entry, const uint256 &hash,
                      const std::vector<uint8_t> &vchSig,
                      const PubKeyType &pubkey) {
        CSHA256()
            .Write(nonce.begin(), 32)
            .Write(hash.begin(), 32)
            .Write(pubkey.begin(), pubkey.size())
            .Write(&vchSig[0], vchSig.size())
            .Finalize(entry.begin());
    }
    
    // 检查缓存
    bool Get(const uint256 &entry, const bool erase) {
        boost::shared_lock<boost::shared_mutex> lock(cs_sigcache);
        return setValid.contains(entry, erase);
    }
    
    // 添加缓存
    void Set(uint256 &entry) {
        boost::unique_lock<boost::shared_mutex> lock(cs_sigcache);
        setValid.insert(entry);
    }
};

// 使用签名缓存
bool CachingTransactionSignatureChecker::VerifySignature(
    const std::vector<uint8_t> &vchSig, 
    const CPubKey &pubkey,
    const uint256 &sighash) const {
    
    uint256 entry;
    signatureCache.ComputeEntry(entry, sighash, vchSig, pubkey);
    
    // 检查缓存
    if (signatureCache.Get(entry, !store)) {
        return true;  // 缓存命中
    }
    
    // 验证签名
    if (!TransactionSignatureChecker::VerifySignature(vchSig, pubkey, sighash)) {
        signatureCache.SetInvalid(entry);
        return false;
    }
    
    // 加入缓存
    if (store) {
        signatureCache.Set(entry);
    }
    return true;
}
```

### 4.2 脚本执行缓存

```cpp
// 脚本执行结果缓存
std::mutex cs_script_cache;
static auto scriptExecutionCache =
    std::make_unique<CuckooCache::cache<uint256, SignatureCacheHasher>>();
static uint256 scriptExecutionCacheNonce(GetRandHash());

// 生成缓存键
uint256 GetScriptCacheKey(const CTransaction &tx, uint32_t flags) {
    uint256 key;
    CSHA256()
        .Write(scriptExecutionCacheNonce.begin(), 55 - sizeof(flags) - 32)
        .Write(tx.GetHash().begin(), 32)
        .Write((uint8_t *)&flags, sizeof(flags))
        .Finalize(key.begin());
    return key;
}

// 使用脚本缓存
bool CheckInputs(...) {
    // 计算缓存键
    uint256 scriptCacheKey = GetScriptCacheKey(tx, flags);
    
    // 检查缓存
    if (IsKeyInScriptCache(scriptCacheKey, false)) {
        return true;  // 缓存命中，跳过验证
    }
    
    // 执行脚本验证
    if (!VerifyScript(...)) {
        return false;
    }
    
    // 加入缓存
    AddKeyInScriptCache(scriptCacheKey);
    return true;
}
```

### 4.3 Cuckoo Cache 实现

```cpp
namespace CuckooCache {

// 位打包原子标志（用于垃圾回收）
class bit_packed_atomic_flags {
    std::unique_ptr<std::atomic<uint8_t>[]> mem;

public:
    // 设置标志
    inline void bit_set(uint32_t s) {
        mem[s >> 3].fetch_or(1 << (s & 7), std::memory_order_relaxed);
    }
    
    // 清除标志
    inline void bit_unset(uint32_t s) {
        mem[s >> 3].fetch_and(~(1 << (s & 7)), std::memory_order_relaxed);
    }
    
    // 检查标志
    inline bool bit_is_set(uint32_t s) const {
        return (1 << (s & 7)) & mem[s >> 3].load(std::memory_order_relaxed);
    }
};

// Cuckoo Cache 主类
template <typename Element, typename Hash> class cache {
private:
    std::vector<Element> table;           // 存储元素
    uint32_t size;                         // 表大小
    mutable bit_packed_atomic_flags collection_flags;  // 垃圾回收标志
    mutable std::vector<bool> epoch_flags; // 时代标志
    
public:
    // 插入元素
    inline bool insert(Element e) {
        // Cuckoo 哈希插入
        // 如果位置被占用，踢出旧元素并重新插入
        // ...
    }
    
    // 查找元素
    inline bool contains(Element e, bool erase) const {
        // 计算两个可能的哈希位置
        // 检查是否匹配
        // 如果 erase 为 true，标记为可删除
        // ...
    }
};

} // namespace CuckooCache
```

---

## 5. 脚本标志

### 5.1 脚本验证标志

```cpp
enum {
    // 基础验证
    SCRIPT_VERIFY_NONE = 0,
    SCRIPT_VERIFY_P2SH = (1U << 0),                    // P2SH 验证
    SCRIPT_VERIFY_STRICTENC = (1U << 1),               // 严格 DER 编码
    SCRIPT_VERIFY_DERSIG = (1U << 2),                  // 严格 DER 签名
    SCRIPT_VERIFY_LOW_S = (1U << 3),                   // 低 S 值签名
    SCRIPT_VERIFY_NULLDUMMY = (1U << 4),               // NULLDUMMY 检查
    SCRIPT_VERIFY_SIGPUSHONLY = (1U << 5),             // 仅压栈操作
    SCRIPT_VERIFY_MINIMALDATA = (1U << 6),             // 最小数据推送
    SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS = (1U << 7),  // 反对可升级 NOP
    
    // 高级功能
    SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY = (1U << 8),    // BIP65 CLTV
    SCRIPT_VERIFY_CHECKSEQUENCEVERIFY = (1U << 9),    // BIP112 CSV
    SCRIPT_VERIFY_MINIMALIF = (1U << 10),              // 最小 IF 数据
    SCRIPT_VERIFY_NULLFAIL = (1U << 11),               // NULLFAIL 要求
    SCRIPT_VERIFY_COMPRESSED_PUBKEYTYPE = (1U << 12), // 仅压缩公钥
    SCRIPT_ENABLE_SIGHASH_FORKID = (1U << 16),         // SIGHASH_FORKID
    // ⚠️ 修正：TBC 不存在 MONOLITH/MAGNETIC 标志
    SCRIPT_GENESIS = (1U << 18),                        // Genesis 规则激活
    SCRIPT_UTXO_AFTER_GENESIS = (1U << 19),            // Genesis 后 UTXO（注意是 bit 19 不是 20）
    SCRIPT_ENABLE_SCHNORR_MULTISIG = (1U << 20),       // Schnorr 多签
};
```

### 5.2 标准脚本标志

```cpp
uint32_t StandardScriptVerifyFlags(bool genesisEnabled, bool isUtxoAfterGenesis) {
    uint32_t flags = SCRIPT_VERIFY_P2SH;
    
    if (!genesisEnabled) {
        flags |= SCRIPT_VERIFY_STRICTENC;
        flags |= SCRIPT_VERIFY_DERSIG;
        flags |= SCRIPT_VERIFY_LOW_S;
        flags |= SCRIPT_VERIFY_NULLDUMMY;
        flags |= SCRIPT_VERIFY_MINIMALDATA;
        flags |= SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS;
        flags |= SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY;
        flags |= SCRIPT_VERIFY_CHECKSEQUENCEVERIFY;
        flags |= SCRIPT_VERIFY_MINIMALIF;
        flags |= SCRIPT_VERIFY_NULLFAIL;
        flags |= SCRIPT_ENABLE_SIGHASH_FORKID;
    } else {
        // Genesis 后启用新规则
        flags |= SCRIPT_GENESIS;
        flags |= SCRIPT_ENABLE_SCHNORR_MULTISIG;
    }
    
    if (isUtxoAfterGenesis) {
        flags |= SCRIPT_UTXO_AFTER_GENESIS;
    }
    
    return flags;
}
```

---

## 下一步

阶段三完成。接下来进入**阶段四：网络与P2P**，将学习：
1. 连接管理和节点发现
2. 消息广播机制
3. 带宽优化（紧凑区块）
4. 网络安全（DoS防护）
