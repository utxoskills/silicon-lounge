"""
TBC Trace - Core Implementation
TBC 交易溯源核心代码
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Set, Tuple
from enum import Enum
from datetime import datetime
import json


class TxType(Enum):
    """TBC 交易类型"""
    COINBASE = "coinbase"           # 矿工奖励
    P2PKH = "p2pkh"                 # 普通转账
    FT_TRANSFER = "ft_transfer"     # FT 转账
    FT_MINT = "ft_mint"             # FT 铸造
    FT_MERGE = "ft_merge"           # FT 合并
    NFT_MINT = "nft_mint"           # NFT 铸造
    NFT_TRANSFER = "nft_transfer"   # NFT 转账
    NFT_COLLECTION = "nft_collection"  # NFT 集合创建
    POOL_CREATE = "pool_create"     # Pool 创建
    POOL_ADD_LP = "pool_add_lp"     # 添加流动性
    POOL_REMOVE_LP = "pool_remove_lp"  # 移除流动性
    POOL_SWAP = "pool_swap"         # Pool 兑换
    UNKNOWN = "unknown"             # 未知类型


@dataclass
class UTXORef:
    """UTXO 引用"""
    txid: str
    vout: int
    value: float  # TBC 数量
    address: Optional[str] = None
    
    def __hash__(self):
        return hash(f"{self.txid}:{self.vout}")
    
    def __eq__(self, other):
        return self.txid == other.txid and self.vout == other.vout


@dataclass
class TxInput:
    """交易输入"""
    txid: str           # 来源交易
    vout: int           # 来源输出索引
    value: float        # TBC 数量
    address: Optional[str] = None
    script_sig: Optional[str] = None


@dataclass
class TxOutput:
    """交易输出"""
    vout: int
    value: float
    address: Optional[str] = None
    script_pubkey: Optional[str] = None
    is_op_return: bool = False
    op_return_data: Optional[str] = None


@dataclass
class Transaction:
    """交易对象"""
    txid: str
    tx_type: TxType
    version: int
    timestamp: datetime
    block_height: int
    confirmations: int
    inputs: List[TxInput] = field(default_factory=list)
    outputs: List[TxOutput] = field(default_factory=list)
    size: int = 0
    raw_hex: Optional[str] = None
    
    # 合约相关元数据
    ft_contract: Optional[str] = None      # FT 合约 ID
    nft_collection: Optional[str] = None   # NFT 集合名称
    pool_id: Optional[str] = None          # Pool ID


@dataclass
class TraceNode:
    """溯源路径节点"""
    tx: Transaction
    depth: int
    path_value: float           # 流经此节点的 TBC 数量
    parent: Optional['TraceNode'] = None
    children: List['TraceNode'] = field(default_factory=list)


@dataclass
class TraceResult:
    """溯源结果"""
    target_txid: str
    target_type: TxType
    total_paths: int
    max_depth: int
    total_tbc: float
    coinbase_sources: List[TraceNode] = field(default_factory=list)
    all_nodes: Dict[str, TraceNode] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "target_txid": self.target_txid,
            "target_type": self.target_type.value,
            "total_paths": self.total_paths,
            "max_depth": self.max_depth,
            "total_tbc": self.total_tbc,
            "coinbase_count": len(self.coinbase_sources)
        }


class TBCAPIClient:
    """TBC API 客户端"""
    
    def __init__(self, base_url: str = "https://api.turingbitchain.io/api/tbc"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self._cache: Dict[str, dict] = {}  # 简单缓存
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def _request(self, endpoint: str) -> dict:
        """发送 API 请求"""
        cache_key = endpoint
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        url = f"{self.base_url}/{endpoint}"
        async with self.session.get(url) as resp:
            if resp.status != 200:
                raise Exception(f"API error: {resp.status}")
            data = await resp.json()
            self._cache[cache_key] = data
            return data
    
    async def decode_transaction(self, txid: str) -> dict:
        """解码交易"""
        return await self._request(f"decode/txid/{txid}")
    
    async def decode_ft_transaction(self, txid: str) -> dict:
        """解码 FT 交易"""
        return await self._request(f"ft/decode/txid/{txid}")
    
    async def get_transaction_raw(self, txid: str) -> dict:
        """获取交易原始数据"""
        return await self._request(f"txraw/txid/{txid}")
    
    async def get_address_history(self, address: str, start: int = 0, end: int = 50) -> dict:
        """获取地址历史"""
        return await self._request(f"history/address/{address}/start/{start}/end/{end}")


class TxClassifier:
    """交易类型分类器"""
    
    # 特征码
    FT_MARKER = "4654617065"      # "FTape" in hex
    NFT_MARKER = "4e54617065"     # "NTape" in hex
    FT_CODE_MARKER = "32436f6465" # "2Code" in hex
    MINT_MARKER = "4d696e74"      # "Mint" in hex
    NHOLD_MARKER = "4e486f6c64"   # "NHold" in hex
    
    @classmethod
    def classify(cls, tx_data: dict, raw_hex: str = None) -> TxType:
        """
        识别交易类型
        
        Args:
            tx_data: decode API 返回的数据
            raw_hex: 交易原始十六进制（可选）
        """
        vins = tx_data.get("vin", [])
        vouts = tx_data.get("vout", [])
        
        # 1. Coinbase 交易
        if not vins or len(vins) == 0:
            return TxType.COINBASE
        
        # 2. 检查 OP_RETURN 输出
        op_return_data = []
        for vout in vouts:
            script = vout.get("scriptPubKey", {}).get("hex", "")
            if script.startswith("6a"):  # OP_RETURN
                data = script[2:]  # 去掉 6a
                op_return_data.append(data)
        
        # 3. 根据特征码识别
        all_data = " ".join(op_return_data).lower()
        
        # NFT 相关
        if cls.NFT_MARKER.lower() in all_data:
            # 检查是否是集合创建（多个 Mint 输出）
            mint_count = sum(1 for d in op_return_data if cls.MINT_MARKER.lower() in d.lower())
            if mint_count > 10:
                return TxType.NFT_COLLECTION
            elif cls.NHOLD_MARKER.lower() in all_data:
                return TxType.NFT_MINT
            return TxType.NFT_TRANSFER
        
        # FT 相关
        if cls.FT_MARKER.lower() in all_data:
            if cls.FT_CODE_MARKER.lower() in all_data:
                return TxType.FT_MINT
            # 检查输入输出数量判断是否是 Merge
            ft_inputs = sum(1 for vin in vins if cls._is_ft_input(vin))
            ft_outputs = sum(1 for vout in vouts if cls._is_ft_output(vout))
            if ft_inputs == 1 and ft_outputs == 2:
                return TxType.FT_MERGE
            return TxType.FT_TRANSFER
        
        # Pool 相关（需要更复杂的检测）
        # TODO: 实现 Pool 交易检测
        
        # 默认 P2PKH
        return TxType.P2PKH
    
    @classmethod
    def _is_ft_input(cls, vin: dict) -> bool:
        """检查是否是 FT 输入"""
        # 通过脚本特征判断
        script = vin.get("scriptSig", {}).get("hex", "")
        return cls.FT_MARKER.lower() in script.lower()
    
    @classmethod
    def _is_ft_output(cls, vout: dict) -> bool:
        """检查是否是 FT 输出"""
        script = vout.get("scriptPubKey", {}).get("hex", "")
        return cls.FT_MARKER.lower() in script.lower()


class TBCTracer:
    """TBC 交易溯源引擎"""
    
    def __init__(self, api_client: TBCAPIClient, max_depth: int = 10):
        self.api = api_client
        self.max_depth = max_depth
        self._visited: Set[str] = set()  # 防止循环
        self._cache: Dict[str, Transaction] = {}
    
    async def trace(self, txid: str, target_vout: Optional[int] = None) -> TraceResult:
        """
        追踪交易的资金来源
        
        Args:
            txid: 目标交易哈希
            target_vout: 特定输出索引（可选，None 表示追踪所有输入）
        """
        self._visited.clear()
        
        # 获取并解析目标交易
        target_tx = await self._get_transaction(txid)
        
        # 创建根节点
        root = TraceNode(
            tx=target_tx,
            depth=0,
            path_value=sum(inp.value for inp in target_tx.inputs)
        )
        
        # 递归追踪
        coinbase_nodes = []
        all_nodes = {txid: root}
        max_depth = 0
        
        for input_ref in target_tx.inputs:
            child = await self._trace_input(input_ref, root, 1)
            if child:
                root.children.append(child)
                if child.tx.tx_type == TxType.COINBASE:
                    coinbase_nodes.append(child)
                max_depth = max(max_depth, self._get_max_depth(child))
                self._collect_nodes(child, all_nodes)
        
        return TraceResult(
            target_txid=txid,
            target_type=target_tx.tx_type,
            total_paths=len(root.children),
            max_depth=max_depth,
            total_tbc=root.path_value,
            coinbase_sources=coinbase_nodes,
            all_nodes=all_nodes
        )
    
    async def _get_transaction(self, txid: str) -> Transaction:
        """获取并解析交易"""
        if txid in self._cache:
            return self._cache[txid]
        
        # 获取交易数据
        tx_data = await self.api.decode_transaction(txid)
        
        # 识别类型
        tx_type = TxClassifier.classify(tx_data)
        
        # 解析输入
        inputs = []
        for vin in tx_data.get("vin", []):
            inputs.append(TxInput(
                txid=vin.get("txid", ""),
                vout=vin.get("vout", 0),
                value=vin.get("value", 0.0),
                script_sig=vin.get("scriptSig", {}).get("hex")
            ))
        
        # 解析输出
        outputs = []
        for idx, vout in enumerate(tx_data.get("vout", [])):
            script_hex = vout.get("scriptPubKey", {}).get("hex", "")
            is_op_return = script_hex.startswith("6a")
            op_data = script_hex[2:] if is_op_return else None
            
            outputs.append(TxOutput(
                vout=idx,
                value=vout.get("value", 0.0),
                script_pubkey=script_hex,
                is_op_return=is_op_return,
                op_return_data=op_data
            ))
        
        # 解析时间
        timestamp_str = tx_data.get("time", "")
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        except:
            timestamp = datetime.now()
        
        tx = Transaction(
            txid=txid,
            tx_type=tx_type,
            version=tx_data.get("version", 0),
            timestamp=timestamp,
            block_height=tx_data.get("height", 0),
            confirmations=tx_data.get("confirmations", 0),
            inputs=inputs,
            outputs=outputs,
            size=tx_data.get("size", 0)
        )
        
        self._cache[txid] = tx
        return tx
    
    async def _trace_input(self, input_ref: TxInput, parent: TraceNode, depth: int) -> Optional[TraceNode]:
        """
        递归追踪输入来源
        
        Args:
            input_ref: 输入引用
            parent: 父节点
            depth: 当前深度
        """
        # 终止条件
        if depth > self.max_depth:
            return None
        
        if not input_ref.txid:
            return None
        
        # 防止循环
        cache_key = f"{input_ref.txid}:{input_ref.vout}"
        if cache_key in self._visited:
            return None
        self._visited.add(cache_key)
        
        try:
            # 获取来源交易
            source_tx = await self._get_transaction(input_ref.txid)
        except Exception as e:
            print(f"Error fetching {input_ref.txid}: {e}")
            return None
        
        # 创建节点
        node = TraceNode(
            tx=source_tx,
            depth=depth,
            path_value=input_ref.value,
            parent=parent
        )
        
        # 如果是 Coinbase，到达终点
        if source_tx.tx_type == TxType.COINBASE:
            return node
        
        # 递归追踪来源交易的输入
        for inp in source_tx.inputs:
            child = await self._trace_input(inp, node, depth + 1)
            if child:
                node.children.append(child)
        
        return node
    
    def _get_max_depth(self, node: TraceNode) -> int:
        """获取节点的最大深度"""
        if not node.children:
            return node.depth
        return max(self._get_max_depth(child) for child in node.children)
    
    def _collect_nodes(self, node: TraceNode, collection: Dict[str, TraceNode]):
        """收集所有节点"""
        collection[node.tx.txid] = node
        for child in node.children:
            self._collect_nodes(child, collection)


class TraceVisualizer:
    """溯源结果可视化"""
    
    @staticmethod
    def print_trace(result: TraceResult):
        """打印溯源结果（文本格式）"""
        print(f"\n{'='*60}")
        print(f"TBC 交易溯源报告")
        print(f"{'='*60}")
        print(f"目标交易: {result.target_txid}")
        print(f"交易类型: {result.target_type.value}")
        print(f"溯源深度: {result.max_depth}")
        print(f"涉及 TBC: {result.total_tbc:.8f}")
        print(f"矿工来源: {len(result.coinbase_sources)} 个")
        print(f"{'='*60}\n")
        
        # 打印每条路径
        for i, coinbase in enumerate(result.coinbase_sources, 1):
            print(f"\n路径 {i}:")
            print(f"{'-'*40}")
            path = TraceVisualizer._get_path_to_root(coinbase)
            for node in path:
                indent = "  " * node.depth
                time_str = node.tx.timestamp.strftime("%Y-%m-%d %H:%M")
                print(f"{indent}[{time_str}] {node.tx.tx_type.value} ({node.tx.txid[:8]}...)")
                print(f"{indent}     └─ {node.path_value:.8f} TBC")
    
    @staticmethod
    def _get_path_to_root(node: TraceNode) -> List[TraceNode]:
        """获取从根到当前节点的路径"""
        path = []
        current = node
        while current:
            path.append(current)
            current = current.parent
        return list(reversed(path))
    
    @staticmethod
    def to_graphviz(result: TraceResult) -> str:
        """生成 Graphviz DOT 格式"""
        lines = ["digraph TBCTrace {"]
        lines.append("  rankdir=TB;")
        lines.append('  node [shape=box, style=rounded];')
        
        # 添加节点
        for txid, node in result.all_nodes.items():
            label = f"{node.tx.tx_type.value}\\n{node.tx.txid[:12]}..."
            color = TraceVisualizer._get_node_color(node.tx.tx_type)
            lines.append(f'  "{txid}" [label="{label}", fillcolor={color}, style="filled,rounded"];')
        
        # 添加边
        for txid, node in result.all_nodes.items():
            for child in node.children:
                label = f"{child.path_value:.4f}"
                lines.append(f'  "{child.tx.txid}" -> "{txid}" [label="{label}"];')
        
        lines.append("}")
        return "\n".join(lines)
    
    @staticmethod
    def _get_node_color(tx_type: TxType) -> str:
        """根据类型返回颜色"""
        colors = {
            TxType.COINBASE: "gold",
            TxType.P2PKH: "lightblue",
            TxType.FT_TRANSFER: "lightgreen",
            TxType.FT_MINT: "green",
            TxType.FT_MERGE: "darkgreen",
            TxType.NFT_MINT: "pink",
            TxType.NFT_TRANSFER: "lightpink",
            TxType.NFT_COLLECTION: "red",
            TxType.POOL_CREATE: "orange",
            TxType.POOL_SWAP: "yellow",
            TxType.UNKNOWN: "gray"
        }
        return colors.get(tx_type, "white")


# ============ 使用示例 ============

async def main():
    """示例：溯源那笔 NFT 铸造交易"""
    
    # 目标交易：NFT 集合创建
    target_txid = "24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927"
    
    async with TBCAPIClient() as api:
        tracer = TBCTracer(api, max_depth=10)
        result = await tracer.trace(target_txid)
        
        # 打印结果
        TraceVisualizer.print_trace(result)
        
        # 生成 Graphviz
        dot = TraceVisualizer.to_graphviz(result)
        print("\n\nGraphviz DOT 格式:")
        print(dot)


if __name__ == "__main__":
    asyncio.run(main())
