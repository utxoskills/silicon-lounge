#!/usr/bin/env python3
"""
TBC 全类型智能溯源引擎 - 自动化版
自动追溯到矿工 (Coinbase)
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum

class ContractType(Enum):
    TBC = "TBC"
    FT = "FT"
    NFT = "NFT"
    NFT_MINT = "NFT_Mint"
    POOL = "POOL"
    UNKNOWN = "Unknown"

class TxType(Enum):
    COINBASE = "Coinbase"
    P2PKH = "P2PKH"
    FT_MINT = "FT_Mint"
    FT_TRANSFER = "FT_Transfer"
    FT_MERGE = "FT_Merge"
    NFT_COLLECTION_CREATE = "NFT_Collection_Create"
    NFT_MINT = "NFT_Mint"
    NFT_TRANSFER = "NFT_Transfer"
    POOL_CREATE = "Pool_Create"
    POOL_ADD_LP = "Pool_AddLP"
    POOL_REMOVE_LP = "Pool_RemoveLP"
    POOL_SWAP = "Pool_Swap"
    UNKNOWN = "Unknown"

@dataclass
class TraceResult:
    txid: str
    tx_type: TxType
    depth: int
    value: float
    contract_type: ContractType

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

class ContractAnalyzer:
    @staticmethod
    def analyze_output(script_hex: str, value: float) -> ContractType:
        script = script_hex.lower()
        
        if '4654617065' in script:
            return ContractType.FT
        
        if '4e486f6c64' in script:
            if '4d696e7420' in script:
                return ContractType.NFT_MINT
            if '4375727220' in script:
                return ContractType.NFT
        
        if '4e54617065' in script:
            return ContractType.NFT
        
        if '6269736f6e' in script:
            return ContractType.POOL
        
        if value > 0:
            return ContractType.TBC
        
        return ContractType.UNKNOWN

class TxClassifier:
    def __init__(self, api: TBCAPIClient):
        self.api = api
        self.analyzer = ContractAnalyzer()
    
    async def classify(self, tx_data: dict) -> TxType:
        vin = tx_data.get('vin', [])
        vout = tx_data.get('vout', [])
        
        if not vin or vin[0].get('coinbase'):
            return TxType.COINBASE
        
        input_types = await self._analyze_inputs(vin)
        output_types = self._analyze_outputs(vout)
        
        # FT 判断
        if ContractType.FT in output_types:
            if ContractType.FT in input_types:
                if len(input_types[ContractType.FT]) > 1 and len(output_types[ContractType.FT]) == 1:
                    return TxType.FT_MERGE
                return TxType.FT_TRANSFER
            else:
                return TxType.FT_MINT
        
        # NFT 判断
        if ContractType.NFT_MINT in output_types:
            return TxType.NFT_COLLECTION_CREATE
        
        if ContractType.NFT in output_types:
            if ContractType.NFT_MINT in input_types or ContractType.NFT in input_types:
                if any('4d696e7420' in u.get('script', '') for u in input_types.get(ContractType.NFT_MINT, [])):
                    return TxType.NFT_MINT
                return TxType.NFT_TRANSFER
        
        # Pool 判断
        if ContractType.POOL in output_types or ContractType.POOL in input_types:
            return TxType.POOL_SWAP
        
        return TxType.P2PKH
    
    async def _analyze_inputs(self, vin: list) -> Dict[ContractType, List[dict]]:
        result: Dict[ContractType, List[dict]] = {}
        
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
                    
                    ctype = self.analyzer.analyze_output(script, value)
                    
                    if ctype not in result:
                        result[ctype] = []
                    result[ctype].append({'txid': source_txid, 'vout': vout_idx, 'value': value, 'script': script})
        
        return result
    
    def _analyze_outputs(self, vout: list) -> Dict[ContractType, List[dict]]:
        result: Dict[ContractType, List[dict]] = {}
        
        for out in vout:
            script = out.get('scriptPubKey', {}).get('hex', '')
            value = out.get('value', 0)
            
            ctype = self.analyzer.analyze_output(script, value)
            
            if ctype not in result:
                result[ctype] = []
            result[ctype].append({'value': value, 'script': script})
        
        return result

class AutoTracer:
    """自动溯源器 - 自动追溯到矿工"""
    
    def __init__(self, api: TBCAPIClient, classifier: TxClassifier):
        self.api = api
        self.classifier = classifier
        self.analyzer = ContractAnalyzer()
        self.results: List[TraceResult] = []
    
    async def trace_transaction(self, txid: str, trace_tbc: bool = True, trace_ft: bool = True):
        """自动追溯交易到矿工"""
        print(f"\n{'='*70}")
        print(f"自动溯源: {txid}")
        print(f"{'='*70}")
        
        tx = await self.api.get_transaction(txid)
        if not tx:
            print(f"❌ 无法获取交易: {txid}")
            return
        
        # 分析交易类型
        tx_type = await self.classifier.classify(tx)
        print(f"\n交易类型: {tx_type.value}")
        
        vin = tx.get('vin', [])
        
        # 追溯 FT
        if trace_ft:
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
                        
                        ctype = self.analyzer.analyze_output(script, value)
                        
                        if ctype == ContractType.FT:
                            print(f"\n{'='*70}")
                            print(f"追溯 FT 来源...")
                            print(f"{'='*70}")
                            await self._trace_asset(source_txid, vout_idx, ContractType.FT)
        
        # 追溯 TBC
        if trace_tbc:
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
                        
                        ctype = self.analyzer.analyze_output(script, value)
                        
                        if ctype == ContractType.TBC and value > 0.01:
                            print(f"\n{'='*70}")
                            print(f"追溯 TBC 来源...")
                            print(f"{'='*70}")
                            await self._trace_asset(source_txid, vout_idx, ContractType.TBC)
        
        print(f"\n{'='*70}")
        print(f"溯源完成!")
        print(f"总API调用: {self.api.request_count}")
        print(f"{'='*70}")
    
    async def _trace_asset(self, start_txid: str, start_vout: int, asset_type: ContractType):
        """自动追溯资产到矿工"""
        current_txid = start_txid
        current_vout = start_vout
        depth = 0
        
        print(f"起点: {current_txid}:{current_vout}")
        print("追溯中... (按 Ctrl+C 可中断)\n")
        
        try:
            while True:
                depth += 1
                
                tx = await self.api.get_transaction(current_txid)
                if not tx:
                    print(f"[{depth}] ❌ 无法获取交易")
                    break
                
                # 检查是否是 Coinbase
                vin = tx.get('vin', [])
                if not vin or vin[0].get('coinbase'):
                    blockheight = tx.get('blockheight', '未知')
                    print(f"\n🎉🎉🎉 到达 Coinbase (矿工奖励)! 🎉🎉🎉")
                    print(f"   深度: {depth} 层")
                    print(f"   区块高度: {blockheight}")
                    print(f"   交易: {current_txid}")
                    return
                
                # 分类交易
                tx_type = await self.classifier.classify(tx)
                
                # 显示进度
                if depth <= 20 or depth % 50 == 0:
                    print(f"[{depth:4}] {tx_type.value:20} | {current_txid[:25]}...")
                
                # 找到资产来源
                found_next = False
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
                            
                            if self.analyzer.analyze_output(script, value) == asset_type:
                                current_txid = source_txid
                                current_vout = vout_idx
                                found_next = True
                                break
                
                if not found_next:
                    print(f"\n[{depth}] 链结束 (未找到 {asset_type.value} 来源)")
                    break
                
                # 防止无限循环
                if depth > 10000:
                    print(f"\n⚠️ 达到安全深度限制 (10000层)")
                    print(f"最后交易: {current_txid}")
                    break
        
        except KeyboardInterrupt:
            print(f"\n\n用户中断 (当前深度: {depth})")
            print(f"最后交易: {current_txid}")

async def main():
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python3 auto_tracer.py <txid>")
        print("示例: python3 auto_tracer.py 803cc5a6a011525c0f89e9002afc7fb5890dadc3176d50f7efe65e9c18aa7b7d")
        return
    
    txid = sys.argv[1]
    
    async with TBCAPIClient() as api:
        classifier = TxClassifier(api)
        tracer = AutoTracer(api, classifier)
        await tracer.trace_transaction(txid)

if __name__ == "__main__":
    asyncio.run(main())
