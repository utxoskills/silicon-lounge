"""
TBC Trace - Universal TBC Tracer
通用 TBC 溯源引擎 - 无论交易多复杂，都要追到矿工
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Set, Tuple, Union
from enum import Enum
from datetime import datetime
import json
import hashlib


class TxType(Enum):
    """TBC 交易类型 - 完整分类"""
    # 基础类型
    COINBASE = "coinbase"           # 矿工奖励 - 溯源终点
    P2PKH = "p2pkh"                 # 普通转账
    P2SH = "p2sh"                   # 脚本哈希
    
    # FT 相关
    FT_TRANSFER = "ft_transfer"     # FT 转账
    FT_MINT = "ft_mint"             # FT 铸造
    FT_MERGE = "ft_merge"           # FT 合并
    FT_SPLIT = "ft_split"           # FT 拆分
    FT_SWAP_TO_TBC = "ft_swap_to_tbc"   # FT 换 TBC
    FT_SWAP_TO_FT = "ft_swap_to_ft"     # TBC 换 FT
    
    # NFT 相关
    NFT_MINT = "nft_mint"           # NFT 铸造
    NFT_TRANSFER = "nft_transfer"   # NFT 转账
    NFT_BURN = "nft_burn"           # NFT 销毁
    NFT_COLLECTION = "nft_collection"  # NFT 集合创建
    
    # Pool 相关
    POOL_CREATE = "pool_create"     # Pool 创建
    POOL_INIT = "pool_init"         # Pool 初始化
    POOL_ADD_LP = "pool_add_lp"     # 添加流动性
    POOL_REMOVE_LP = "pool_remove_lp"  # 移除流动性
    POOL_SWAP = "pool_swap"         # Pool 兑换
    
    # 其他
    MULTISIG = "multisig"           # 多签
    OP_RETURN = "op_return"         # 数据输出（无资金流动）
    UNKNOWN = "unknown"             # 未知类型


@dataclass
class UTXORef:
    """UTXO 引用 - 唯一标识一个输出"""
    txid: str
    vout: int
    value: float = 0.0              # TBC 数量
    address: Optional[str] = None
    script_type: Optional[str] = None
    
    def __hash__(self):
        return hash(f"{self.txid}:{self.vout}")
    
    def __eq__(self, other):
        return self.txid == other.txid and self.vout == other.vout
    
    def __repr__(self):
        return f"UTXO({self.txid[:8]}...:{self.vout}, {self.value:.8f} TBC)"


@dataclass
class TBCFlow:
    """TBC 资金流 - 记录一笔 TBC 的流动"""
    amount: float                   # TBC 数量
    source_utxo: UTXORef           # 来源 UTXO
    target_utxo: Optional[UTXORef] = None  # 目标 UTXO（可能为 None 如果是手续费）
    flow_type: str = "transfer"     # 流动类型：transfer/fee/contract
    metadata: Dict = field(default_factory=dict)  # 额外信息


@dataclass
class TxInput:
    """交易输入 - 包含资金来源"""
    txid: str                       # 来源交易
    vout: int                       # 来源输出索引
    value: float                    # TBC 数量
    address: Optional[str] = None
    script_sig: Optional[str] = None
    sequence: int = 0xffffffff


@dataclass
class TxOutput:
    """交易输出 - 包含资金去向"""
    vout: int
    value: float
    address: Optional[str] = None
    script_pubkey: Optional[str] = None
    script_type: Optional[str] = None
    is_op_return: bool = False
    op_return_data: Optional[bytes] = None
    
    # 合约相关
    is_contract: bool = False
    contract_type: Optional[str] = None      # FT/NFT/Pool
    contract_id: Optional[str] = None


@dataclass
class Transaction:
    """完整交易对象"""
    txid: str
    tx_type: TxType
    version: int
    timestamp: datetime
    block_height: int
    confirmations: int
    
    # 输入输出
    inputs: List[TxInput] = field(default_factory=list)
    outputs: List[TxOutput] = field(default_factory=list)
    
    # 费用信息
    fee: float = 0.0
    fee_rate: float = 0.0
    
    # 元数据
    size: int = 0
    weight: int = 0
    raw_hex: Optional[str] = None
    
    # TBC 流向分析结果
    tbc_flows: List[TBCFlow] = field(default_factory=list)
    
    # 合约相关
    contract_metadata: Dict = field(default_factory=dict)
    
    @property
    def input_value(self) -> float:
        """总输入 TBC"""
        return sum(inp.value for inp in self.inputs)
    
    @property
    def output_value(self) -> float:
        """总输出 TBC（不含 OP_RETURN）"""
        return sum(out.value for out in self.outputs if not out.is_op_return)
    
    @property
    def is_coinbase(self) -> bool:
        """是否是矿工奖励交易"""
        return self.tx_type == TxType.COINBASE


@dataclass
class TraceNode:
    """溯源路径节点 - 构成溯源树"""
    utxo: UTXORef                   # 当前 UTXO
    tx: Transaction                 # 产生此 UTXO 的交易
    depth: int                      # 深度（0 = 目标交易）
    
    # 树结构
    parent: Optional['TraceNode'] = None
    children: List['TraceNode'] = field(default_factory=list)
    
    # 路径信息
    path_tbc: float = 0.0           # 这条路径上的 TBC 数量
    
    def is_leaf(self) -> bool:
        """是否是叶子节点（Coinbase 或无法继续追踪）"""
        return self.tx.is_coinbase or len(self.children) == 0
    
    def get_path_to_root(self) -> List['TraceNode']:
        """获取从根节点到当前节点的路径"""
        path = []
        current = self
        while current:
            path.append(current)
            current = current.parent
        return list(reversed(path))


@dataclass
class TracePath:
    """完整的溯源路径 - 从目标到 Coinbase"""
    path_id: str
    nodes: List[TraceNode]          # 节点列表（从目标到 Coinbase）
    total_tbc: float                # 这条路径的 TBC 总量
    depth: int                      # 路径深度
    
    @property
    def start_tx(self) -> Transaction:
        """起始交易（目标）"""
        return self.nodes[0].tx
    
    @property
    def end_tx(self) -> Transaction:
        """结束交易（Coinbase）"""
        return self.nodes[-1].tx


@dataclass
class TraceResult:
    """溯源结果"""
    target_txid: str
    target_type: TxType
    
    # 路径信息
    paths: List[TracePath] = field(default_factory=list)
    
    # 统计
    total_tbc: float = 0.0
    max_depth: int = 0
    unique_miners: int = 0
    
    # 节点集合
    all_nodes: Dict[str, TraceNode] = field(default_factory=dict)
    all_txs: Dict[str, Transaction] = field(default_factory=dict)
    
    def get_miner_txs(self) -> List[Transaction]:
        """获取所有矿工交易"""
        miners = []
        for path in self.paths:
            if path.end_tx.is_coinbase:
                miners.append(path.end_tx)
        return miners
    
    def to_summary(self) -> dict:
        """生成摘要"""
        return {
            "target_txid": self.target_txid,
            "target_type": self.target_type.value,
            "total_tbc": self.total_tbc,
            "path_count": len(self.paths),
            "max_depth": self.max_depth,
            "miner_count": self.unique_miners,
            "miners": [
                {
                    "txid": tx.txid,
                    "block_height": tx.block_height,
                    "timestamp": tx.timestamp.isoformat(),
                    "reward": tx.outputs[0].value if tx.outputs else 0
                }
                for tx in self.get_miner_txs()
            ]
        }


class TBCAPIClient:
    """TBC API 客户端 - 异步 + 缓存"""
    
    def __init__(self, base_url: str = "https://api.turingbitchain.io/api/tbc"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self._cache: Dict[str, dict] = {}
        self._request_count = 0
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def _request(self, endpoint: str, use_cache: bool = True) -> dict:
        """发送 API 请求"""
        if use_cache and endpoint in self._cache:
            return self._cache[endpoint]
        
        url = f"{self.base_url}/{endpoint}"
        self._request_count += 1
        
        async with self.session.get(url) as resp:
            if resp.status == 404:
                raise Exception(f"Transaction not found: {endpoint}")
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"API error {resp.status}: {text}")
            
            data = await resp.json()
            
            if use_cache:
                self._cache[endpoint] = data
            return data
    
    async def decode_transaction(self, txid: str) -> dict:
        """解码交易"""
        return await self._request(f"decode/txid/{txid}")
    
    async def decode_ft_transaction(self, txid: str) -> Optional[dict]:
        """解码 FT 交易 - 可能失败如果不是 FT"""
        try:
            return await self._request(f"ft/decode/txid/{txid}")
        except:
            return None
    
    async def get_transaction_raw(self, txid: str) -> dict:
        """获取交易原始数据"""
        return await self._request(f"txraw/txid/{txid}")
    
    async def get_block(self, height: int) -> dict:
        """获取区块信息"""
        return await self._request(f"block/height/{height}")
    
    def get_stats(self) -> dict:
        """获取 API 统计"""
        return {
            "request_count": self._request_count,
            "cache_size": len(self._cache)
        }


class TxClassifier:
    """交易类型分类器 - 识别所有 TBC 交易类型"""
    
    # 特征码（hex）
    MARKERS = {
        'FTape': '4654617065',
        'NTape': '4e54617065',
        '2Code': '32436f6465',
        'Mint': '4d696e74',
        'NHold': '4e486f6c64',
        'PoolNFT': '506f6f6c4e4654',
        'Swap': '53776170',
    }
    
    @classmethod
    def classify(cls, tx_data: dict, ft_data: Optional[dict] = None) -> TxType:
        """
        识别交易类型
        
        策略：
        1. 检查是否是 Coinbase
        2. 检查 FT 数据（如果提供）
        3. 分析脚本特征码
        4. 分析输入输出模式
        """
        vins = tx_data.get("vin", [])
        vouts = tx_data.get("vout", [])
        
        # 1. Coinbase
        if not vins:
            return TxType.COINBASE
        
        # 检查第一个输入是否是 coinbase
        first_vin = vins[0]
        if first_vin.get("coinbase") or not first_vin.get("txid"):
            return TxType.COINBASE
        
        # 2. 收集所有脚本数据
        all_scripts = []
        for vout in vouts:
            script = vout.get("scriptPubKey", {}).get("hex", "")
            all_scripts.append(script)
        
        # 3. 检查 FT 数据
        if ft_data:
            return cls._classify_from_ft_data(ft_data, vins, vouts)
        
        # 4. 检查特征码
        script_text = " ".join(all_scripts).lower()
        
        # NFT 检测
        if cls.MARKERS['NTape'].lower() in script_text:
            return cls._classify_nft(vins, vouts, script_text)
        
        # FT 检测
        if cls.MARKERS['FTape'].lower() in script_text:
            return cls._classify_ft(vins, vouts, script_text)
        
        # Pool 检测
        if cls.MARKERS['PoolNFT'].lower() in script_text:
            return cls._classify_pool(vins, vouts)
        
        # 5. 默认 P2PKH
        return TxType.P2PKH
    
    @classmethod
    def _classify_from_ft_data(cls, ft_data: dict, vins: list, vouts: list) -> TxType:
        """从 FT decode 数据判断类型"""
        # 检查是否是 Swap
        if "swap" in str(ft_data).lower():
            return TxType.FT_SWAP_TO_TBC
        
        # 检查输入输出数量
        ft_inputs = len([v for v in vins if cls._has_ft_marker(v)])
        ft_outputs = len([v for v in vouts if cls._has_ft_marker(v)])
        
        if ft_inputs == 1 and ft_outputs == 2:
            return TxType.FT_MERGE
        if ft_inputs == 2 and ft_outputs == 1:
            return TxType.FT_SPLIT
        if ft_inputs == 1 and ft_outputs == 1:
            return TxType.FT_TRANSFER
        
        return TxType.FT_TRANSFER
    
    @classmethod
    def _classify_nft(cls, vins: list, vouts: list, script_text: str) -> TxType:
        """分类 NFT 交易"""
        # 检查 Mint 标记
        mint_count = script_text.count(cls.MARKERS['Mint'].lower())
        nhold_count = script_text.count(cls.MARKERS['NHold'].lower())
        
        # 大量 Mint = 集合创建
        if mint_count > 5 or nhold_count > 5:
            return TxType.NFT_COLLECTION
        
        if mint_count > 0 or nhold_count > 0:
            return TxType.NFT_MINT
        
        return TxType.NFT_TRANSFER
    
    @classmethod
    def _classify_ft(cls, vins: list, vouts: list, script_text: str) -> TxType:
        """分类 FT 交易"""
        # 检查是否是铸造
        if cls.MARKERS['2Code'].lower() in script_text:
            return TxType.FT_MINT
        
        # 分析输入输出模式
        ft_inputs = sum(1 for v in vins if cls._has_ft_marker(v))
        ft_outputs = sum(1 for v in vouts if cls._has_ft_marker(v))
        
        if ft_inputs == 1 and ft_outputs == 2:
            return TxType.FT_MERGE
        if ft_inputs == 2 and ft_outputs == 1:
            return TxType.FT_SPLIT
        
        return TxType.FT_TRANSFER
    
    @classmethod
    def _classify_pool(cls, vins: list, vouts: list) -> TxType:
        """分类 Pool 交易"""
        # TODO: 实现 Pool 交易分类
        return TxType.POOL_SWAP
    
    @classmethod
    def _has_ft_marker(cls, vin_or_vout: dict) -> bool:
        """检查是否有 FT 标记"""
        script = vin_or_vout.get("scriptSig", {}).get("hex", "") or \
                 vin_or_vout.get("scriptPubKey", {}).get("hex", "")
        return cls.MARKERS['FTape'].lower() in script.lower()


class UniversalTBCTracer:
    """
    通用 TBC 溯源引擎
    
    核心原则：
    1. 无论交易多复杂，只关心 TBC 的流动
    2. FT/NFT/LP 等代币只是"凭证"，不进入溯源链
    3. 所有 TBC 最终必须追溯到 Coinbase
    4. 手续费也是 TBC 流动的一部分
    """
    
    def __init__(self, api_client: TBCAPIClient, max_depth: int = 20):
        self.api = api_client
        self.max_depth = max_depth
        self._visited: Set[str] = set()
        self._tx_cache: Dict[str, Transaction] = {}
    
    async def trace(self, txid: str, target_vout: Optional[int] = None) -> TraceResult:
        """
        追踪交易的 TBC 来源
        
        Args:
            txid: 目标交易哈希
            target_vout: 特定输出索引（None = 追踪所有输入）
        
        Returns:
            TraceResult: 包含所有溯源路径的结果
        """
        self._visited.clear()
        
        # 1. 获取目标交易
        target_tx = await self._get_transaction(txid)
        
        # 2. 确定要追踪的输入
        if target_vout is not None:
            # 追踪特定输出 - 需要找到是谁提供了这个 UTXO
            # 实际上应该追踪产生这个输出的交易
            inputs_to_trace = target_tx.inputs
        else:
            # 追踪所有输入
            inputs_to_trace = target_tx.inputs
        
        # 3. 为每个输入创建溯源路径
        paths = []
        all_nodes = {}
        all_txs = {txid: target_tx}
        
        for inp in inputs_to_trace:
            path = await self._trace_input_path(inp, target_tx, depth=1)
            if path:
                paths.append(path)
                # 收集节点和交易
                for node in path.nodes:
                    all_nodes[f"{node.tx.txid}:{node.utxo.vout}"] = node
                    all_txs[node.tx.txid] = node.tx
        
        # 4. 计算统计
        total_tbc = sum(path.total_tbc for path in paths)
        max_depth = max((path.depth for path in paths), default=0)
        unique_miners = len(set(
            path.end_tx.txid for path in paths 
            if path.end_tx.is_coinbase
        ))
        
        return TraceResult(
            target_txid=txid,
            target_type=target_tx.tx_type,
            paths=paths,
            total_tbc=total_tbc,
            max_depth=max_depth,
            unique_miners=unique_miners,
            all_nodes=all_nodes,
            all_txs=all_txs
        )
    
    async def _get_transaction(self, txid: str) -> Transaction:
        """获取并解析交易"""
        if txid in self._tx_cache:
            return self._tx_cache[txid]
        
        # 获取基础数据
        tx_data = await self.api.decode_transaction(txid)
        
        # 尝试获取 FT 数据
        ft_data = await self.api.decode_ft_transaction(txid)
        
        # 识别类型
        tx_type = TxClassifier.classify(tx_data, ft_data)
        
        # 解析输入
        inputs = []
        for vin in tx_data.get("vin", []):
            inputs.append(TxInput(
                txid=vin.get("txid", ""),
                vout=vin.get("vout", 0),
                value=float(vin.get("value", 0)),
                address=vin.get("address"),
                script_sig=vin.get("scriptSig", {}).get("hex"),
                sequence=vin.get("sequence", 0xffffffff)
            ))
        
        # 解析输出
        outputs = []
        for idx, vout in enumerate(tx_data.get("vout", [])):
            script_hex = vout.get("scriptPubKey", {}).get("hex", "")
            script_type = vout.get("scriptPubKey", {}).get("type", "")
            
            is_op_return = script_hex.startswith("6a")
            op_data = None
            if is_op_return and len(script_hex) > 2:
                try:
                    op_data = bytes.fromhex(script_hex[2:])
                except:
                    pass
            
            outputs.append(TxOutput(
                vout=idx,
                value=float(vout.get("value", 0)),
                address=vout.get("scriptPubKey", {}).get("address"),
                script_pubkey=script_hex,
                script_type=script_type,
                is_op_return=is_op_return,
                op_return_data=op_data,
                is_contract=not is_op_return and len(script_hex) > 100
            ))
        
        # 解析时间
        timestamp_str = tx_data.get("time", "")
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        except:
            timestamp = datetime.now()
        
        # 计算费用
        input_value = sum(inp.value for inp in inputs)
        output_value = sum(out.value for out in outputs if not out.is_op_return)
        fee = input_value - output_value if input_value > 0 else 0
        
        tx = Transaction(
            txid=txid,
            tx_type=tx_type,
            version=tx_data.get("version", 0),
            timestamp=timestamp,
            block_height=tx_data.get("height", 0),
            confirmations=tx_data.get("confirmations", 0),
            inputs=inputs,
            outputs=outputs,
            fee=fee,
            size=tx_data.get("size", 0)
        )
        
        self._tx_cache[txid] = tx
        return tx
    
    async def _trace_input_path(
        self, 
        input_ref: TxInput, 
        parent_tx: Transaction,
        depth: int
    ) -> Optional[TracePath]:
        """
        递归追踪单个输入的完整路径
        
        这是核心算法：
        1. 获取输入引用的交易
        2. 创建当前节点
        3. 如果是 Coinbase，到达终点
        4. 否则继续追踪该交易的输入
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
            print(f"Error tracing {input_ref.txid}: {e}")
            return None
        
        # 创建当前节点
        current_utxo = UTXORef(
            txid=input_ref.txid,
            vout=input_ref.vout,
            value=input_ref.value,
            address=input_ref.address
        )
        
        current_node = TraceNode(
            utxo=current_utxo,
            tx=source_tx,
            depth=depth,
            path_tbc=input_ref.value
        )
        
        # 如果是 Coinbase，这是终点
        if source_tx.is_coinbase:
            return TracePath(
                path_id=f"path_{input_ref.txid[:8]}_{input_ref.vout}",
                nodes=[current_node],
                total_tbc=input_ref.value,
                depth=depth
            )
        
        # 递归追踪来源交易的每个输入
        child_paths = []
        for inp in source_tx.inputs:
            child_path = await self._trace_input_path(inp, source_tx, depth + 1)
            if child_path:
                child_paths.append(child_path)
                # 建立父子关系
                for child_node in child_path.nodes:
                    child_node.parent = current_node
                current_node.children.extend(child_path.nodes[:1])
        
        # 构建完整路径
        if child_paths:
            # 合并所有子路径
            all_nodes = [current_node]
            total_tbc = 0
            max_child_depth = 0
            
            for child_path in child_paths:
                all_nodes.extend(child_path.nodes)
                total_tbc += child_path.total_tbc
                max_child_depth = max(max_child_depth, child_path.depth)
            
            return TracePath(
                path_id=f"path_{input_ref.txid[:8]}_{input_ref.vout}",
                nodes=all_nodes,
                total_tbc=total_tbc,
                depth=max_child_depth
            )
        else:
            # 没有子路径，当前就是终点
            return TracePath(
                path_id=f"path_{input_ref.txid[:8]}_{input_ref.vout}",
                nodes=[current_node],
                total_tbc=input_ref.value,
                depth=depth
            )


class TraceReporter:
    """溯源报告生成器"""
    
    @staticmethod
    def print_report(result: TraceResult):
        """打印完整溯源报告"""
        print("\n" + "="*70)
        print("TBC 交易溯源报告")
        print("="*70)
        print(f"目标交易: {result.target_txid}")
        print(f"交易类型: {result.target_type.value}")
        print(f"总 TBC:   {result.total_tbc:.8f}")
        print(f"溯源路径: {len(result.paths)} 条")
        print(f"最大深度: {result.max_depth}")
        print(f"矿工来源: {result.unique_miners} 个")
        print("="*70)
        
        for i, path in enumerate(result.paths, 1):
            print(f"\n【路径 {i}】 总量: {path.total_tbc:.8f} TBC")
            print("-" * 60)
            
            for node in path.nodes:
                indent = "  " * node.depth
                tx = node.tx
                time_str = tx.timestamp.strftime("%Y-%m-%d %H:%M") if tx.timestamp else "Unknown"
                
                # 显示交易信息
                print(f"{indent}[{time_str}] {tx.tx_type.value:20s} ({tx.txid[:12]}...)")
                print(f"{indent}     └─ {node.utxo.value:.8f} TBC", end="")
                
                if tx.is_coinbase:
                    block_reward = tx.outputs[0].value if tx.outputs else 0
                    print(f" [矿工奖励: {block_reward:.8f} TBC]")
                else:
                    print()
                
                # 显示合约信息（如果有）
                if tx.tx_type in [TxType.FT_TRANSFER, TxType.FT_SWAP_TO_TBC]:
                    print(f"{indent}        [FT 合约: {tx.contract_metadata.get('contract', 'Unknown')}]")
                elif tx.tx_type in [TxType.NFT_MINT, TxType.NFT_COLLECTION]:
                    print(f"{indent}        [NFT: {tx.contract_metadata.get('collection', 'Unknown')}]")
        
        print("\n" + "="*70)
        print("溯源完成 - 所有 TBC 已追溯到矿工")
        print("="*70)
    
    @staticmethod
    def to_json(result: TraceResult) -> dict:
        """导出为 JSON 格式"""
        return {
            "summary": result.to_summary(),
            "paths": [
                {
                    "path_id": path.path_id,
                    "total_tbc": path.total_tbc,
                    "depth": path.depth,
                    "nodes": [
                        {
                            "txid": node.tx.txid,
                            "type": node.tx.tx_type.value,
                            "timestamp": node.tx.timestamp.isoformat() if node.tx.timestamp else None,
                            "block_height": node.tx.block_height,
                            "utxo_value": node.utxo.value,
                            "depth": node.depth
                        }
                        for node in path.nodes
                    ]
                }
                for path in result.paths
            ]
        }
    
    @staticmethod
    def to_dot(result: TraceResult) -> str:
        """生成 Graphviz DOT 格式"""
        lines = ["digraph TBCTrace {"]
        lines.append("  rankdir=TB;")
        lines.append('  node [shape=box, style="rounded,filled", fontname="Arial"];')
        lines.append('  edge [fontname="Arial", fontsize=10];')
        
        # 颜色映射
        colors = {
            TxType.COINBASE: "#FFD700",      # 金色
            TxType.P2PKH: "#87CEEB",         # 天蓝
            TxType.FT_TRANSFER: "#90EE90",   # 浅绿
            TxType.FT_SWAP_TO_TBC: "#32CD32", #  lime
            TxType.NFT_MINT: "#FFB6C1",      # 浅粉
            TxType.NFT_COLLECTION: "#FF6347", # 番茄红
            TxType.POOL_SWAP: "#FFA500",     # 橙色
            TxType.UNKNOWN: "#D3D3D3",       # 浅灰
        }
        
        # 收集所有节点和边
        nodes_added = set()
        edges = []
        
        for path in result.paths:
            prev_node_id = None
            
            for node in path.nodes:
                node_id = f"{node.tx.txid}_{node.utxo.vout}"
                
                if node_id not in nodes_added:
                    label = f"{node.tx.tx_type.value}\\n{node.tx.txid[:10]}...\\n{node.utxo.value:.4f} TBC"
                    color = colors.get(node.tx.tx_type, "white")
                    
                    if node.tx.is_coinbase:
                        lines.append(f'  "{node_id}" [label="{label}", fillcolor="{color}", shape=ellipse, penwidth=2];')
                    else:
                        lines.append(f'  "{node_id}" [label="{label}", fillcolor="{color}"];')
                    
                    nodes_added.add(node_id)
                
                # 添加边
                if prev_node_id:
                    edges.append(f'  "{node_id}" -> "{prev_node_id}" [label="{node.utxo.value:.4f}"];')
                
                prev_node_id = node_id
        
        lines.extend(edges)
        lines.append("}")
        
        return "\n".join(lines)


# ============ 使用示例 ============

async def example():
    """示例：溯源那笔 NFT 铸造交易"""
    
    # 目标交易
    target_txid = "24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927"
    
    print(f"开始溯源交易: {target_txid}")
    print("这可能需要一些时间，请耐心等待...\n")
    
    async with TBCAPIClient() as api:
        tracer = UniversalTBCTracer(api, max_depth=15)
        
        start_time = datetime.now()
        result = await tracer.trace(target_txid)
        elapsed = (datetime.now() - start_time).total_seconds()
        
        # 打印报告
        TraceReporter.print_report(result)
        
        # 打印统计
        print(f"\n溯源统计:")
        print(f"  API 请求次数: {api.get_stats()['request_count']}")
        print(f"  缓存命中: {api.get_stats()['cache_size']}")
        print(f"  耗时: {elapsed:.2f} 秒")
        
        # 导出 JSON
        json_data = TraceReporter.to_json(result)
        print(f"\nJSON 导出:")
        print(json.dumps(json_data['summary'], indent=2))
        
        # 导出 DOT
        dot = TraceReporter.to_dot(result)
        print(f"\nGraphviz DOT 格式（可保存为 .dot 文件并用 dot 命令渲染）:")
        print(dot[:500] + "...")


if __name__ == "__main__":
    asyncio.run(example())
