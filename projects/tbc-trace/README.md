# TBC 交易溯源软件方案

## 1. 项目概述

### 1.1 核心目标
构建一个能够从矿工奖励开始，追踪任意 TBC 交易完整资金来源链路的分析工具。

### 1.2 核心洞察
- TBC 原生代币只能通过 **矿工挖矿** 产生
- 所有非挖矿交易的 TBC 最终都可追溯到某个 **Coinbase 交易（矿工奖励）**
- 交易链路中可能包含：普通转账、FT 交易、NFT 交易、Pool 交易等多种类型

---

## 2. 技术架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      TBC Trace System                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   API Layer  │  │  Parser Core │  │  Graph Engine│      │
│  │  (TBC API)   │  │ (Tx Decoder) │  │(Neo4j/Graph) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           │                                │
│                    ┌──────┴──────┐                        │
│                    │  Trace Core │                        │
│                    │  Engine     │                        │
│                    └──────┬──────┘                        │
│                           │                                │
│         ┌─────────────────┼─────────────────┐              │
│         ▼                 ▼                 ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Path Finder  │  │  Tx Analyzer │  │  Visualizer  │      │
│  │ (溯源算法)    │  │ (合约解析)    │  │ (可视化展示)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块

| 模块 | 职责 | 关键技术 |
|------|------|---------|
| `API Client` | 与 TBC 节点/API 交互 | REST API, 批量请求 |
| `Tx Decoder` | 解析交易结构，识别类型 | 合约脚本解析 |
| `Trace Engine` | 递归追踪 UTXO 来源 | 图遍历算法 |
| `Graph DB` | 存储交易关系 | Neo4j / 内存图 |
| `Analyzer` | 分析交易路径特征 | 规则引擎 |
| `Visualizer` | 生成可视化报告 | D3.js / Graphviz |

---

## 3. 交易类型识别体系

### 3.1 TBC 交易类型分类

```
TBC Transaction
├── Coinbase (矿工奖励)
│   └── 溯源终点
│
├── P2PKH (普通转账)
│   ├── 标准转账
│   └── 找零输出
│
├── FT (同质化代币)
│   ├── FT Transfer (转账)
│   ├── FT Mint (铸造)
│   ├── FT Merge (合并)
│   └── FT Swap (兑换)
│
├── NFT (非同质化代币)
│   ├── NFT Mint (铸造)
│   ├── NFT Transfer (转账)
│   └── NFT Collection Create (集合创建)
│
├── Pool (流动性池)
│   ├── Create Pool (创建池子)
│   ├── Init Pool (初始化)
│   ├── Add LP (添加流动性)
│   ├── Remove LP (移除流动性)
│   ├── Swap TBC→FT
│   └── Swap FT→TBC
│
└── OP_RETURN (数据输出)
    └── 忽略（无资金流动）
```

### 3.2 交易识别规则

| 类型 | 识别特征 | 关键字段 |
|------|---------|---------|
| Coinbase | vin 为空，vout[0] 是矿工奖励 | `vin: []` |
| P2PKH | 标准 P2PKH 脚本 | `OP_DUP OP_HASH160 ... OP_EQUALVERIFY OP_CHECKSIG` |
| FT Transfer | 包含 FTape 标记 | `OP_RETURN "FTape"` + 合约脚本 |
| FT Mint | 包含 2Code + FTape | `4654...` + `3243...` |
| NFT Mint | 包含 NTape + Mint NHold | `OP_RETURN "NTape"` + `Mint NHold` |
| Pool Create | Pool NFT 脚本 + LP 代币 | `poolnft_code` + `ftlp_code` |
| Pool Swap | Pool NFT 状态变化 | 输入输出包含 Pool NFT |

---

## 4. 溯源算法设计

### 4.1 核心算法：递归 UTXO 追踪

```python
class TBCTracer:
    def trace_transaction(self, txid: str, target_vout: int = None) -> TraceResult:
        """
        追踪交易的完整资金来源
        
        Args:
            txid: 交易哈希
            target_vout: 特定输出索引（可选）
            
        Returns:
            TraceResult: 包含完整溯源路径的结果
        """
        pass
    
    def _trace_utxo(self, txid: str, vout: int, depth: int) -> UTXONode:
        """
        递归追踪单个 UTXO 的来源
        
        终止条件：
        1. 到达 Coinbase 交易（矿工奖励）
        2. 超过最大追踪深度
        3. 遇到无法解析的交易类型
        """
        pass
    
    def _classify_transaction(self, tx: Transaction) -> TxType:
        """
        识别交易类型
        """
        pass
```

### 4.2 追踪流程

```
开始
  │
  ▼
获取交易详情 (API/decode)
  │
  ▼
解析交易类型 (Classifier)
  │
  ├──► Coinbase → 终点（矿工奖励）
  │
  ├──► P2PKH → 追踪 vin[0] 的来源
  │
  ├──► FT/NFT → 追踪 TBC 输入的来源
  │              （FT 代币本身不追踪，只追踪 TBC 部分）
  │
  ├──► Pool → 追踪 Pool 创建交易的 TBC 来源
  │           + 追踪 LP 代币的流转
  │
  └──► 其他 → 标记为未知，尝试通用追踪
  │
  ▼
递归追踪每个输入
  │
  ▼
构建溯源图
  │
  ▼
分析路径特征
  │
  ▼
生成报告
```

### 4.3 关键规则

1. **只追踪 TBC 原生代币**：FT、NFT、LP 代币不进入溯源链
2. **Coinbase 是终点**：矿工奖励是 TBC 的终极来源
3. **处理找零**：识别并追踪找零输出的来源
4. **处理多输入**：一个交易可能有多个资金来源，全部追踪

---

## 5. 数据结构

### 5.1 核心数据模型

```typescript
// 交易节点
interface TxNode {
  txid: string;
  type: TxType;
  timestamp: number;
  blockHeight: number;
  inputs: UTXORef[];
  outputs: Output[];
  metadata: TxMetadata;
}

// UTXO 引用
interface UTXORef {
  txid: string;
  vout: number;
  value: number;  // TBC 数量
  address: string;
}

// 溯源路径
interface TracePath {
  target: UTXORef;           // 目标 UTXO
  sources: SourceNode[];     // 资金来源列表
  depth: number;             // 溯源深度
  totalValue: number;        // 总价值
  coinbaseSources: number;   // 来自矿工奖励的数量
}

// 溯源结果
interface TraceResult {
  targetTxid: string;
  paths: TracePath[];
  graph: TransactionGraph;
  statistics: TraceStats;
  visualization: GraphData;
}
```

### 5.2 图数据库 Schema (Neo4j)

```cypher
// 交易节点
CREATE (t:Transaction {
  txid: string,
  type: string,
  timestamp: datetime,
  blockHeight: integer
})

// 地址节点
CREATE (a:Address {
  address: string,
  type: string  // P2PKH, Contract, etc.
})

// UTXO 节点
CREATE (u:UTXO {
  txid: string,
  vout: integer,
  value: float,
  spent: boolean
})

// 关系
(t:Transaction)-[:INPUT]->(u:UTXO)
(t:Transaction)-[:OUTPUT]->(u:UTXO)
(u:UTXO)-[:BELONGS_TO]->(a:Address)
(u:UTXO)-[:SPENT_IN]->(t:Transaction)
```

---

## 6. API 接口设计

### 6.1 核心 API

```python
# 1. 单交易溯源
POST /api/v1/trace/transaction
{
  "txid": "24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927",
  "depth": 10,           // 最大追踪深度
  "includeGraph": true   // 是否返回图数据
}

# 2. 地址资金分析
POST /api/v1/trace/address
{
  "address": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
  "timeRange": ["2025-01-01", "2025-12-31"]
}

# 3. 批量溯源
POST /api/v1/trace/batch
{
  "txids": ["txid1", "txid2", ...],
  "concurrency": 5
}
```

### 6.2 响应格式

```json
{
  "success": true,
  "data": {
    "targetTxid": "24e614...",
    "targetType": "NFT_COLLECTION_CREATE",
    "totalPaths": 1,
    "maxDepth": 3,
    "paths": [
      {
        "pathId": "path-1",
        "value": 73.186135,
        "depth": 3,
        "nodes": [
          {
            "txid": "24e614...",
            "type": "NFT_COLLECTION_CREATE",
            "timestamp": "2025-07-08T03:28:22Z",
            "value": 73.186135
          },
          {
            "txid": "abc123...",
            "type": "P2PKH",
            "timestamp": "2025-07-07T15:30:00Z",
            "value": 150.5
          },
          {
            "txid": "def456...",
            "type": "COINBASE",
            "timestamp": "2025-07-01T00:00:00Z",
            "value": 6.25,
            "miner": "Unknown Miner"
          }
        ]
      }
    ],
    "statistics": {
      "totalTBC": 73.186135,
      "fromCoinbase": 73.186135,
      "fromTransfers": 0,
      "uniqueMiners": 1
    }
  }
}
```

---

## 7. 实现路线图

### Phase 1: 基础框架 (2周)
- [ ] TBC API 客户端封装
- [ ] 交易解码器（基础类型）
- [ ] 简单的递归追踪算法
- [ ] 命令行工具

### Phase 2: 合约识别 (2周)
- [ ] FT 交易解析
- [ ] NFT 交易解析
- [ ] Pool 交易解析
- [ ] 交易类型分类器

### Phase 3: 图数据库 (2周)
- [ ] Neo4j 集成
- [ ] 交易关系建模
- [ ] 批量导入工具
- [ ] 图查询接口

### Phase 4: 可视化 (1周)
- [ ] 溯源路径可视化
- [ ] 交互式探索界面
- [ ] 报告生成

### Phase 5: 优化 (1周)
- [ ] 缓存机制
- [ ] 并行追踪
- [ ] 性能优化

---

## 8. 关键技术挑战

### 8.1 挑战 1: 交易类型识别
**问题**: TBC 合约脚本复杂，如何准确识别交易类型？
**方案**: 
- 建立特征码库（FTape, NTape, Pool NFT 等）
- 多层级匹配：先匹配 OP_RETURN，再分析脚本结构
- 参考 `tbc-dev` skill 中的合约定义

### 8.2 挑战 2: 溯源深度控制
**问题**: 复杂交易链路可能非常深，如何避免无限递归？
**方案**:
- 设置最大深度限制（默认 10）
- 循环检测（避免环形依赖）
- 缓存已追踪的交易

### 8.3 挑战 3: 性能优化
**问题**: 大量 API 请求可能导致性能瓶颈
**方案**:
- 批量请求 API
- 本地缓存交易数据
- 异步并行处理

### 8.4 挑战 4: Pool 交易处理
**问题**: Pool 交易涉及多个资产（TBC + FT + LP），如何追踪？
**方案**:
- 只追踪 TBC 部分
- LP 代币视为"凭证"，记录但不深入追踪
- Pool 创建交易作为特殊节点标记

---

## 9. 使用示例

### 示例 1: NFT 铸造交易溯源

```bash
$ tbc-trace tx 24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927

[2025-07-08 03:28:22] NFT_COLLECTION_CREATE (24e614...)
  └─ 73.186135 TBC from 1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx
      └─ [2025-07-07 15:30:00] P2PKH (abc123...)
          └─ 150.5 TBC from 1XYZ...
              └─ [2025-07-01 00:00:00] COINBASE (def456...)
                  └─ 6.25 TBC (Miner: Unknown)

溯源结果:
- 总深度: 3 层
- 资金来源: 矿工奖励 (Coinbase)
- 矿工: Unknown Miner
- 时间跨度: 7 天
```

### 示例 2: Pool 交易溯源

```bash
$ tbc-trace tx <pool-tx-id> --show-lp

[Pool Create Transaction]
├─ TBC Input: 500 TBC
│   └─ ...追溯至 Coinbase
├─ FT Input: 1000 USDT
│   └─ ...追溯至 FT Mint
└─ LP Output: 500 LP-Token
    └─ 持有者: 0x...
```

---

## 10. 扩展功能

### 10.1 未来规划

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 实时追踪 | 监听新区块，自动追踪 | P2 |
| 地址画像 | 分析地址交易模式 | P2 |
| 风险评分 | 识别可疑交易链路 | P3 |
| 跨链追踪 | 追踪桥接交易 | P3 |
| 可视化大屏 | 实时展示资金流向 | P3 |

---

## 11. 参考资源

- TBC API 文档: `knowledge/tbc-api-complete.md`
- TBC 合约分析: `tbc-dev` skill
- Pool 合约详解: `knowledge/tbc-ft-pool-relationship.md`
- 交易类型参考: `memory/research/` 中的交易分析报告

---

*文档版本: 1.0*
*创建时间: 2026-03-05*
*作者: AI Assistant*
