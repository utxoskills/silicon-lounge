"""
TBC 智能溯源 - 支持多合约追踪
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
    contract_id: Optional[str] = None  # FT/NFT 合约ID
    token_name: Optional[str] = None

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
    contract_id: Optional[str]
    nodes: List[TraceNode] = field(default_factory=list)

class ContractAwareSelector:
    """支持多合约的输入选择器"""
    
    def __init__(self, api):
        self.api = api
    
    def extract_contract_id(self, script: str) -> Optional[str]:
        """从脚本中提取合约ID"""
        # FT 合约ID通常在 FTape 标记之后
        if '4654617065' not in script:
            return None
        
        # 简化处理：返回脚本中的关键部分作为合约标识
        # 实际应该解析完整的合约ID
        parts = script.split('4654617065')
        if len(parts) > 1:
            return parts[1][:40]  # 取40字符作为合约ID
        return None
    
    async def select_inputs_by_contract(self, tx_data: dict, target_contract: Optional[str] = None) -> Dict[str, List[UTXO]]:
        """
        按合约分组选择输入
        返回: {contract_id: [UTXO], ...}
        """
        vin = tx_data.get('vin', [])
        contract_groups: Dict[str, List[UTXO]] = {}
        tbc_utxos: List[UTXO] = []
        
        for inp in vin:
            source_txid = inp.get('txid')
            vout_idx = inp.get('vout')
            
            source_tx = await self.api.get_transaction(source_txid)
            if not source_tx:
                continue
            
            source_vout = source_tx.get('vout', [])
            if vout_idx >= len(source_vout):
                continue
            
            output = source_vout[vout_idx]
            value = output.get('value', 0)
            script = output.get('scriptPubKey', {}).get('hex', '')
            
            # 判断资产类型
            if '4654617065' in script:  # FT
                contract_id = self.extract_contract_id(script)
                utxo = UTXO(
                    txid=source_txid,
                    vout=vout_idx,
                    asset_type=AssetType.FT,
                    value=value,
                    contract_id=contract_id
                )
                
                # 按合约分组
                cid = contract_id or "unknown_ft"
                if cid not in contract_groups:
                    contract_groups[cid] = []
                contract_groups[cid].append(utxo)
                
            elif '4e54617065' in script or '4e486f6c64' in script:  # NFT
                utxo = UTXO(
                    txid=source_txid,
                    vout=vout_idx,
                    asset_type=AssetType.NFT,
                    value=value
                )
                if "nft" not in contract_groups:
                    contract_groups["nft"] = []
                contract_groups["nft"].append(utxo)
                
            elif value > 0:  # TBC
                utxo = UTXO(
                    txid=source_txid,
                    vout=vout_idx,
                    asset_type=AssetType.TBC,
                    value=value
                )
                tbc_utxos.append(utxo)
        
        # 如果有 TBC，单独分组
        if tbc_utxos:
            contract_groups["TBC"] = tbc_utxos
        
        return contract_groups
    
    async def select_for_ft_mint(self, tx_data: dict) -> List[UTXO]:
        """FT Mint: 只选 TBC"""
        groups = await self.select_inputs_by_contract(tx_data)
        return groups.get("TBC", [])
    
    async def select_for_ft_transfer(self, tx_data: dict, target_contract: Optional[str] = None) -> List[UTXO]:
        """FT Transfer: 选指定合约的 FT，如果没有指定则选所有 FT"""
        groups = await self.select_inputs_by_contract(tx_data)
        
        # 如果有目标合约，只选该合约
        if target_contract and target_contract in groups:
            return groups[target_contract]
        
        # 否则选所有 FT（排除 TBC）
        all_ft = []
        for cid, utxos in groups.items():
            if cid != "TBC" and cid != "nft":
                all_ft.extend(utxos)
        return all_ft
    
    async def select_for_ft_merge(self, tx_data: dict) -> List[UTXO]:
        """FT Merge: 选所有 FT 输入（同一合约）"""
        groups = await self.select_inputs_by_contract(tx_data)
        
        # 找到数量最多的合约（应该是同一个）
        max_contract = None
        max_count = 0
        for cid, utxos in groups.items():
            if cid != "TBC" and len(utxos) > max_count:
                max_count = len(utxos)
                max_contract = cid
        
        if max_contract:
            return groups[max_contract]
        return []


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
        
        if '4654617065' in scripts:
            if '32436f6465' in scripts:
                return TxType.FT_MINT
            # 判断 Merge vs Transfer
            vin_count = len(vin)
            if vin_count > 1:
                # 可能是 Merge
                pass
            return TxType.FT_TRANSFER
        
        if '4e54617065' in scripts or '4e486f6c64' in scripts:
            return TxType.NFT_MINT
        
        return TxType.P2PKH


class MultiContractTracer:
    """支持多合约的溯源器"""
    
    def __init__(self, api, max_depth=50):
        self.api = api
        self.max_depth = max_depth
        self.visited = set()
        self.selector = ContractAwareSelector(api)
    
    async def trace(self, txid, target_contract: Optional[str] = None):
        target_tx = await self.api.get_transaction(txid)
        if not target_tx:
            return None, None, []
        
        target_type = TxClassifier.classify(target_tx)
        print(f"\n目标交易: {txid}")
        print(f"交易类型: {target_type.value}")
        
        # 分析所有输入（按合约分组）
        contract_groups = await self.selector.select_inputs_by_contract(target_tx)
        
        print(f"\n输入分析（按合约分组）:")
        for cid, utxos in contract_groups.items():
            print(f"  {cid}: {len(utxos)} 个 UTXO")
            for u in utxos[:2]:  # 只显示前2个
                print(f"    - {u.txid[:20]}...:{u.vout} = {u.value:.4f}")
        
        # 根据类型选择追踪策略
        if target_type == TxType.FT_MINT:
            inputs = await self.selector.select_for_ft_mint(target_tx)
            print(f"\nFT Mint 策略: 追踪 {len(inputs)} 个 TBC 输入")
        
        elif target_type == TxType.FT_TRANSFER:
            inputs = await self.selector.select_for_ft_transfer(target_tx, target_contract)
            print(f"\nFT Transfer 策略: 追踪 {len(inputs)} 个 FT 输入")
        
        elif target_type == TxType.FT_MERGE:
            inputs = await self.selector.select_for_ft_merge(target_tx)
            print(f"\nFT Merge 策略: 追踪 {len(inputs)} 个 FT 输入")
        
        else:
            # P2PKH: 追踪所有 TBC
            inputs = contract_groups.get("TBC", [])
            print(f"\nP2PKH 策略: 追踪 {len(inputs)} 个 TBC 输入")
        
        # 追踪每条路径
        paths = []
        for i, utxo in enumerate(inputs[:3]):  # 最多3条
            path = await self._trace_path(utxo, i+1, target_contract)
            if path:
                paths.append(path)
        
        return txid, target_type, paths
    
    async def _trace_path(self, start_utxo: UTXO, path_id: int, target_contract: Optional[str]) -> TracePath:
        nodes = []
        current_utxo = start_utxo
        depth = 0
        
        print(f"\n[路径{path_id}] 追踪 {start_utxo.asset_type.value} (合约: {start_utxo.contract_id or 'N/A'})...")
        
        while depth < self.max_depth:
            cache_key = f"{current_utxo.txid}:{current_utxo.vout}"
            if cache_key in self.visited:
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
                utxo=current_utxo
            )
            nodes.append(node)
            
            if depth <= 3 or depth % 10 == 0:
                contract_info = f" [{current_utxo.contract_id[:10]}...]" if current_utxo.contract_id else ""
                print(f"  深度{depth}: {tx_type.value}{contract_info} - {current_utxo.txid[:20]}... ({current_utxo.value:.4f})")
            
            if tx_type == TxType.COINBASE:
                print(f"  ✓✓✓ 到达 Coinbase!")
                break
            
            # 根据当前交易类型选择下一步
            if tx_type == TxType.FT_MINT:
                next_inputs = await self.selector.select_for_ft_mint(tx)
            elif tx_type == TxType.FT_TRANSFER:
                next_inputs = await self.selector.select_for_ft_transfer(tx, target_contract)
            else:
                next_inputs = await self.selector.select_for_ft_mint(tx)  # 默认选 TBC
            
            if not next_inputs:
                break
            
            current_utxo = next_inputs[0]
            depth += 1
        
        return TracePath(path_id, start_utxo.asset_type, start_utxo.contract_id, nodes)


async def main():
    txid = "c340f810b98039ddd37fef357f947f37c3735733cf23c858727ec10a3008e0a9"
    
    print("=" * 70)
    print("TBC 多合约智能溯源")
    print("=" * 70)
    
    async with TBCAPIClient() as api:
        tracer = MultiContractTracer(api, max_depth=20)
        target_txid, target_type, paths = await tracer.trace(txid)
        
        print(f"\n{'='*70}")
        print("溯源结果:")
        print(f"{'='*70}")
        
        for path in paths:
            contract_info = f" (合约: {path.contract_id[:15]}...)" if path.contract_id else ""
            print(f"\n路径 {path.path_id} ({path.asset_type.value}){contract_info}:")
            print(f"  深度: {len(path.nodes)} 层")
            if path.nodes:
                print(f"  起点: {path.nodes[0].tx_type.value} - {path.nodes[0].utxo.value:.4f}")
                print(f"  终点: {path.nodes[-1].tx_type.value}")
        
        print(f"\nAPI 调用: {api.request_count} 次")

if __name__ == "__main__":
    asyncio.run(main())
