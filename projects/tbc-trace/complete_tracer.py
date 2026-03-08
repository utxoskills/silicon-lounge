#!/usr/bin/env python3
"""
TBC 智能溯源引擎 - 完整版
支持断点续传，自动追溯到矿工
"""

import asyncio
import aiohttp
import json
import os
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
from enum import Enum

STATE_FILE = "/Users/jay/.openclaw/workspace/projects/tbc-trace/trace_state.json"

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
        
        # 检查 Pool 标记
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
        
        if has_ft_output:
            if has_ft_input:
                return TxType.FT_TRANSFER
            else:
                return TxType.FT_MINT
        
        return TxType.P2PKH

class CompleteTracer:
    """完整溯源器 - 自动追溯到矿工，支持断点续传"""
    
    def __init__(self, api: TBCAPIClient, classifier: SmartClassifier):
        self.api = api
        self.classifier = classifier
        self.state = self.load_state()
    
    def load_state(self) -> dict:
        """加载状态"""
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def save_state(self, target_txid: str, current_txid: str, depth: int, path: list):
        """保存状态"""
        self.state = {
            'target_txid': target_txid,
            'current_txid': current_txid,
            'depth': depth,
            'path': path
        }
        with open(STATE_FILE, 'w') as f:
            json.dump(self.state, f, indent=2)
    
    def clear_state(self):
        """清除状态"""
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
        self.state = {}
    
    async def trace(self, target_txid: str, resume: bool = False):
        """完整追溯"""
        print(f"\n{'='*70}")
        print(f"完整溯源: {target_txid}")
        print(f"{'='*70}")
        
        # 恢复状态或从头开始
        if resume and self.state.get('target_txid') == target_txid:
            current_txid = self.state['current_txid']
            depth = self.state['depth']
            path = self.state['path']
            print(f"\n📂 恢复状态 - 从第 {depth} 层继续...")
        else:
            # 从头开始
            tx = await self.api.get_transaction(target_txid)
            ft_data = await self.api.get_ft_decode(target_txid)
            
            if not tx:
                print("❌ 无法获取交易")
                return
            
            tx_type = await self.classifier.classify(tx, ft_data)
            print(f"\n起始交易类型: {tx_type.value}")
            
            # 找到 FT 输入
            if ft_data and ft_data.get('input'):
                current_txid = ft_data['input'][0]['txid']
            else:
                print("无法找到 FT 输入")
                return
            
            depth = 0
            path = []
        
        print(f"\n开始追溯... (按 Ctrl+C 暂停并保存状态)\n")
        
        try:
            while True:
                depth += 1
                
                tx = await self.api.get_transaction(current_txid)
                ft_data = await self.api.get_ft_decode(current_txid)
                
                if not tx:
                    print(f"[{depth}] ❌ 无法获取交易")
                    break
                
                tx_type = await self.classifier.classify(tx, ft_data)
                
                # 记录路径
                path.append({
                    'depth': depth,
                    'txid': current_txid,
                    'type': tx_type.value
                })
                
                # 检查是否到达矿工
                if tx_type == TxType.COINBASE:
                    blockheight = tx.get('blockheight', '未知')
                    print(f"\n{'='*70}")
                    print(f"🎉🎉🎉 到达 Coinbase (矿工奖励)! 🎉🎉🎉")
                    print(f"{'='*70}")
                    print(f"深度: {depth} 层")
                    print(f"区块高度: {blockheight}")
                    print(f"矿工交易: {current_txid}")
                    print(f"\n完整路径:")
                    for p in path[-10:]:  # 显示最后10层
                        print(f"  [{p['depth']}] {p['type']:15} | {p['txid']}")
                    
                    self.clear_state()
                    return
                
                # 显示重要节点
                if tx_type == TxType.POOL_SWAP and depth <= 100:
                    print(f"\n[{depth}] 🏊 POOL_SWAP")
                    print(f"     {current_txid}")
                elif tx_type == TxType.FT_MINT:
                    print(f"\n[{depth}] 🎉 FT_MINT")
                    print(f"     {current_txid}")
                elif depth <= 20 or depth % 100 == 0:
                    print(f"[{depth:4}] {tx_type.value:15} | {current_txid[:30]}...")
                
                # 保存状态 (每50层)
                if depth % 50 == 0:
                    self.save_state(target_txid, current_txid, depth, path)
                
                # 找下一个来源
                next_txid = None
                if ft_data and ft_data.get('input'):
                    next_txid = ft_data['input'][0]['txid']
                
                if not next_txid:
                    print(f"\n[{depth}] 链结束 (未找到来源)")
                    break
                
                current_txid = next_txid
        
        except KeyboardInterrupt:
            print(f"\n\n用户中断 - 保存状态...")
            self.save_state(target_txid, current_txid, depth, path)
            print(f"状态已保存，当前深度: {depth}")
            print(f"下次运行: python3 complete_tracer.py {target_txid} --resume")
        
        print(f"\n总深度: {depth}")
        print(f"API调用: {self.api.request_count}")

async def main():
    import sys
    
    if len(sys.argv) < 2:
        print("用法:")
        print("  开始新追溯: python3 complete_tracer.py <txid>")
        print("  继续追溯:   python3 complete_tracer.py <txid> --resume")
        print("  清除状态:   python3 complete_tracer.py --clear")
        return
    
    if sys.argv[1] == '--clear':
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
            print("状态已清除")
        else:
            print("无状态文件")
        return
    
    txid = sys.argv[1]
    resume = '--resume' in sys.argv
    
    async with TBCAPIClient() as api:
        classifier = SmartClassifier(api)
        tracer = CompleteTracer(api, classifier)
        await tracer.trace(txid, resume)

if __name__ == "__main__":
    asyncio.run(main())
