# TBC技术学习总览 - 2026-03-04

## 学习进度

### 已完成 ✅
1. **FT合约深度分析** - 完成
   - 铸造、转账、合并逻辑
   - UTXO模型实现
   - 脚本构建方法
   
2. **NFT合约分析** - 进行中
   - 集合创建
   - NFT铸造
   - 转账机制

3. **PoolNFT合约** - 已掌握核心
   - 带锁/无锁检测
   - 流动性池监控

4. **打狗程序** - 已完成并运行
   - 后台监控589个Pool
   - Telegram实时通知

### 待学习 📚
- [ ] TBC节点源码 (tbc-node-code)
- [ ] PoW共识实现
- [ ] 难度调整算法 (DAA)
- [ ] P2P网络协议
- [ ] 区块验证逻辑

### 主流链学习计划
1. **BNB/BSC** - EVM兼容链
2. **ETH** - 已完成基础
3. **SOL** - 用户要求暂缓
4. **BSV** - 比特币SV

---

## 核心技术洞察

### TBC独特设计
1. **UTXO + 智能合约**: 比特币的UTXO模型 + 图灵完备合约
2. **JavaScript合约**: 使用TypeScript/JavaScript编写智能合约
3. **Partial SHA256**: 大脚本优化，只hash部分数据
4. **Tape脚本**: 数据存储与代码分离

### FT vs NFT差异
| 特性 | FT | NFT |
|------|-----|-----|
| 标准 | ERC-20类似 | ERC-721类似 |
| 精度 | 支持decimal (1-18) | 无精度 |
| 金额存储 | 6个uint64LE槽位 | 单一定值 |
| 脚本长度 | ~1500-1900 bytes | 变化较大 |
| 转账 | 可多输入合并 | 单输入单输出 |

### 打狗策略要点
1. **监控目标**: 新Pool创建 (1小时内)
2. **预警条件**: TBC余额 > 1000
3. **锁检测**: 通过字节码特征识别
4. **当前状态**: 589个Pool全部无锁

---

## 技术文档索引

| 文档 | 路径 | 状态 |
|------|------|------|
| TBC概览 | `knowledge/tbc-turingbitchain.md` | ✅ |
| TBC深度分析 | `knowledge/tbc-deep-dive.md` | ✅ |
| PoW共识 | `knowledge/tbc-consensus-pow.md` | ✅ |
| 合约分析 | `knowledge/tbc-contracts-analysis.md` | ✅ |
| 转账指南 | `knowledge/tbc-transfer-complete-guide.md` | ✅ |
| FT-Pool关系 | `knowledge/tbc-ft-pool-relationship.md` | ✅ |
| FT合约深度 | `knowledge/tbc-ft-contract-deep-dive.md` | ✅ |

---

## 监控程序状态

**进程**: `node index.js` (PID: 22805)  
**日志**: `dog-hunter/dog-hunter.log`  
**配置**:
- 扫描间隔: 30秒
- 监控间隔: 5秒
- 预警阈值: 1000 TBC
- Telegram通知: 已启用

**当前监控**: 589个Pool，全部无锁

---

## 下一步计划

由于API即将到期，优先完成：
1. 整理现有学习成果
2. 完成NFT合约文档
3. 学习TBC节点共识代码
4. 准备学习其他主流链

**长期目标**: 掌握多链技术，开发跨链监控和交易工具
