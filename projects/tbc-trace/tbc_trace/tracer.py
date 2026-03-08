"""
TBC Trace - Core Implementation (TDD Phase 2)
实现核心功能，让测试通过
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
    COINBASE = "coinbase"
    P2PKH = "p2pkh"
    P2SH = "p2sh"
    FT_TRANSFER = "ft_transfer"
    FT_MINT = "ft_mint"
    FT_MERGE = "ft_merge"
    NFT_MINT = "nft_mint"
    NFT_TRANSFER = "nft_transfer"
    NFT_COLLECTION = "nft_collection"
    POOL_CREATE = "pool_create"
    POOL_SWAP = "pool_swap"
    UNKNOWN = "unknown"


@dataclass
class UTXORef:
    """UTXO 引用"""
    txid: str
    vout: int
    value: float = 0.0
    address: Optional[str] = None
    
    def __hash__(self):
        return hash(f"{self.txid}:{self.vout}")
    
    def __eq__(self, other):
        return self.txid == other.txid and self.vout == other.vout


@dataclass
class TxInput:
    """交易输入"""
    txid: str
    vout: int
    value: float
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
    fee: float = 0.0
    size: int = 0
    
    @property
    def is_coinbase(self) -> bool:
        return self.tx_type == TxType.COINBASE


@dataclass
class TraceNode:
    """溯源节点"""
    utxo: UTXORef
    tx: Transaction
    depth: int
    parent: Optional['TraceNode'] = None
    children: List['TraceNode'] = field(default_factory=list)


@dataclass
class TracePath:
    """溯源路径"""
    path_id: str
    nodes: List[TraceNode]
    total_tbc: float
    depth: int
    
    @property
    def end_tx(self) -> Transaction:
        return self.nodes[-1].tx


@dataclass
class TraceResult:
    """溯源结果"""
    target_txid: str
    target_type: TxType
    paths: List[TracePath] = field(default_factory=list)
    total_tbc: float = 0.0
    max_depth: int = 0
    
    def get_miner_txs(self) -> List[Transaction]:
        """获取所有矿工交易"""
        miners = []
        seen = set()
        for path in self.paths:
            end_tx = path.end_tx
            if end_tx.is_coinbase and end_tx.txid not in seen:
                miners.append(end_tx)
                seen.add(end_tx.txid)
        return miners


class TBCAPIClient:
    """TBC API 客户端"""
    
    def __init__(self, base_url: str = "https://api.turingbitchain.io/api/tbc"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self._cache: Dict[str, dict] = {}
        self._request_count = 0
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
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
                raise Exception(f"Not found: {endpoint}")
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"API error {resp.status}: {text}")
            
            data = await resp.json()
            if use_cache:
                self._cache[endpoint] = data
            return data
    
    async def decode_transaction(self, txid: str) -> dict:
        return await self._request(f"decode/txid/{txid}")
    
    async def decode_ft_transaction(self, txid: str) -> Optional[dict]:
        try:
            return await self._request(f"ft/decode/txid/{txid}")
        except:
            return None


class TxClassifier:
    """交易类型分类器"""
    
    MARKERS = {
        'FTape': '4654617065',
        'NTape': '4e54617065',
        '2Code': '32436f6465',
    }
    
    @classmethod
    def classify(cls, tx_data: dict, ft_data: Optional[dict] = None) -> TxType:
        """识别交易类型"""
        vins = tx_data.get("vin", [])
        
        # Coinbase
        if not vins:
            return TxType.COINBASE
        
        first_vin = vins[0]
        if first_vin.get("coinbase") or not first_vin.get("txid"):
            return TxType.COINBASE
        
        # 收集脚本
        all_scripts = []
        for vout in tx_data.get("vout", []):
            script = vout.get("scriptPubKey", {}).get("hex", "")
            all_scripts.append(script)
        
        script_text = " ".join(all_scripts).lower()
        
        # NFT
        if cls.MARKERS['NTape'].lower() in script_text:
            mint_count = script_text.count('4d696e74')  # Mint
            if mint_count > 5:
                return TxType.NFT_COLLECTION
            return TxType.NFT_MINT
        
        # FT
        if cls.MARKERS['FTape'].lower() in script_text:
            if cls.MARKERS['2Code'].lower() in script_text:
                return TxType.FT_MINT
            
            # 分析输入输出模式
            ft_inputs = sum(1 for v in vins if cls._has_ft_marker(v))
            ft_outputs = sum(1 for v in tx_data.get("vout", []) if cls._has_ft_marker(v))
            
            if ft_inputs == 1 and ft_outputs == 2:
                return TxType.FT_MERGE
            return TxType.FT_TRANSFER
        
        return TxType.P2PKH
    
    @classmethod
    def _has_ft_marker(cls, vin_or_vout: dict) -> bool:
        script = vin_or_vout.get("scriptSig", {}).get("hex", "") or \
                 vin_or_vout.get("scriptPubKey", {}).get("hex", "")
        return cls.MARKERS['FTape'].lower() in script.lower()


class TBCTracer:
    """TBC 溯源引擎"""
    
    def __init__(self, api_client: TBCAPIClient, max_depth: int = 20):
        self.api = api_client
        self.max_depth = max_depth
        self._visited: Set[str] = set()
        self._tx_cache: Dict[str, Transaction] = {}
    
    async def trace(self, txid: str) -> TraceResult:
        """追踪交易"""
        self._visited.clear()
        
        # 获取目标交易
        target_tx = await self._get_transaction(txid)
        
        # 追踪所有输入
        paths = []
        for inp in target_tx.inputs:
            path = await self._trace_input(inp, depth=1)
            if path:
                paths.append(path)
        
        # 计算统计
        total_tbc = sum(path.total_tbc for path in paths)
        max_depth = max((path.depth for path in paths), default=0)
        
        return TraceResult(
            target_txid=txid,
            target_type=target_tx.tx_type,
            paths=paths,
            total_tbc=total_tbc,
            max_depth=max_depth
        )
    
    async def _get_transaction(self, txid: str) -> Transaction:
        """获取交易"""
        if txid in self._tx_cache:
            return self._tx_cache[txid]
        
        tx_data = await self.api.decode_transaction(txid)
        ft_data = await self.api.decode_ft_transaction(txid)
        tx_type = TxClassifier.classify(tx_data, ft_data)
        
        # 解析输入
        inputs = []
        for vin in tx_data.get("vin", []):
            inputs.append(TxInput(
                txid=vin.get("txid", ""),
                vout=vin.get("vout", 0),
                value=float(vin.get("value", 0)),
                address=vin.get("address"),
                script_sig=vin.get("scriptSig", {}).get("hex")
            ))
        
        # 解析输出
        outputs = []
        for idx, vout in enumerate(tx_data.get("vout", [])):
            script_hex = vout.get("scriptPubKey", {}).get("hex", "")
            outputs.append(TxOutput(
                vout=idx,
                value=float(vout.get("value", 0)),
                address=vout.get("scriptPubKey", {}).get("address"),
                script_pubkey=script_hex,
                is_op_return=script_hex.startswith("6a")
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
    
    async def _trace_input(self, input_ref: TxInput, depth: int) -> Optional[TracePath]:
        """递归追踪输入"""
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
            source_tx = await self._get_transaction(input_ref.txid)
        except Exception as e:
            print(f"Error: {e}")
            return None
        
        # 创建节点
        current_utxo = UTXORef(
            txid=input_ref.txid,
            vout=input_ref.vout,
            value=input_ref.value,
            address=input_ref.address
        )
        
        current_node = TraceNode(
            utxo=current_utxo,
            tx=source_tx,
            depth=depth
        )
        
        # Coinbase 是终点
        if source_tx.is_coinbase:
            return TracePath(
                path_id=f"path_{input_ref.txid[:8]}_{input_ref.vout}",
                nodes=[current_node],
                total_tbc=input_ref.value,
                depth=depth
            )
        
        # 递归追踪
        child_paths = []
        for inp in source_tx.inputs:
            child_path = await self._trace_input(inp, depth + 1)
            if child_path:
                child_paths.append(child_path)
        
        # 构建路径
        if child_paths:
            all_nodes = [current_node]
            total_tbc = 0
            max_child_depth = depth
            
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
            return TracePath(
                path_id=f"path_{input_ref.txid[:8]}_{input_ref.vout}",
                nodes=[current_node],
                total_tbc=input_ref.value,
                depth=depth
            )


class TraceReporter:
    """报告生成器"""
    
    @staticmethod
    def print_report(result: TraceResult):
        """打印报告"""
        print("\n" + "="*70)
        print("TBC 交易溯源报告")
        print("="*70)
        print(f"目标交易: {result.target_txid}")
        print(f"交易类型: {result.target_type.value}")
        print(f"总 TBC:   {result.total_tbc:.8f}")
        print(f"溯源路径: {len(result.paths)} 条")
        print(f"最大深度: {result.max_depth}")
        print(f"矿工来源: {len(result.get_miner_txs())} 个")
        print("="*70)
        
        for i, path in enumerate(result.paths, 1):
            print(f"\n【路径 {i}】 总量: {path.total_tbc:.8f} TBC")
            print("-" * 60)
            
            for node in path.nodes:
                indent = "  " * node.depth
                tx = node.tx
                time_str = tx.timestamp.strftime("%Y-%m-%d %H:%M") if tx.timestamp else "Unknown"
                
                print(f"{indent}[{time_str}] {tx.tx_type.value:20s} ({tx.txid[:12]}...)")
                print(f"{indent}     └─ {node.utxo.value:.8f} TBC", end="")
                
                if tx.is_coinbase:
                    reward = tx.outputs[0].value if tx.outputs else 0
                    print(f" [矿工奖励: {reward:.8f} TBC]")
                else:
                    print()
        
        print("\n" + "="*70)
        print("溯源完成")
        print("="*70)


# ============ 运行测试 ============

async def test_real_transaction():
    """测试真实交易"""
    
    # 测试交易：普通 P2PKH
    TEST_TX = "10c7c721a7509b13dee0a527ba80eb56f7003ce11b7821ba49e5fbcbed737b87"
    
    print(f"\n测试交易: {TEST_TX}")
    print("开始溯源...\n")
    
    async with TBCAPIClient() as api:
        tracer = TBCTracer(api, max_depth=10)
        
        start = datetime.now()
        result = await tracer.trace(TEST_TX)
        elapsed = (datetime.now() - start).total_seconds()
        
        # 打印报告
        TraceReporter.print_report(result)
        
        # 打印统计
        print(f"\n性能统计:")
        print(f"  API 请求: {api._request_count}")
        print(f"  耗时: {elapsed:.2f} 秒")
        
        # 验证
        print(f"\n验证:")
        print(f"  ✓ 路径数: {len(result.paths)}")
        print(f"  ✓ 总 TBC: {result.total_tbc:.8f}")
        print(f"  ✓ 矿工数: {len(result.get_miner_txs())}")
        
        # 检查是否都到达 Coinbase
        all_coinbase = all(path.end_tx.is_coinbase for path in result.paths)
        print(f"  ✓ 全部到达 Coinbase: {all_coinbase}")
        
        if not all_coinbase:
            print("  ✗ 警告: 有路径未到达 Coinbase!")


if __name__ == "__main__":
    asyncio.run(test_real_transaction())
