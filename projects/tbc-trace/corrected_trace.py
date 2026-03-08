"""
TBC 智能溯源 - 修正版
FT Mint 应该追踪 TBC 来源，不是 FT 来源
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Set
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
    is_tbc_fee: bool = False  # 标记是否是支付费用的 TBC

@dataclass
class TracePath:
    path_id: int
    asset_type: AssetType
    nodes: List[TraceNode] = field(default_factory=list)

class CorrectedInputSelector:
    """修正后的输入选择器"""
    
    def __init__(self, api):
        self.api = api
    
    async def select_tbc_inputs(self, tx_data: dict) -> List[UTXO]:
        """
        选择 TBC 输入（用于 FT Mint / NFT Mint 等需要支付费用的交易）
        """
        vin = tx_data.get('vin', [])
        utxos = []
        
        for inp in vin:
            source_txid = inp.get('txid')
            vout_idx = inp.get('vout')
            
            # 获取来源交易的输出
            source_tx = await self.api.get_transaction(source_txid)
            if source_tx:
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    output = source_vout[vout_idx]
                    value = output.get('value', 0)
                    script = output.get('scriptPubKey', {}).get('hex', '')
                    
                    # 选择 TBC 输出（有金额且不是 FT/NFT）
                    if value > 0 and '4654617065' not in script and '4e54617065' not in script:
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.TBC,
                            value=value
                        ))
        
        return utxos
    
    async def select_ft_inputs(self, tx_data: dict) -> List[UTXO]:
        """
        选择 FT 输入（用于 FT Transfer / FT Merge）
        """
        vin = tx_data.get('vin', [])
        utxos = []
        
        for inp in vin:
            source_txid = inp.get('txid')
            vout_idx = inp.get('vout')
            
            source_tx = await self.api.get_transaction(source_txid)
            if source_tx:
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    output = source_vout[vout_idx]
                    script = output.get('scriptPubKey', {}).get('hex', '')
                    
                    # 选择 FT 输出
                    if '4654617065' in script:
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.FT,
                            value=output.get('value', 0)
                        ))
        
        return utxos
    
    async def select_inputs(self, tx_data: dict, tx_type: TxType) -> List[UTXO]:
        """根据交易类型选择输入"""
        
        if tx_type == TxType.COINBASE:
            return []
        
        # FT Mint / NFT Mint: 追踪 TBC 来源（支付费用）
        if tx_type in [TxType.FT_MINT, TxType.NFT_MINT]:
            return await self.select_tbc_inputs(tx_data)
        
        # FT Transfer / FT Merge: 追踪 FT 来源
        if tx_type in [TxType.FT_TRANSFER, TxType.FT_MERGE]:
            return await self.select_ft_inputs(tx_data)
        
        # P2PKH: 追踪 TBC
        return await self.select_tbc_inputs(tx_data)


class TBCAPIClient:
    def __init__(self, base_url="https://api.turingbitchain.io/api/tbc"):
        self.base_url = base_url
        self.session = None
        self.cache = {}
        self.request_count = 0
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
        return self
    
    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()
    
    async def get_transaction(self, txid):
        if txid in self.cache:
            return self.cache[txid]
        
        url = f"{self.base_url}/decode/txid/{txid}"
        try:
            async with self.session.get(url) as resp:
                self.request_count += 1
                data = await resp.json()
                if data.get('code') == '200':
                    self.cache[txid] = data.get('data')
                    return self.cache[txid]
        except Exception as e:
            print(f"Error: {e}")
        return None


class TxClassifier:
    @staticmethod
    def classify(tx_data):
        vin = tx_data.get('vin', [])
        if not vin or vin[0].get('coinbase'):
            return TxType.COINBASE
        
        vout = tx_data.get('vout', [])
        scripts = ' '.join([v.get('scriptPubKey', {}).get('hex', '') for v in vout]).lower()
        
        if '4654617065' in scripts:  # FTape
            if '32436f6465' in scripts:  # 2Code = Mint
                return TxType.FT_MINT
            return TxType.FT_TRANSFER
        
        if '4e54617065' in scripts or '4e486f6c64' in scripts:
            return TxType.NFT_MINT
        
        return TxType.P2PKH


class CorrectedTracer:
    """修正后的溯源器"""
    
    def __init__(self, api, max_depth=50):
        self.api = api
        self.max_depth = max_depth
        self.visited = set()
        self.selector = CorrectedInputSelector(api)
    
    async def trace(self, txid):
        target_tx = await self.api.get_transaction(txid)
        if not target_tx:
            return None, None, []
        
        target_type = TxClassifier.classify(target_tx)
        print(f"\n目标交易: {txid}")
        print(f"交易类型: {target_type.value}")
        
        # 根据类型选择正确的输入
        inputs = await self.selector.select_inputs(target_tx, target_type)
        print(f"找到 {len(inputs)} 个需要追踪的输入:")
        for i, utxo in enumerate(inputs):
            print(f"  输入{i+1}: {utxo.asset_type.value} - {utxo.txid[:20]}...:{utxo.vout} ({utxo.value:.4f})")
        
        # 追踪每条路径
        paths = []
        for i, utxo in enumerate(inputs[:2]):  # 最多2条
            path = await self._trace_path(utxo, i+1)
            if path:
                paths.append(path)
        
        return txid, target_type, paths
    
    async def _trace_path(self, start_utxo: UTXO, path_id: int) -> TracePath:
        """追踪单条路径"""
        nodes = []
        current_utxo = start_utxo
        depth = 0
        
        print(f"\n[路径{path_id}] 追踪 {start_utxo.asset_type.value}...")
        
        while depth < self.max_depth:
            cache_key = f"{current_utxo.txid}:{current_utxo.vout}"
            if cache_key in self.visited:
                print(f"  深度{depth}: 循环检测")
                break
            self.visited.add(cache_key)
            
            tx = await self.api.get_transaction(current_utxo.txid)
            if not tx:
                break
            
            tx_type = TxClassifier.classify(tx)
            
            node = TraceNode(
                txid=current_utxo.txid,
                tx_type=tx_type,
                depth=depth,
                utxo=current_utxo,
                is_tbc_fee=(current_utxo.asset_type == AssetType.TBC)
            )
            nodes.append(node)
            
            if depth <= 3 or depth % 10 == 0:
                fee_marker = " [TBC费用]" if node.is_tbc_fee else ""
                print(f"  深度{depth}: {tx_type.value}{fee_marker} - {current_utxo.txid[:20]}... ({current_utxo.value:.4f})")
            
            # 到达 Coinbase
            if tx_type == TxType.COINBASE:
                print(f"  ✓✓✓ 到达 Coinbase!")
                break
            
            # 选择下一个输入（根据当前交易类型）
            next_inputs = await self.selector.select_inputs(tx, tx_type)
            if not next_inputs:
                print(f"  深度{depth}: 无后续输入")
                break
            
            current_utxo = next_inputs[0]
            depth += 1
        
        return TracePath(path_id, start_utxo.asset_type, nodes)


async def main():
    txid = "c340f810b98039ddd37fef357f947f37c3735733cf23c858727ec10a3008e0a9"
    
    print("=" * 70)
    print("TBC 智能溯源 - 修正版 (FT Mint 追踪 TBC 来源)")
    print("=" * 70)
    
    async with TBCAPIClient() as api:
        tracer = CorrectedTracer(api, max_depth=30)
        target_txid, target_type, paths = await tracer.trace(txid)
        
        print(f"\n{'='*70}")
        print("溯源结果:")
        print(f"{'='*70}")
        
        for path in paths:
            print(f"\n路径 {path.path_id} ({path.asset_type.value}):")
            print(f"  深度: {len(path.nodes)} 层")
            if path.nodes:
                start = path.nodes[0]
                end = path.nodes[-1]
                print(f"  起点: {start.tx_type.value} - {start.utxo.value:.4f} TBC")
                print(f"  终点: {end.tx_type.value}")
        
        print(f"\nAPI 调用: {api.request_count} 次")

if __name__ == "__main__":
    asyncio.run(main())
