"""
TBC 全类型智能溯源引擎
支持: FT, NFT, Pool 等各种合约类型
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Set, Tuple
from enum import Enum
from datetime import datetime

class ContractType(Enum):
    """合约类型"""
    TBC = "TBC"           # 原生代币
    FT = "FT"             # 同质化代币
    NFT = "NFT"           # 非同质化代币
    POOL = "POOL"         # 流动性池
    UNKNOWN = "Unknown"

class TxType(Enum):
    """交易类型"""
    COINBASE = "Coinbase"
    P2PKH = "P2PKH"
    
    # FT 类型
    FT_MINT = "FT_Mint"
    FT_TRANSFER = "FT_Transfer"
    FT_MERGE = "FT_Merge"
    FT_SPLIT = "FT_Split"
    FT_BURN = "FT_Burn"
    
    # NFT 类型
    NFT_MINT = "NFT_Mint"
    NFT_TRANSFER = "NFT_Transfer"
    NFT_BURN = "NFT_Burn"
    NFT_COLLECTION = "NFT_Collection"
    
    # Pool 类型
    POOL_CREATE = "Pool_Create"
    POOL_INIT = "Pool_Init"
    POOL_ADD_LP = "Pool_AddLP"
    POOL_REMOVE_LP = "Pool_RemoveLP"
    POOL_SWAP = "Pool_Swap"
    
    UNKNOWN = "Unknown"

@dataclass
class ContractInfo:
    """合约信息"""
    contract_type: ContractType
    contract_id: Optional[str] = None
    token_name: Optional[str] = None
    token_symbol: Optional[str] = None

@dataclass
class UTXO:
    """UTXO"""
    txid: str
    vout: int
    value: float
    contract: ContractInfo

@dataclass
class TraceNode:
    """溯源节点"""
    txid: str
    tx_type: TxType
    depth: int
    utxo: UTXO
    timestamp: Optional[str] = None

@dataclass
class TracePath:
    """溯源路径"""
    path_id: int
    contract: ContractInfo
    nodes: List[TraceNode] = field(default_factory=list)

class ContractParser:
    """合约解析器"""
    
    @staticmethod
    def parse_output(script_hex: str, value: float) -> ContractInfo:
        """解析输出脚本，识别合约类型"""
        script = script_hex.lower()
        
        # FT 合约
        if '4654617065' in script:  # "FTape"
            contract_id = ContractParser._extract_ft_contract(script_hex)
            return ContractInfo(
                contract_type=ContractType.FT,
                contract_id=contract_id
            )
        
        # NFT 合约
        if '4e54617065' in script or '4e486f6c64' in script:  # "NTape" or "NHold"
            contract_id = ContractParser._extract_nft_contract(script_hex)
            return ContractInfo(
                contract_type=ContractType.NFT,
                contract_id=contract_id
            )
        
        # Pool 合约
        if '6269736f6e' in script:  # "bison"
            return ContractInfo(
                contract_type=ContractType.POOL
            )
        
        # TBC (普通转账)
        if value > 0:
            return ContractInfo(
                contract_type=ContractType.TBC
            )
        
        return ContractInfo(
            contract_type=ContractType.UNKNOWN
        )
    
    @staticmethod
    def _extract_ft_contract(script_hex: str) -> Optional[str]:
        """提取 FT 合约ID"""
        # FT 合约ID在 FTape 标记之后
        idx = script_hex.lower().find('4654617065')
        if idx >= 0 and len(script_hex) > idx + 20:
            # 取后续 40 字符作为合约ID
            return script_hex[idx:idx+40]
        return None
    
    @staticmethod
    def _extract_nft_contract(script_hex: str) -> Optional[str]:
        """提取 NFT 合约ID"""
        # 类似 FT 的提取逻辑
        for marker in ['4e54617065', '4e486f6c64']:
            idx = script_hex.lower().find(marker)
            if idx >= 0 and len(script_hex) > idx + 20:
                return script_hex[idx:idx+40]
        return None

class TxClassifier:
    """交易分类器"""
    
    @staticmethod
    def classify(tx_data: dict) -> TxType:
        """识别交易类型"""
        vin = tx_data.get('vin', [])
        
        # Coinbase
        if not vin or vin[0].get('coinbase'):
            return TxType.COINBASE
        
        vout = tx_data.get('vout', [])
        scripts = ' '.join([v.get('scriptPubKey', {}).get('hex', '') for v in vout]).lower()
        
        # Pool
        if '6269736f6e' in scripts:
            if '637265617465' in scripts:
                return TxType.POOL_CREATE
            elif '696e6974' in scripts:
                return TxType.POOL_INIT
            elif '616464' in scripts:
                return TxType.POOL_ADD_LP
            elif '72656d6f7665' in scripts:
                return TxType.POOL_REMOVE_LP
            else:
                return TxType.POOL_SWAP
        
        # NFT
        if '4e54617065' in scripts or '4e486f6c64' in scripts:
            if scripts.count('4d696e74') > 5:  # 多个 Mint
                return TxType.NFT_COLLECTION
            elif '4d696e74' in scripts:
                return TxType.NFT_MINT
            elif '6275726e' in scripts:
                return TxType.NFT_BURN
            else:
                return TxType.NFT_TRANSFER
        
        # FT
        if '4654617065' in scripts:
            if '32436f6465' in scripts:  # "2Code" = Mint
                return TxType.FT_MINT
            elif '6275726e' in scripts:
                return TxType.FT_BURN
            else:
                # 判断 Merge/Split/Transfer
                return TxClassifier._classify_ft_operation(tx_data)
        
        return TxType.P2PKH
    
    @staticmethod
    def _classify_ft_operation(tx_data: dict) -> TxType:
        """分类 FT 操作类型"""
        vin = tx_data.get('vin', [])
        vout = tx_data.get('vout', [])
        
        # 统计 FT 输入输出
        ft_inputs = 0
        ft_outputs = 0
        
        for inp in vin:
            # 需要检查来源交易的输出
            pass  # 简化处理
        
        for out in vout:
            script = out.get('scriptPubKey', {}).get('hex', '')
            if '4654617065' in script:
                ft_outputs += 1
        
        # 简单判断
        if len(vin) > 1 and ft_outputs == 1:
            return TxType.FT_MERGE
        elif len(vin) == 1 and ft_outputs > 1:
            return TxType.FT_SPLIT
        
        return TxType.FT_TRANSFER

class UniversalInputSelector:
    """通用输入选择器 - 智能选择需要追踪的输入"""
    
    def __init__(self, api):
        self.api = api
        self.parser = ContractParser()
    
    async def analyze_inputs(self, tx_data: dict) -> Dict[ContractType, Dict[str, List[UTXO]]]:
        """
        全面分析交易输入，按合约类型和合约ID分组
        返回: {ContractType: {contract_id: [UTXO], ...}, ...}
        """
        vin = tx_data.get('vin', [])
        groups: Dict[ContractType, Dict[str, List[UTXO]]] = {
            ContractType.TBC: {},
            ContractType.FT: {},
            ContractType.NFT: {},
            ContractType.POOL: {},
            ContractType.UNKNOWN: {}
        }
        
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
            
            # 解析合约
            contract = self.parser.parse_output(script, value)
            
            utxo = UTXO(
                txid=source_txid,
                vout=vout_idx,
                value=value,
                contract=contract
            )
            
            # 按合约类型和ID分组
            cid = contract.contract_id or "default"
            if cid not in groups[contract.contract_type]:
                groups[contract.contract_type][cid] = []
            groups[contract.contract_type][cid].append(utxo)
        
        return groups
    
    async def select_for_trace(self, tx_data: dict, tx_type: TxType) -> List[Tuple[str, List[UTXO]]]:
        """
        根据交易类型选择需要追踪的输入
        返回: [(描述, [UTXO]), ...]
        """
        groups = await self.analyze_inputs(tx_data)
        selected = []
        
        if tx_type == TxType.COINBASE:
            return []
        
        # FT Mint: 追踪 TBC 费用
        if tx_type == TxType.FT_MINT:
            if groups[ContractType.TBC]:
                for cid, utxos in groups[ContractType.TBC].items():
                    selected.append((f"TBC费用", utxos))
            return selected
        
        # NFT Mint: 追踪 TBC 费用
        if tx_type == TxType.NFT_MINT:
            if groups[ContractType.TBC]:
                for cid, utxos in groups[ContractType.TBC].items():
                    selected.append((f"TBC费用", utxos))
            return selected
        
        # FT Transfer/Merge/Split: 追踪所有 FT
        if tx_type in [TxType.FT_TRANSFER, TxType.FT_MERGE, TxType.FT_SPLIT]:
            for cid, utxos in groups[ContractType.FT].items():
                selected.append((f"FT-{cid[:10]}...", utxos))
            return selected
        
        # NFT Transfer: 追踪 NFT
        if tx_type == TxType.NFT_TRANSFER:
            for cid, utxos in groups[ContractType.NFT].items():
                selected.append((f"NFT-{cid[:10]}...", utxos))
            return selected
        
        # Pool 相关: 追踪 TBC 和 FT
        if tx_type in [TxType.POOL_CREATE, TxType.POOL_ADD_LP, TxType.POOL_SWAP]:
            for cid, utxos in groups[ContractType.TBC].items():
                selected.append(("TBC", utxos))
            for cid, utxos in groups[ContractType.FT].items():
                selected.append((f"FT-{cid[:10]}...", utxos))
            return selected
        
        # Pool Remove LP: 追踪 LP Token
        if tx_type == TxType.POOL_REMOVE_LP:
            for cid, utxos in groups[ContractType.POOL].items():
                selected.append(("LP", utxos))
            return selected
        
        # P2PKH: 追踪 TBC
        if tx_type == TxType.P2PKH:
            for cid, utxos in groups[ContractType.TBC].items():
                selected.append(("TBC", utxos))
            return selected
        
        return selected

class UniversalTracer:
    """通用溯源器"""
    
    def __init__(self, api, max_depth=50):
        self.api = api
        self.max_depth = max_depth
        self.visited = set()
        self.selector = UniversalInputSelector(api)
    
    async def trace(self, txid: str) -> Tuple[str, TxType, List[TracePath]]:
        """通用溯源入口"""
        target_tx = await self.api.get_transaction(txid)
        if not target_tx:
            return None, None, []
        
        target_type = TxClassifier.classify(target_tx)
        
        print(f"\n{'='*70}")
        print(f"目标交易: {txid}")
        print(f"交易类型: {target_type.value}")
        print(f"{'='*70}")
        
        # 分析所有输入
        all_groups = await self.selector.analyze_inputs(target_tx)
        print(f"\n输入合约分析:")
        for ctype, contracts in all_groups.items():
            if contracts:
                total = sum(len(u) for u in contracts.values())
                print(f"  {ctype.value}: {total} 个 UTXO, {len(contracts)} 个合约")
                for cid, utxos in contracts.items():
                    cid_short = cid[:15] + "..." if len(cid) > 15 else cid
                    values = [u.value for u in utxos]
                    print(f"    - {cid_short}: {len(utxos)} 个, 总额 {sum(values):.4f}")
        
        # 选择需要追踪的输入
        to_trace = await self.selector.select_for_trace(target_tx, target_type)
        print(f"\n选择追踪 {len(to_trace)} 组输入:")
        for desc, utxos in to_trace:
            total = sum(u.value for u in utxos)
            print(f"  - {desc}: {len(utxos)} 个 UTXO, 总额 {total:.4f}")
        
        # 追踪每组
        paths = []
        path_id = 1
        for desc, utxos in to_trace:
            for utxo in utxos:
                path = await self._trace_single(utxo, path_id, desc)
                if path:
                    paths.append(path)
                    path_id += 1
        
        return txid, target_type, paths
    
    async def _trace_single(self, start_utxo: UTXO, path_id: int, desc: str) -> TracePath:
        """追踪单条路径"""
        nodes = []
        current = start_utxo
        depth = 0
        
        contract_info = f"({current.contract.contract_type.value})"
        print(f"\n[路径{path_id}] {desc} {contract_info}")
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
            
            tx_type = TxClassifier.classify(tx)
            
            node = TraceNode(
                txid=current.txid,
                tx_type=tx_type,
                depth=depth,
                utxo=current,
                timestamp=tx.get('time')
            )
            nodes.append(node)
            
            if depth <= 3 or depth % 10 == 0:
                ctype = current.contract.contract_type.value
                print(f"    深度{depth}: {tx_type.value} [{ctype}] {current.value:.4f}")
            
            if tx_type == TxType.COINBASE:
                print(f"    ✓✓✓ 到达 Coinbase!")
                break
            
            # 选择下一个
            next_groups = await self.selector.select_for_trace(tx, tx_type)
            if not next_groups:
                break
            
            # 找匹配的合约类型继续追踪
            found = False
            for desc2, utxos2 in next_groups:
                for u2 in utxos2:
                    if u2.contract.contract_type == current.contract.contract_type:
                        current = u2
                        found = True
                        break
                if found:
                    break
            
            if not found:
                # 默认选第一个
                current = next_groups[0][1][0]
            
            depth += 1
        
        return TracePath(path_id, start_utxo.contract, nodes)

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

async def main():
    txid = "c340f810b98039ddd37fef357f947f37c3735733cf23c858727ec10a3008e0a9"
    
    print("=" * 70)
    print("TBC 全类型智能溯源引擎")
    print("=" * 70)
    
    async with TBCAPIClient() as api:
        tracer = UniversalTracer(api, max_depth=15)
        target_txid, target_type, paths = await tracer.trace(txid)
        
        print(f"\n{'='*70}")
        print("溯源完成")
        print(f"{'='*70}")
        print(f"\n总路径数: {len(paths)}")
        print(f"API 调用: {api.request_count} 次")
        
        for path in paths:
            print(f"\n路径 {path.path_id} ({path.contract.contract_type.value}):")
            print(f"  深度: {len(path.nodes)}")
            if path.nodes:
                print(f"  起点: {path.nodes[0].tx_type.value}")
                print(f"  终点: {path.nodes[-1].tx_type.value}")

if __name__ == "__main__":
    asyncio.run(main())
