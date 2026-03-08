# TBC节点共识机制学习笔记

**学习时间:** 2026-03-04  
**源码路径:** `/Users/jay/.openclaw/workspace/tbc-node-code/src/consensus/`

---

## 1. 共识参数 (consensus.h)

### 1.1 区块大小限制
```cpp
// Genesis前: 1MB
static const uint64_t LEGACY_MAX_BLOCK_SIZE = ONE_MEGABYTE;

// Genesis后: 最大4GB (受P2P消息大小限制)
static const uint64_t MAX_SCRIPT_SIZE_AFTER_GENESIS = UINT32_MAX;
```

### 1.2 交易大小限制
```cpp
// Genesis前: 1MB
static const uint64_t MAX_TX_SIZE_CONSENSUS_BEFORE_GENESIS = ONE_MEGABYTE;

// Genesis后: 1GB
static const uint64_t MAX_TX_SIZE_CONSENSUS_AFTER_GENESIS = ONE_GIGABYTE;
```

### 1.3 脚本操作限制
```cpp
// Genesis前: 500个操作
static const uint64_t MAX_OPS_PER_SCRIPT_BEFORE_GENESIS = 500;

// Genesis后: 无限制 (uint32_max)
static const uint64_t MAX_OPS_PER_SCRIPT_AFTER_GENESIS = UINT32_MAX;

// 脚本长度: Genesis前10KB → 后4GB
static const uint64_t MAX_SCRIPT_SIZE_BEFORE_GENESIS = 10000;
static const uint64_t MAX_SCRIPT_SIZE_AFTER_GENESIS = UINT32_MAX;
```

### 1.4 签名操作限制
```cpp
// 每MB区块最多20000个签名检查
static const uint64_t MAX_BLOCK_SIGOPS_PER_MB_BEFORE_GENESIS = 20000;

// 每笔交易最多20000个签名检查
static const uint64_t MAX_TX_SIGOPS_COUNT = 20000;
```

### 1.5 Coinbase成熟度
```cpp
// Coinbase输出可以在1个区块后花费 (比特币是100个)
static const int COINBASE_MATURITY = 1;
```

---

## 2. TBC与比特币的关键差异

| 参数 | 比特币 | TBC |
|------|--------|-----|
| 区块大小 | 1MB (SegWit后4MB) | Genesis后无限制 (4GB) |
| 脚本操作数 | 201个 | Genesis后无限制 |
| 脚本长度 | 10KB | Genesis后4GB |
| 多签公钥数 | 15个 | Genesis后无限制 |
| Coinbase成熟 | 100区块 | 1区块 |
| 智能合约 | 有限 | 完整图灵完备 |

---

## 3. Genesis升级

TBC在Genesis升级后移除了大量限制，实现了：
1. **无限制区块大小**
2. **无限制脚本复杂度**
3. **完整智能合约支持**
4. **低手续费** (1 satoshi/byte)

---

## 4. 待深入学习

- [ ] 难度调整算法 (DAA)
- [ ] PoW挖矿实现
- [ ] 区块验证逻辑
- [ ] 交易内存池管理
- [ ] P2P网络协议

---

## 5. 学习资源

- 源码: `/Users/jay/.openclaw/workspace/tbc-node-code/`
- 合约代码: `/Users/jay/.openclaw/workspace/tbc-contract-code/`
- API文档: https://www.showdoc.com.cn/2598842292642718/
