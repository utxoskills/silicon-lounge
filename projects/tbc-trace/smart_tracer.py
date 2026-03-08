#!/usr/bin/env python3
"""
TBC 智能溯源引擎 - 修正版
正确区分 Pool Swap 和 FT Transfer
"""

import asyncio
import aiohttp
from dataclasses import dataclass
from typing import List, Dict, Optional
from enum import Enum

class ContractType(Enum):
    TBC = "TBC"
    FT = "FT"
    NFT = "NFT"
    POOL = "POOL"
    UNKNOWN = "Unknown"

class TxType(Enum):
    COINBASE = "Coinbase"
    P2PKH = "P2PKH"
    FT_MINT = "FT_Mint"
    FT_TRANSFER = "FT_Transfer"
    FT_MERGE = "FT_Merge"
    POOL_SWAP = "Pool_Swap"
    UNKNOWN = "Unknown"

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
    
    async def get_ft_decode(self, txid):
        try:
            async with self.session.get(f"{self.base_url}/ft/decode/txid/{txid}") as resp:
                self.request_count += 1
                data = await resp.json()
                if data.get('code') == '200':
                    return data.get('data')
        except:
            pass
        return None

class SmartClassifier:
    """智能分类器 - 正确识别 Pool 交易"""
    
    def __init__(self, api: TBCAPIClient):
        self.api = api
    
    def has_pool_marker(self, script_hex: str) -> bool:
        return '6269736f6e' in script_hex.lower()
    
    def has_ft_marker(self, script_hex: str) -> bool:
        return '4654617065' in script_hex.lower()
    
    async def classify(self, tx_data: dict, ft_data: dict = None) -> TxType:
        vin = tx_data.get('vin', [])
        vout = tx_data.get('vout', [])
        
        if not vin or vin[0].get('coinbase'):
            return TxType.COINBASE
        
        # 检查是否有 Pool 标记
        has_pool_input = False
        has_pool_output = False
        
        for inp in vin:
            source_tx = await self.api.get_transaction(inp.get('txid'))
            if source_tx:
                vout_idx = inp.get('vout')
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    script = source_vout[vout_idx].get('scriptPubKey', {}).get('hex', '')
                    if self.has_pool_marker(script):
                        has_pool_input = True
        
        for out in vout:
            script = out.get('scriptPubKey', {}).get('hex', '')
            if self.has_pool_marker(script):
                has_pool_output = True
        
        # 如果有 Pool 标记，是 Pool 交易
        if has_pool_input or has_pool_output:
            return TxType.POOL_SWAP
        
        # 检查 FT
        has_ft_input = False
        has_ft_output = False
        
        for inp in vin:
            source_tx = await self.api.get_transaction(inp.get('txid'))
            if source_tx:
                vout_idx = inp.get('vout')
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    script = source_vout[vout_idx].get('scriptPubKey', {}).get('hex', '')
                    if self.has_ft_marker(script):
                        has_ft_input = True
        
        for out in vout:
            script = out.get('scriptPubKey', {}).get('hex', '')
            if self.has_ft_marker(script):
                has_ft_output = True
        
        # FT 判断
        if has_ft_output:
            if has_ft_input:
                return TxType.FT_TRANSFER
            else:
                return TxType.FT_MINT
        
        return TxType.P2PKH

class SmartTracer:
    """智能溯源器"""
    
    def __init__(self, api: TBCAPIClient, classifier: SmartClassifier):
        self.api = api
        self.classifier = classifier
    
    async def trace(self, txid: str):
        print(f"\n{'='*70}")
        print(f"智能溯源: {txid}")
        print(f"{'='*70}")
        
        # 获取交易
        tx = await self.api.get_transaction(txid)
        ft_data = await self.api.get_ft_decode(txid)
        
        if not tx:
            print("❌ 无法获取交易")
            return
        
        # 分类当前交易
        tx_type = await self.classifier.classify(tx, ft_data)
        print(f"\n当前交易类型: {tx_type.value}")
        
        if ft_data:
            print(f"合约ID: {ft_data.get('contract_id', 'N/A')}")
            print(f"输入:")
            for inp in ft_data.get('input', []):
                print(f"  - {inp.get('address')} | {inp.get('balance')}")
            print(f"输出:")
            for out in ft_data.get('output', []):
                print(f"  - {out.get('address')} | {out.get('balance')}")
        
        # 追溯 FT 来源
        if tx_type in [TxType.FT_TRANSFER, TxType.POOL_SWAP]:
            print(f"\n{'='*70}")
            print("追溯 FT 来源链...")
            print(f"{'='*70}")
            await self._trace_ft_source(txid)
        
        print(f"\n总API调用: {self.api.request_count}")
    
    async def _trace_ft_source(self, start_txid: str):
        current_txid = start_txid
        depth = 0
        max_depth = 200
        
        while depth < max_depth:
            depth += 1
            
            tx = await self.api.get_transaction(current_txid)
            ft_data = await self.api.get_ft_decode(current_txid)
            
            if not tx:
                break
            
            tx_type = await self.classifier.classify(tx, ft_data)
            
            # 显示重要节点
            if tx_type == TxType.POOL_SWAP:
                print(f"\n[{depth}] 🏊 POOL_SWAP 发现!")
                print(f"     交易: {current_txid}")
                return
            elif tx_type == TxType.FT_MINT:
                print(f"\n[{depth}] 🎉 FT_MINT 发现!")
                print(f"     交易: {current_txid}")
                return
            elif tx_type == TxType.COINBASE:
                print(f"\n[{depth}] ⛏️ 到达 Coinbase!")
                return
            
            if depth <= 10 or depth % 20 == 0:
                print(f"[{depth}] {tx_type.value} | {current_txid[:20]}...")
            
            # 找 FT 来源
            found_next = False
            if ft_data and ft_data.get('input'):
                # 使用 FT decode 数据
                for inp in ft_data.get('input', []):
                    next_txid = inp.get('txid')
                    if next_txid:
                        current_txid = next_txid
                        found_next = True
                        break
            
            if not found_next:
                break
        
        print(f"\n达到最大深度 {max_depth}")

async def main():
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python3 smart_tracer.py <txid>")
        return
    
    txid = sys.argv[1]
    
    async with TBCAPIClient() as api:
        classifier = SmartClassifier(api)
        tracer = SmartTracer(api, classifier)
        await tracer.trace(txid)

if __name__ == "__main__":
    asyncio.run(main())
