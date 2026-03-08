# TBC Trace - 快速开始

## 安装

```bash
cd projects/tbc-trace
pip install -e .
```

## 使用示例

### 1. 命令行工具

```bash
# 溯源单个交易
tbc-trace tx 24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927

# 限制深度
tbc-trace tx <txid> --max-depth 5

# 导出为 Graphviz
tbc-trace tx <txid> --format dot > trace.dot
dot -Tpng trace.dot -o trace.png
```

### 2. Python API

```python
import asyncio
from tbc_trace import TBCAPIClient, TBCTracer, TraceVisualizer

async def main():
    async with TBCAPIClient() as api:
        tracer = TBCTracer(api, max_depth=10)
        
        # 溯源交易
        result = await tracer.trace(
            "24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927"
        )
        
        # 打印结果
        TraceVisualizer.print_trace(result)
        
        # 获取统计
        print(f"总深度: {result.max_depth}")
        print(f"矿工来源: {len(result.coinbase_sources)}")
        print(f"总 TBC: {result.total_tbc}")

asyncio.run(main())
```

### 3. 识别交易类型

```python
from tbc_trace import TBCAPIClient, TxClassifier

async def check_type():
    async with TBCAPIClient() as api:
        tx_data = await api.decode_transaction("<txid>")
        tx_type = TxClassifier.classify(tx_data)
        print(f"交易类型: {tx_type.value}")
```

## 输出示例

```
============================================================
TBC 交易溯源报告
============================================================
目标交易: 24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927
交易类型: nft_collection
溯源深度: 3
涉及 TBC: 73.18613500
矿工来源: 1 个
============================================================

路径 1:
----------------------------------------
[2025-07-08 03:28:22] nft_collection (24e614...)
     └─ 73.18613500 TBC
  [2025-07-07 15:30:00] p2pkh (abc123...)
       └─ 150.50000000 TBC
    [2025-07-01 00:00:00] coinbase (def456...)
         └─ 6.25000000 TBC
```

## 项目结构

```
tbc-trace/
├── tbc_trace/
│   ├── __init__.py
│   ├── core.py          # 核心实现
│   ├── classifier.py    # 交易分类器
│   ├── api.py           # API 客户端
│   ├── tracer.py        # 溯源引擎
│   └── visualizer.py    # 可视化
├── tests/
├── examples/
└── README.md
```
