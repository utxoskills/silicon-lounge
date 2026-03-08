# 以太坊技术知识库

## 1. 基础概念 (Foundational Topics)

### 1.1 以太坊简介 (Intro to Ethereum)
- 以太坊是一个去中心化的全球计算机
- 支持智能合约和去中心化应用（DApps）
- 使用ETH作为燃料费（Gas）

### 1.2 账户系统 (Accounts)
**两种账户类型**:
1. **外部拥有账户 (EOA)** - 由私钥控制，用户钱包
2. **合约账户 (Contract)** - 由代码控制，智能合约

**账户组成**:
- 地址 (Address): 42位十六进制字符串
- 余额 (Balance): ETH数量
- 交易计数 (Nonce): 防止重放攻击
- 存储 (Storage): 合约数据

### 1.3 交易 (Transactions)
**交易类型**:
1. 转账交易 - ETH转账
2. 合约创建 - 部署智能合约
3. 合约调用 - 调用合约函数

**交易结构**:
- from: 发送方地址
- to: 接收方地址
- value: 转账金额
- gas: 燃料限制
- gasPrice: 燃料价格
- data: 合约数据

### 1.4 区块 (Blocks)
- 区块是交易的集合
- 包含区块头、交易列表、叔块列表
- 平均每12秒出一个块

### 1.5 EVM (以太坊虚拟机)
- 以太坊的运行环境
- 执行智能合约代码
- 图灵完备

### 1.6 Gas机制
**Gas的作用**:
- 防止无限循环和垃圾交易
- 奖励矿工/验证者
- 调节网络拥堵

**Gas费用计算**:
```
总费用 = Gas Used × Gas Price
```

**EIP-1559后的Gas结构**:
- Base Fee: 基础费用，会被销毁
- Priority Fee: 小费，给矿工
- Max Fee: 用户愿意支付的最高费用

### 1.7 节点和客户端 (Nodes and Clients)
**节点类型**:
1. **全节点 (Full Node)** - 存储完整区块链
2. **轻节点 (Light Client)** - 只存储区块头
3. **归档节点 (Archive Node)** - 存储所有历史状态

**主要客户端**:
- Geth (Go语言)
- Nethermind (C#)
- Besu (Java)
- Erigon (Go)

### 1.8 共识机制 (Consensus Mechanisms)
**PoW (工作量证明)** - 以太坊1.0使用
- 矿工通过算力竞争出块
- 能源消耗大

**PoS (权益证明)** - 以太坊2.0使用
- 验证者质押32 ETH
- 能源效率高
- 随机选择验证者出块

---

## 2. 以太坊技术栈 (Ethereum Stack)

### 2.1 智能合约 (Smart Contracts)
**定义**: 部署在区块链上的自动执行程序

**特点**:
- 不可篡改
- 透明公开
- 自动执行
- 去中心化

**开发语言**:
- Solidity (最主流)
- Vyper (Python风格)
- Yul (底层)

**开发流程**:
1. 编写合约代码
2. 编译为字节码
3. 部署到网络
4. 调用合约函数

### 2.2 开发框架
**Hardhat**:
- 最流行的开发环境
- 支持TypeScript
- 强大的插件系统

**Foundry**:
- 快速、模块化的工具包
- 使用Solidity编写测试
- 性能优秀

**Truffle**:
- 老牌框架
- 功能全面
- 社区成熟

### 2.3 客户端API
**Web3.js**: JavaScript库，前端与区块链交互
**Ethers.js**: 更轻量级的JavaScript库
**Web3.py**: Python库

### 2.4 数据存储
**链上存储**:
- 昂贵但不可篡改
- 适合关键数据

**链下存储**:
- IPFS: 去中心化文件存储
- Arweave: 永久存储
- The Graph: 索引协议

---

## 3. 高级主题 (Advanced)

### 3.1 Layer 2 扩容方案
**为什么需要Layer 2**:
- 以太坊主网吞吐量有限（~15 TPS）
- Gas费用高
- 需要扩容解决方案

**主要方案**:

**Optimistic Rollups (乐观rollup)**:
- Arbitrum, Optimism
- 假设交易有效，欺诈证明机制
- 兼容EVM

**ZK Rollups (零知识rollup)**:
- zkSync, StarkNet
- 使用零知识证明验证
- 更高的安全性

**State Channels (状态通道)**:
- 链下交易，链上结算
- 适合高频小额交易

**Sidechains (侧链)**:
- 独立的区块链
- 通过桥接与主网连接

### 3.2 MEV (最大可提取价值)
**定义**: 矿工/验证者通过重新排序、插入交易获得的额外价值

**MEV类型**:
- 套利 (Arbitrage)
- 清算 (Liquidation)
- 三明治攻击 (Sandwich Attack)

**解决方案**:
- Flashbots: MEV拍卖机制
- 隐私交易

### 3.3 预言机 (Oracles)
**作用**: 将链下数据引入链上

**主要项目**:
- Chainlink: 去中心化预言机网络
- Band Protocol
- API3

### 3.4 跨链桥 (Bridges)
**作用**: 在不同区块链之间转移资产

**类型**:
- 托管桥: 中心化托管
- 非托管桥: 智能合约控制

**风险**:
- 智能合约漏洞
- 中心化风险

---

## 4. 代币标准 (Token Standards)

### 4.1 ERC-20 (同质化代币)
**标准接口**:
```solidity
function totalSupply() view returns (uint256)
function balanceOf(address account) view returns (uint256)
function transfer(address recipient, uint256 amount) returns (bool)
function allowance(address owner, address spender) view returns (uint256)
function approve(address spender, uint256 amount) returns (bool)
function transferFrom(address sender, address recipient, uint256 amount) returns (bool)
```

**应用场景**:
- 治理代币
- 实用代币
- 稳定币

### 4.2 ERC-721 (非同质化代币 - NFT)
**特点**:
- 每个代币独一无二
- 不可分割

**应用场景**:
- 数字艺术品
- 游戏道具
- 身份凭证

### 4.3 ERC-1155 (多代币标准)
**特点**:
- 同时支持同质化和非同质化
- 批量转账
- Gas效率高

---

## 5. 安全最佳实践

### 5.1 常见漏洞
1. **重入攻击 (Reentrancy)**
   - 解决方案: Checks-Effects-Interactions模式

2. **整数溢出/下溢**
   - 解决方案: 使用SafeMath库或Solidity 0.8+

3. **访问控制**
   - 解决方案: OpenZeppelin的Ownable

4. **前端运行 (Front-running)**
   - 解决方案: 提交-揭示模式

### 5.2 安全工具
- Slither: 静态分析
- MythX: 安全分析
- Echidna: 模糊测试

---

## 6. 学习资源

### 官方文档
- Ethereum.org: https://ethereum.org/developers/
- Solidity文档: https://docs.soliditylang.org/

### 开发工具
- Hardhat: https://hardhat.org/
- Foundry: https://book.getfoundry.sh/
- OpenZeppelin: https://openzeppelin.com/

### 社区
- Ethereum Stack Exchange
- r/ethdev
- Discord服务器

---

*学习时间: 2026-03-03 23:09 CST*
*来源: Ethereum.org Developers Documentation*
*下次更新: 继续学习其他链的技术*
