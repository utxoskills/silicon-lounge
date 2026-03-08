"""
TBC 智能溯源引擎 - 修正版
根据 SDK 代码逻辑正确区分 Mint 和 Transfer
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from enum import Enum
from datetime import datetime

class TxType(Enum):
    """交易类型"""
    COINBASE = "Coinbase"
    P2PKH = "P2PKH"
    FT_MINT = "FT_Mint"
    FT_TRANSFER = "FT_Transfer"
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
    value: float
    asset_type: AssetType
    script_hex: str = ""

@dataclass
class TraceNode:
    txid: str
    tx_type: TxType
    depth: int
    utxo: UTXO

@dataclass
class TracePath:
    path_id: int
    asset_type: AssetType
    nodes: List[TraceNode] = field(default_factory=list)

class CorrectedClassifier:
    """修正后的交易分类器"""
    
    @staticmethod
    def classify_by_inputs_and_outputs(tx_data: dict) -> TxType:
        """
        根据输入和输出综合判断交易类型
        
        关键逻辑：
        - FT Mint: 输入主要是 TBC（支付费用），输出包含新的 FT
        - FT Transfer: 输入包含 FT UTXO，输出是转移后的 FT
        """
        vin = tx_data.get('vin', [])
        vout = tx_data.get('vout', [])
        
        # Coinbase
        if not vin or vin[0].get('coinbase'):
            return TxType.COINBASE
        
        # 分析输入
        has_ft_input = False
        has_tbc_input = False
        
        for inp in vin:
            # 这里简化处理，实际需要检查来源交易的输出
            # 暂时通过 scriptSig 判断
            script_sig = inp.get('scriptSig', {}).get('hex', '')
            if '4654617065' in script_sig or 'FT' in str(inp):
                has_ft_input = True
            else:
                has_tbc_input = True
        
        # 分析输出
        ft_outputs = []
        tbc_outputs = []
        
        for out in vout:
            script = out.get('scriptPubKey', {}).get('hex', '')
            value = out.get('value', 0)
            
            if '4654617065' in script:  # FTape
                ft_outputs.append({
                    'value': value,
                    'script': script,
                    'has_2code': '32436f6465' in script
                })
            elif value > 0:
                tbc_outputs.append({
                    'value': value,
                    'script': script
                })
        
        # 判断逻辑
        # 1. 如果有 FT 输入，且输出也有 FT，那就是 Transfer
        if has_ft_input and ft_outputs:
            return TxType.FT_TRANSFER
        
        # 2. 如果没有 FT 输入，但输出有 FT，那就是 Mint
        if not has_ft_input and ft_outputs:
            return TxType.FT_MINT
        
        # 3. 如果输入有多个 FT，输出合并成一个 FT，那就是 Merge
        if len(vin) > 1 and len(ft_outputs) == 1:
            return TxType.FT_MERGE
        
        # 4. NFT 判断
        for out in vout:
            script = out.get('scriptPubKey', {}).get('hex', '')
            if '4e54617065' in script or '4e486f6c64' in script:
                if '32436f6465' in script:
                    return TxType.NFT_MINT
                return TxType.NFT_TRANSFER
        
        return TxType.P2PKH

class CorrectedInputSelector:
    """修正后的输入选择器"""
    
    def __init__(self, api):
        self.api = api
    
    async def analyze_transaction(self, tx_data: dict) -> dict:
        """全面分析交易输入"""
        vin = tx_data.get('vin', [])
        vout = tx_data.get('vout', [])
        
        result = {
            'ft_inputs': [],
            'tbc_inputs': [],
            'ft_outputs': [],
            'tbc_outputs': []
        }
        
        # 分析输入（需要获取来源交易）
        for inp in vin:
            source_txid = inp.get('txid')
            vout_idx = inp.get('vout')
            
            source_tx = await self.api.get_transaction(source_txid)
            if source_tx:
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    output = source_vout[vout_idx]
                    script = output.get('scriptPubKey', {}).get('hex', '')
                    value = output.get('value', 0)
                    
                    utxo = UTXO(
                        txid=source_txid,
                        vout=vout_idx,
                        value=value,
                        asset_type=AssetType.TBC,
                        script_hex=script
                    )
                    
                    if '4654617065' in script:
                        utxo.asset_type = AssetType.FT
                        result['ft_inputs'].append(utxo)
                    elif value > 0:
                        result['tbc_inputs'].append(utxo)
        
        # 分析输出
        for out in vout:
            script = out.get('scriptPubKey', {}).get('hex', '')
            value = out.get('value', 0)
            
            if '4654617065' in script:
                result['ft_outputs'].append({
                    'value': value,
                    'script': script,
                    'has_2code': '32436f6465' in script
                })
            elif value > 0:
                result['tbc_outputs'].append({
                    'value': value,
                    'script': script
                })
        
        return result
    
    async def select_inputs_for_trace(self, tx_data: dict, tx_type: TxType) -> List[Tuple[str, UTXO]]:
        """
        根据交易类型选择需要追踪的输入
        返回: [(描述, UTXO), ...]
        """
        analysis = await self.analyze_transaction(tx_data)
        selected = []
        
        if tx_type == TxType.FT_MINT:
            # Mint: 追踪 TBC 费用来源
            for utxo in analysis['tbc_inputs']:
                selected.append(("TBC费用", utxo))
        
        elif tx_type == TxType.FT_TRANSFER:
            # Transfer: 追踪 FT 来源
            for utxo in analysis['ft_inputs']:
                selected.append(("FT来源", utxo))
        
        elif tx_type == TxType.FT_MERGE:
            # Merge: 追踪所有 FT 输入
            for utxo in analysis['ft_inputs']:
                selected.append(("FT合并输入", utxo))
        
        elif tx_type == TxType.NFT_MINT:
            # NFT Mint: 追踪 TBC 费用
            for utxo in analysis['tbc_inputs']:
                selected.append(("TBC费用", utxo))
        
        elif tx_type == TxType.NFT_TRANSFER:
            # NFT Transfer: 追踪 NFT 来源
            for utxo in analysis['ft_inputs']:  # NFT 也用 ft_inputs 存储
                selected.append(("NFT来源", utxo))
        
        else:
            # P2PKH: 追踪 TBC
            for utxo in analysis['tbc_inputs']:
                selected.append(("TBC", utxo))
        
        return selected

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
        try:
            async with self.session.get(f"{self.base_url}/decode/txid/{txid}") as resp:
                self.request_count += 1
                data = await resp.json()
                if data.get('code') == '200':
                    self.cache[txid] = data.get('data')
                    return self.cache[txid]
        except:
            pass
        return None

class CorrectedTracer:
    """修正后的溯源器"""
    
    def __init__(self, api, max_depth=50):
        self.api = api
        self.max_depth = max_depth
        self.visited = set()
        self.classifier = CorrectedClassifier()
        self.selector = CorrectedInputSelector(api)
    
    async def trace(self, txid: str):
        """溯源入口"""
        target_tx = await self.api.get_transaction(txid)
        if not target_tx:
            return None, None, []
        
        # 分析交易
        analysis = await self.selector.analyze_transaction(target_tx)
        
        # 根据输入输出判断类型
        target_type = self._determine_type(analysis)
        
        print(f"\n{'='*70}")
        print(f"目标交易: {txid}")
        print(f"交易类型: {target_type.value}")
        print(f"{'='*70}")
        
        print(f"\n输入分析:")
        print(f"  FT 输入: {len(analysis['ft_inputs'])} 个")
        for u in analysis['ft_inputs'][:2]:
            print(f"    - {u.txid[:20]}...:{u.vout} = {u.value:.4f}")
        print(f"  TBC 输入: {len(analysis['tbc_inputs'])} 个")
        for u in analysis['tbc_inputs'][:2]:
            print(f"    - {u.txid[:20]}...:{u.vout} = {u.value:.4f}")
        
        print(f"\n输出分析:")
        print(f"  FT 输出: {len(analysis['ft_outputs'])} 个")
        for o in analysis['ft_outputs'][:2]:
            has_2code = "✓" if o['has_2code'] else "✗"
            print(f"    - {o['value']:.4f} (2Code:{has_2code})")
        print(f"  TBC 输出: {len(analysis['tbc_outputs'])} 个")
        
        # 选择追踪输入
        to_trace = await self.selector.select_inputs_for_trace(target_tx, target_type)
        print(f"\n选择追踪 {len(to_trace)} 个输入:")
        for desc, utxo in to_trace:
            print(f"  - {desc}: {utxo.txid[:20]}... = {utxo.value:.4f}")
        
        # 追踪
        paths = []
        for i, (desc, utxo) in enumerate(to_trace[:3]):
            path = await self._trace_single(utxo, i+1, desc)
            if path:
                paths.append(path)
        
        return txid, target_type, paths
    
    def _determine_type(self, analysis: dict) -> TxType:
        """根据分析结果判断交易类型"""
        ft_inputs = analysis['ft_inputs']
        tbc_inputs = analysis['tbc_inputs']
        ft_outputs = analysis['ft_outputs']
        
        # 有 FT 输入 + 有 FT 输出 = Transfer
        if ft_inputs and ft_outputs:
            if len(ft_inputs) > 1 and len(ft_outputs) == 1:
                return TxType.FT_MERGE
            return TxType.FT_TRANSFER
        
        # 无 FT 输入 + 有 FT 输出 = Mint
        if not ft_inputs and ft_outputs:
            return TxType.FT_MINT
        
        # 默认 P2PKH
        return TxType.P2PKH
    
    async def _trace_single(self, start_utxo: UTXO, path_id: int, desc: str) -> TracePath:
        """追踪单条路径"""
        nodes = []
        current = start_utxo
        depth = 0
        
        print(f"\n[路径{path_id}] {desc}")
        print(f"  起点: {current.txid[:25]}...:{current.vout} = {current.value:.4f}")
        
        while depth < self.max_depth:
            cache_key = f"{current.txid}:{current.vout}"
            if cache_key in self.visited:
                print(f"    深度{depth}: 循环检测")
                break
            self.visited.add(cache_key)
            
            tx = await self.api.get_transaction(current.txid)
            if not tx:
                break
            
            # 分析当前交易
            analysis = await self.selector.analyze_transaction(tx)
            tx_type = self._determine_type(analysis)
            
            node = TraceNode(
                txid=current.txid,
                tx_type=tx_type,
                depth=depth,
                utxo=current
            )
            nodes.append(node)
            
            if depth <= 3 or depth % 10 == 0:
                print(f"    深度{depth}: {tx_type.value} [{current.asset_type.value}] {current.value:.4f}")
            
            if tx_type == TxType.COINBASE:
                print(f"    ✓✓✓ 到达 Coinbase!")
                break
            
            # 选择下一个输入继续追踪
            next_trace = await self.selector.select_inputs_for_trace(tx, tx_type)
            if not next_trace:
                break
            
            # 找相同资产类型的输入
            found = False
            for desc2, utxo2 in next_trace:
                if utxo2.asset_type == current.asset_type:
                    current = utxo2
                    found = True
                    break
            
            if not found:
                current = next_trace[0][1]
            
            depth += 1
        
        return TracePath(path_id, start_utxo.asset_type, nodes)

async def main():
    txid = "803cc5a6a011525c0f89e9002afc7fb5890dadc3176d50f7efe65e9c18aa7b7d"
    
    print("=" * 70)
    print("TBC 智能溯源引擎 - 修正版")
    print("=" * 70)
    
    async with TBCAPIClient() as api:
        tracer = CorrectedTracer(api, max_depth=20)
        target_txid, target_type, paths = await tracer.trace(txid)
        
        print(f"\n{'='*70}")
        print("溯源完成")
        print(f"{'='*70}")
        print(f"总路径数: {len(paths)}")
        print(f"API 调用: {api.request_count} 次")
        
        for path in paths:
            print(f"\n路径 {path.path_id} ({path.asset_type.value}):")
            print(f"  深度: {len(path.nodes)}")
            if path.nodes:
                print(f"  起点: {path.nodes[0].tx_type.value}")
                print(f"  终点: {path.nodes[-1].tx_type.value}")

if __name__ == "__main__":
    asyncio.run(main())
