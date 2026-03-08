# TBC 智能溯源可视化引擎

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum
from datetime import datetime

class TxType(Enum):
    COINBASE = "Coinbase"
    P2PKH = "P2PKH"
    FT_TRANSFER = "FT_Transfer"
    FT_MINT = "FT_Mint"
    FT_MERGE = "FT_Merge"
    NFT_MINT = "NFT_Mint"
    NFT_TRANSFER = "NFT_Transfer"
    POOL_SWAP = "Pool_Swap"
    UNKNOWN = "Unknown"

class AssetType(Enum):
    TBC = "TBC"
    FT = "FT"
    NFT = "NFT"

@dataclass
class UTXO:
    txid: str
    vout: int
    asset_type: AssetType = AssetType.TBC
    value: float = 0.0

@dataclass
class TraceNode:
    txid: str
    tx_type: TxType
    depth: int
    utxo: UTXO
    block_height: Optional[int] = None

@dataclass
class TracePath:
    path_id: int
    asset_type: AssetType
    nodes: List[TraceNode] = field(default_factory=list)

class GraphvizGenerator:
    """生成 UML 活动图风格的溯源图"""
    
    COLORS = {
        TxType.COINBASE: "#FFD700",
        TxType.P2PKH: "#87CEEB",
        TxType.FT_TRANSFER: "#98FB98",
        TxType.FT_MINT: "#90EE90",
        TxType.FT_MERGE: "#3CB371",
        TxType.NFT_MINT: "#FFB6C1",
        TxType.NFT_TRANSFER: "#FF69B4",
        TxType.POOL_SWAP: "#9370DB",
        TxType.UNKNOWN: "#D3D3D3",
    }
    
    def generate(self, target_txid: str, target_type: TxType, paths: List[TracePath]) -> str:
        lines = []
        lines.append("digraph TBC_Trace {")
        lines.append("    rankdir=TB;")
        lines.append("    node [shape=box, style=\"rounded,filled\", fontname=\"Arial\", fontsize=9];")
        lines.append("    edge [fontname=\"Arial\", fontsize=8];")
        lines.append("")
        
        # 收集所有节点
        all_nodes = {}
        for path in paths:
            for node in path.nodes:
                if node.txid not in all_nodes:
                    all_nodes[node.txid] = node
        
        # 定义节点
        for txid, node in all_nodes.items():
            node_id = f"node_{txid[:16]}"
            label = f"{node.tx_type.value}\\n{txid[:20]}...\\nValue: {node.utxo.value:.4f}"
            color = self.COLORS.get(node.tx_type, "#D3D3D3")
            lines.append(f'    {node_id} [label="{label}", fillcolor="{color}"];')
        
        # 目标节点
        target_id = f"target_{target_txid[:16]}"
        target_label = f"*** TARGET ***\\n{target_type.value}\\n{target_txid[:20]}..."
        lines.append(f'    {target_id} [label="{target_label}", fillcolor="#FF6B6B", style="rounded,filled,bold", penwidth=3];')
        lines.append("")
        
        # 定义边
        for path in paths:
            # 路径内部连接
            for i in range(len(path.nodes) - 1):
                from_id = f"node_{path.nodes[i].txid[:16]}"
                to_id = f"node_{path.nodes[i+1].txid[:16]}"
                lines.append(f'    {from_id} -> {to_id};')
            
            # 连接到最后一个节点到目标
            if path.nodes:
                last_id = f"node_{path.nodes[-1].txid[:16]}"
                lines.append(f'    {last_id} -> {target_id} [style=bold, color=red];')
        
        lines.append("}")
        return "\\n".join(lines)
    
    def generate_ascii(self, target_txid: str, target_type: TxType, paths: List[TracePath]) -> str:
        """生成 ASCII 艺术图"""
        lines = []
        lines.append("=" * 80)
        lines.append("TBC 交易溯源流程图")
        lines.append("=" * 80)
        lines.append(f"")
        lines.append(f"目标交易: {target_txid}")
        lines.append(f"交易类型: {target_type.value}")
        lines.append(f"")
        
        for path in paths:
            lines.append(f"路径 {path.path_id} ({path.asset_type.value}):")
            lines.append("-" * 80)
            
            # 从下往上画（从 Coinbase 到目标）
            for i, node in enumerate(reversed(path.nodes)):
                indent = "  " * (len(path.nodes) - 1 - i)
                symbol = "▲" if i == len(path.nodes) - 1 else "│"
                lines.append(f"{indent}{symbol} [{node.tx_type.value:15s}] {node.txid[:32]}... ({node.utxo.value:.4f})")
            
            # 目标
            indent = "  " * len(path.nodes)
            lines.append(f"{indent}▼ [*** TARGET ***] {target_txid[:32]}...")
            lines.append("")
        
        lines.append("=" * 80)
        return "\\n".join(lines)

# 简化版测试
if __name__ == "__main__":
    gen = GraphvizGenerator()
    
    # 创建测试数据
    paths = [
        TracePath(1, AssetType.TBC, [
            TraceNode("abc123", TxType.COINBASE, 0, UTXO("abc123", 0, AssetType.TBC, 109.45)),
            TraceNode("def456", TxType.P2PKH, 1, UTXO("def456", 0, AssetType.TBC, 100.0)),
        ])
    ]
    
    dot = gen.generate("target789", TxType.FT_TRANSFER, paths)
    print(dot)
    print("\\n" + "="*80 + "\\n")
    ascii_art = gen.generate_ascii("target789", TxType.FT_TRANSFER, paths)
    print(ascii_art)
