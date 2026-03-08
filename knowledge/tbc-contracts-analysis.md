# TBC 智能合约与节点技术深度解析

> 基于 TBCNODE 源代码分析
> 创建时间: 2026-03-04

---

## 一、TBC 项目概述

### 1.1 什么是 TuringBitChain

TuringBitChain (TBC) 是 **比特币的侧链**，核心创新包括：

- **TuringTXID**: 改进的交易 ID 机制
- **TuringContract**: 图灵完备智能合约
- **技术基础**: SHA256 POW + UTXO 模型
- **优势**: 更好的扩容能力、数据裁剪能力
- **目标**: 支持 Web3 应用开发和部署

### 1.2 与 Bitcoin SV 的关系

TBCNODE 基于 Bitcoin SV 代码库开发，文档中仍保留 BSV 相关引用。主要改进在智能合约能力上。

---

## 二、节点部署与配置

### 2.1 系统要求

**Ubuntu 22.04/24.04 LTS** 推荐配置：
- 内存: > 1.5GB (编译时)
- 磁盘: 根据数据量，支持裁剪模式
- 网络: 开放端口 8332 (RPC), 8333 (P2P)

### 2.2 关键配置参数

```conf
# 共识规则 (创世区块必需)
excessiveblocksize=10000000000      # 10GB 最大区块
maxstackmemoryusageconsensus=100000000  # 100MB 栈内存

# 挖矿配置
blockmaxsize=4000000000             # 4GB 挖矿区块大小
blockassembler=journaling           # 日志式区块组装

# 性能优化
preload=1                           # 预加载内存池
txindex=1                           # 交易索引
maxmempool=6000                     # 内存池大小 (MB)
dbcache=1000                        # 数据库缓存 (MB)
threadsperblock=6                   # 每区块线程数

# 网络
maxconnections=12                   # 最大连接数
server=1                            # 启用 RPC
rpcport=8332
```

### 2.3 部署方式

**方式一: 原生编译**
```bash
mkdir build && cd build
cmake ..
make -j$(nproc)
```

**方式二: Docker**
```bash
docker build -f Dockerfile-node -t bitcoin-node .
docker run -d --name bitcoin-node \
  -p 8332:8332 -p 8333:8333 \
  -v /path/to/data:/home/bitcoin/.bitcoin \
  bitcoin-node
```

**方式三: PM2 进程管理**
```bash
pm2 --name tbcd start "/path/to/bitcoind -conf=... -datadir=..."
```

---

## 三、脚本系统与智能合约

### 3.1 脚本基础

TBC 使用比特币脚本语言，核心文件：
- `src/script/interpreter.cpp/h` - 脚本解释器
- `src/script/opcodes.h` - 操作码定义
- `src/script/script.cpp/h` - 脚本数据结构

### 3.2 关键操作码

**数据操作**:
- `OP_0` - `OP_16`: 推送 0-16
- `OP_PUSHDATA1/2/4`: 变长数据推送

**算术运算** (大数支持):
- `OP_ADD`, `OP_SUB`, `OP_MUL`, `OP_DIV`
- `OP_MOD`, `OP_LSHIFT`, `OP_RSHIFT`
- `OP_BOOLAND`, `OP_BOOLOR`
- `OP_NUMEQUAL`, `OP_NUMNOTEQUAL`
- `OP_LESSTHAN`, `OP_GREATERTHAN`

**栈操作**:
- `OP_DUP`, `OP_DROP`, `OP_SWAP`
- `OP_PICK`, `OP_ROLL`, `OP_ROT`
- `OP_TOALTSTACK`, `OP_FROMALTSTACK`

**密码学**:
- `OP_RIPEMD160`, `OP_SHA1`, `OP_SHA256`
- `OP_HASH160`, `OP_HASH256`
- `OP_CHECKSIG`, `OP_CHECKMULTISIG`
- `OP_CHECKDATASIG`: 数据签名验证

**控制流**:
- `OP_IF`, `OP_NOTIF`, `OP_ELSE`, `OP_ENDIF`
- `OP_VERIFY`, `OP_RETURN`
- `OP_CHECKLOCKTIMEVERIFY` (CLTV)
- `OP_CHECKSEQUENCEVERIFY` (CSV)

### 3.3 大数支持 (Big Numbers)

**关键改进**: 移除 4 字节数字限制

- **Genesis 前**: 数字限制 4 字节 (int32 范围)
- **Genesis 后**: 支持任意精度大数
- **实现**: 使用 OpenSSL BN 库
- **兼容性**: 硬分叉后新交易使用大数语义

**代码实现**: `src/script/script_num.cpp/h`

### 3.4 智能合约能力

TBC 通过以下特性实现图灵完备：

1. **无限制脚本大小**: 支持复杂合约逻辑
2. **大数运算**: 支持加密算法实现
3. **OP_CHECKDATASIG**: 支持预言机数据验证
4. **UTXO 模型**: 状态通过 UTXO 传递

---

## 四、交易与验证

### 4.1 交易结构

```cpp
class CTransaction {
    int32_t nVersion;
    std::vector<CTxIn> vin;      // 输入
    std::vector<CTxOut> vout;    // 输出
    uint32_t nLockTime;
};
```

### 4.2 签名验证

**支持算法**:
- ECDSA (传统)
- Schnorr (更高效)

**签名哈希类型**:
- SIGHASH_ALL
- SIGHASH_NONE
- SIGHASH_SINGLE
- SIGHASH_ANYONECANPAY

### 4.3 TuringTXID

TBC 特有的交易 ID 计算方式，在 `src/hash.h` 中实现：
- 改进的序列化哈希
- 更好的交易唯一性保证

---

## 五、RPC 接口

### 5.1 常用命令

```bash
# 节点信息
tbc-cli getinfo
tbc-cli getblockchaininfo
tbc-cli getpeerinfo

# 钱包
tbc-cli listwallets
tbc-cli listaccounts
tbc-cli getaddressesbyaccount

# 区块
tbc-cli getblockcount
tbc-cli getblockhash <height>
tbc-cli getblock <hash>

# 交易
tbc-cli getrawtransaction <txid>
tbc-cli sendrawtransaction <hex>

# 停止节点
tbc-cli stop
```

---

## 六、高级特性

### 6.1 数据裁剪 (Pruning)

```conf
# 裁剪模式配置
prune=196000  # 保留最近 196000 个区块
```

注意: 裁剪模式不支持 `txindex`

### 6.2 内存池管理

- `maxmempool`: 内存池大小限制
- `preload=1`: 启动时预加载
- 交易优先级和费率计算

### 6.3 区块组装策略

- `blockassembler=journaling`: 日志式组装 (默认)
- 支持大区块 (最大 4GB 挖矿)

---

## 七、开发注意事项

### 7.1 共识规则

- 必须设置 `excessiveblocksize` 和 `maxstackmemoryusageconsensus`
- 创世区块后交易使用大数语义
- 脚本大小和运算限制已大幅放宽

### 7.2 安全性

- RPC 默认只监听本地
- 密码通过 `rpcauth` 或 `rpcpassword` 设置
- 生产环境不建议开放 RPC 到公网

### 7.3 调试

```bash
# 独立模式测试
bitcoind -standalone -conf=... -datadir=...

# 查看日志
docker logs -f bitcoin-node
```

---

## 八、学习资源

### 8.1 本地文档

- `tbc-node-code/README.md` - 项目概述
- `tbc-node-code/INSTALL.md` - 安装指南
- `tbc-node-code/doc/` - 详细文档
- `trading-techniques.md` - 交易技术

### 8.2 外部资源

- Bitcoin SV Wiki: https://wiki.bitcoinsv.io/
- GitHub Issues: https://github.com/TuringBitChain/TBCNODE/issues

---

## 九、待深入学习

- [ ] TBC 特有的智能合约示例
- [ ] Token 发行合约 (FT/NFT)
- [ ] 与 BNB/ETH/SOL 合约的对比
- [ ] 实际部署测试

---

*持续更新中...*
