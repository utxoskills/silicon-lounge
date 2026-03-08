# TBC (TuringBitChain) 节点代码总结

## 项目概述

**TuringBitChain (TBC)** 是比特币的侧链项目，基于 SHA256 POW + UTXO 模型，具备图灵完备的智能合约能力。

- **代码位置**: `tbc-node-code/`
- **总代码行数**: ~52,000 行 (C++)
- **许可证**: Open TBC License
- **GitHub**: https://github.com/TuringBitChain/TBCNODE

---

## 核心特性

### 1. 技术架构
| 特性 | 说明 |
|------|------|
| 共识机制 | SHA256 POW |
| 账户模型 | UTXO |
| 区块大小 | 最大 10GB (可配置) |
| 交易大小 | 最大 1GB (Genesis 后) |
| 脚本限制 | 无限制 (Genesis 后) |
| 堆栈内存 | 100MB 默认 |

### 2. TBC 特有创新
- **TuringTXID**: 创新的交易 ID 生成机制
- **TuringContract**: 图灵完备智能合约系统
- **数据裁剪能力**: 支持数据切割和扩展
- **Web3 应用支持**: 适合 DApp 开发部署

---

## 代码结构

### 目录组织
```
tbc-node-code/
├── src/                    # 核心源代码 (~165 个文件)
│   ├── script/            # 脚本系统 (操作码、解释器)
│   ├── rpc/               # RPC 接口
│   ├── consensus/         # 共识规则
│   ├── primitives/        # 基础数据结构 (交易、区块)
│   ├── wallet/            # 钱包功能
│   ├── net/               # 网络层
│   ├── crypto/            # 加密算法
│   ├── mining/            # 挖矿相关
│   ├── validation.cpp     # 区块/交易验证
│   ├── txmempool.cpp      # 内存池管理
│   └── bitcoind.cpp       # 主程序入口
├── test/                  # 测试代码
├── doc/                   # 文档
├── contrib/               # 辅助工具
├── depends/               # 依赖库
└── build-aux/             # 构建辅助
```

### 关键源文件

#### 核心组件
| 文件 | 功能 |
|------|------|
| `bitcoind.cpp` | 节点主程序入口 |
| `init.cpp` | 初始化逻辑 |
| `validation.cpp/h` | 区块验证、链管理 |
| `txmempool.cpp/h` | 交易内存池 |

#### 交易与脚本
| 文件 | 功能 |
|------|------|
| `primitives/transaction.h` | 交易结构定义 (CTransaction, CTxIn, CTxOut) |
| `script/interpreter.cpp/h` | 脚本解释器 |
| `script/opcodes.h` | 操作码定义 (OP_CAT, OP_SPLIT 等) |
| `script/script.cpp/h` | 脚本数据结构 |
| `script/limitedstack.cpp/h` | 脚本执行堆栈 |

#### 网络与RPC
| 文件 | 功能 |
|------|------|
| `rpc/server.cpp/h` | RPC 服务器 |
| `rpc/blockchain.cpp` | 区块链 RPC 接口 |
| `rpc/rawtransaction.cpp` | 原始交易 RPC |
| `net/` | P2P 网络实现 |

#### 加密与哈希
| 文件 | 功能 |
|------|------|
| `hash.cpp/h` | 哈希函数 (SHA256, RIPEMD160) |
| `crypto/` | 加密算法实现 |
| `uint256.cpp/h` | 256 位整数 |

---

## 脚本系统详解

### 操作码 (opcodes.h)
TBC 支持完整的比特币脚本操作码，包括：

**栈操作**: OP_DUP, OP_DROP, OP_SWAP, OP_ROT, OP_PICK, OP_ROLL  
**算术运算**: OP_ADD, OP_SUB, OP_MUL, OP_DIV, OP_MOD  
**位运算**: OP_AND, OP_OR, OP_XOR, OP_INVERT, OP_LSHIFT, OP_RSHIFT  
**加密**: OP_RIPEMD160, OP_SHA1, OP_SHA256, OP_HASH160, OP_HASH256  
**高级操作**: OP_CAT, OP_SPLIT, OP_NUM2BIN, OP_BIN2NUM (Monolith 升级后)  
**数据签名**: OP_CHECKDATASIG, OP_CHECKDATASIGVERIFY  
**TBC 特有**: OP_PUSH_META, OP_PARTIAL_HASH

### 脚本限制 (consensus/consensus.h)
```cpp
// Genesis 前
MAX_TX_SIZE_CONSENSUS_BEFORE_GENESIS = 1MB
MAX_OPS_PER_SCRIPT_BEFORE_GENESIS = 500
MAX_SCRIPT_SIZE_BEFORE_GENESIS = 10KB

// Genesis 后 (TBC 默认)
MAX_TX_SIZE_CONSENSUS_AFTER_GENESIS = 1GB
MAX_OPS_PER_SCRIPT_AFTER_GENESIS = UINT32_MAX
MAX_SCRIPT_SIZE_AFTER_GENESIS = UINT32_MAX
MAX_SCRIPT_NUM_LENGTH_AFTER_GENESIS = 750KB
```

---

## 交易结构

### CTransaction (primitives/transaction.h)
```cpp
class CTransaction {
    int32_t nVersion;           // 版本号
    std::vector<CTxIn> vin;     // 输入列表
    std::vector<CTxOut> vout;   // 输出列表
    uint32_t nLockTime;         // 锁定时间
}

class CTxIn {
    COutPoint prevout;          // 引用的 UTXO
    CScript scriptSig;          // 解锁脚本
    uint32_t nSequence;         // 序列号
}

class CTxOut {
    Amount nValue;              // 金额
    CScript scriptPubKey;       // 锁定脚本
}
```

---

## 构建与部署

### 依赖要求
- **Ubuntu**: build-essential, libtool, autotools-dev, cmake
- **Boost**: 1.74 (Ubuntu 24.04) 或 1.76 (Mac)
- **数据库**: Berkeley DB
- **内存**: 至少 1.5GB 编译内存

### 构建步骤
```bash
# 1. 初始化子模块
git submodule init
git submodule update

# 2. 创建构建目录
mkdir build && cd build
cmake ..

# 3. 编译
make -j$(nproc)
```

### 配置文件 (node.noprune.conf)
```ini
# 核心参数
excessiveblocksize=10000000000      # 10GB 最大区块
maxstackmemoryusageconsensus=100000000  # 100MB 堆栈
blockmaxsize=4000000000             # 4GB 挖矿区块
blockassembler=journaling           # 区块组装器

# 索引与内存
txindex=1                           # 交易索引
maxmempool=6000                     # 6GB 内存池
dbcache=1000                        # 1GB 数据库缓存

# RPC 配置
server=1
rpcuser=username
rpcpassword=randompasswd
rpcport=8332
```

---

## API 接口

### RPC 命令
- `getinfo` - 节点信息
- `getblockchaininfo` - 区块链状态
- `getpeerinfo` - 连接节点
- `getblock` - 获取区块
- `getrawtransaction` - 获取原始交易
- `sendrawtransaction` - 广播交易

### REST API (HTTP)
TBC 节点同时提供 HTTP REST API：
- `/rest/tx/<txid>` - 获取交易
- `/rest/block/<hash>` - 获取区块

---

## 安全注意事项

### 已知漏洞 (MEMORY.md 记录)
1. **OP_LSHIFT/OP_RSHIFT 循环 DoS** - 大数位移操作资源耗尽
2. **大数运算资源耗尽** - 超大整数计算导致 CPU 过载
3. **超大交易内存耗尽** - 大交易导致内存不足

### 安全建议
- 限制脚本执行资源
- 监控内存池大小
- 使用防火墙限制 RPC 访问
- 保持节点软件更新

---

## 与比特币核心差异

| 特性 | Bitcoin Core | TBC |
|------|--------------|-----|
| 区块大小 | 1-4MB | 最大 10GB |
| 交易大小 | ~100KB | 最大 1GB |
| 脚本限制 | 严格 | 几乎无限制 |
| 智能合约 | 有限 | 图灵完备 |
| 数据存储 | 有限 | 原生支持 |
| 侧链 | 不支持 | 比特币侧链 |

---

## 开发资源

### 文档
- `INSTALL.md` - 安装指南
- `doc/` - 开发文档
- `CONTRIBUTING.md` - 贡献指南

### 工具
- `bitcoin-cli` - RPC 客户端
- `bitcoin-tx` - 交易工具
- `bitcoin-miner` - 挖矿工具

---

## 总结

TBC 节点是一个功能完整的比特币侧链实现，主要特点：

1. **大区块支持**: 支持 GB 级区块和交易
2. **无限制脚本**: Genesis 升级后脚本几乎无限制
3. **图灵完备**: 支持复杂智能合约
4. **UTXO 模型**: 保持比特币的安全性和并行性
5. **Web3 就绪**: 适合大规模 DApp 部署

代码质量高，结构清晰，适合二次开发和定制。
