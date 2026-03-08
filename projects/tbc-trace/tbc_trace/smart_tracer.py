"""
TBC 智能溯源引擎 - 根据交易类型选择正确的溯源路径
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Set, Callable
from enum import Enum, auto
from datetime import datetime


class TxType(Enum):
    """TBC 交易类型"""
    COINBASE = auto()
    P2PKH = auto()
    FT_TRANSFER = auto()
    FT_MINT = auto()
    FT_MERGE = auto()
    FT_SPLIT = auto()
    NFT_MINT = auto()
    NFT_TRANSFER = auto()
    NFT_COLLECTION = auto()
    POOL_CREATE = auto()
    POOL_INIT = auto()
    POOL_ADD_LP = auto()
    POOL_REMOVE_LP = auto()
    POOL_SWAP_TBC_TO_FT = auto()
    POOL_SWAP_FT_TO_TBC = auto()
    UNKNOWN = auto()


class AssetType(Enum):
    """资产类型"""
    TBC = auto()
    FT = auto()
    NFT = auto()
    LP = auto()


@dataclass
class UTXO:
    """UTXO 引用"""
    txid: str
    vout: int
    asset_type: AssetType = AssetType.TBC
    value: float = 0.0
    token_id: Optional[str] = None  # FT/NFT 的合约ID


@dataclass
class TraceNode:
    """溯源节点"""
    txid: str
    tx_type: TxType
    depth: int
    utxo: UTXO
    children: List['TraceNode'] = field(default_factory=list)
    parent: Optional['TraceNode'] = None


@dataclass
class TraceResult:
    """溯源结果"""
    target_txid: str
    target_type: TxType
    paths: List[List[TraceNode]]
    total_depth: int
    api_calls: int
    elapsed_time: float


class TBCAPIClient:
    """TBC API 客户端"""
    
    def __init__(self, base_url: str = "https://api.turingbitchain.io/api/tbc"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.cache: Dict[str, dict] = {}
        self.request_count = 0
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=100)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def get_transaction(self, txid: str) -> Optional[dict]:
        """获取交易数据（带缓存）"""
        if txid in self.cache:
            return self.cache[txid]
        
        url = f"{self.base_url}/decode/txid/{txid}"
        try:
            async with self.session.get(url) as resp:
                self.request_count += 1
                data = await resp.json()
                if data.get('code') == '200':
                    tx_data = data.get('data', {})
                    self.cache[txid] = tx_data
                    return tx_data
        except Exception as e:
            print(f"Error fetching {txid}: {e}")
        return None


class TxTypeClassifier:
    """交易类型分类器"""
    
    MARKERS = {
        'FTape': '4654617065',
        'NTape': '4e54617065',
        'NHold': '4e486f6c64',
        'Bison': '6269736f6e',
        '2Code': '32436f6465',
    }
    
    @classmethod
    def classify(cls, tx_data: dict) -> TxType:
        """识别交易类型"""
        vin = tx_data.get('vin', [])
        
        # Coinbase - 没有输入或第一个输入是 coinbase
        if not vin or vin[0].get('coinbase'):
            return TxType.COINBASE
        
        # 收集所有脚本
        vout = tx_data.get('vout', [])
        all_scripts = ' '.join([v.get('scriptPubKey', {}).get('hex', '') for v in vout])
        scripts_lower = all_scripts.lower()
        
        # Pool 相关
        if cls.MARKERS['Bison'].lower() in scripts_lower:
            if cls.MARKERS['2Code'].lower() in scripts_lower:
                return TxType.POOL_CREATE
            # 进一步判断 Pool 类型...
            return TxType.POOL_SWAP_TBC_TO_FT
        
        # NFT
        if cls.MARKERS['NTape'].lower() in scripts_lower or cls.MARKERS['NHold'].lower() in scripts_lower:
            mint_count = scripts_lower.count('4d696e74')  # "Mint"
            if mint_count > 5:
                return TxType.NFT_COLLECTION
            if mint_count > 0:
                return TxType.NFT_MINT
            return TxType.NFT_TRANSFER
        
        # FT
        if cls.MARKERS['FTape'].lower() in scripts_lower:
            if cls.MARKERS['2Code'].lower() in scripts_lower:
                return TxType.FT_MINT
            # 判断 Merge/Split/Transfer
            return cls._classify_ft_type(tx_data)
        
        return TxType.P2PKH
    
    @classmethod
    def _classify_ft_type(cls, tx_data: dict) -> TxType:
        """进一步分类 FT 交易"""
        vin = tx_data.get('vin', [])
        vout = tx_data.get('vout', [])
        
        # 统计 FT 输入输出数量
        ft_inputs = sum(1 for v in vin if cls._is_ft_input(v))
        ft_outputs = sum(1 for v in vout if cls._is_ft_output(v))
        
        if ft_inputs > 1 and ft_outputs == 1:
            return TxType.FT_MERGE
        elif ft_inputs == 1 and ft_outputs > 1:
            return TxType.FT_SPLIT
        else:
            return TxType.FT_TRANSFER
    
    @classmethod
    def _is_ft_input(cls, vin: dict) -> bool:
        """检查输入是否是 FT"""
        # 需要通过来源交易的输出判断
        return True  # 简化处理
    
    @classmethod
    def _is_ft_output(cls, vout: dict) -> bool:
        """检查输出是否是 FT"""
        script = vout.get('scriptPubKey', {}).get('hex', '')
        return cls.MARKERS['FTape'].lower() in script.lower()


class InputSelector:
    """输入选择器 - 根据交易类型选择应该追踪的输入"""
    
    def __init__(self, api: TBCAPIClient):
        self.api = api
    
    async def select_inputs(self, tx_data: dict, tx_type: TxType) -> List[UTXO]:
        """
        根据交易类型选择需要追踪的输入
        返回多个 UTXO，每个代表一条溯源路径
        """
        vin = tx_data.get('vin', [])
        
        selectors = {
            TxType.COINBASE: self._select_coinbase,
            TxType.P2PKH: self._select_p2pkh,
            TxType.FT_TRANSFER: self._select_ft_transfer,
            TxType.FT_MINT: self._select_ft_mint,
            TxType.FT_MERGE: self._select_ft_merge,
            TxType.FT_SPLIT: self._select_ft_split,
            TxType.NFT_MINT: self._select_nft_mint,
            TxType.NFT_TRANSFER: self._select_nft_transfer,
            TxType.NFT_COLLECTION: self._select_nft_collection,
            TxType.POOL_CREATE: self._select_pool_create,
            TxType.POOL_ADD_LP: self._select_pool_add_lp,
            TxType.POOL_REMOVE_LP: self._select_pool_remove_lp,
            TxType.POOL_SWAP_TBC_TO_FT: self._select_pool_swap_tbc_to_ft,
            TxType.POOL_SWAP_FT_TO_TBC: self._select_pool_swap_ft_to_tbc,
        }
        
        selector = selectors.get(tx_type, self._select_default)
        return await selector(tx_data, vin)
    
    async def _select_coinbase(self, tx_data, vin):
        """Coinbase 没有输入，返回空"""
        return []
    
    async def _select_p2pkh(self, tx_data, vin):
        """P2PKH: 追踪所有 TBC 输入"""
        utxos = []
        for inp in vin:
            utxos.append(UTXO(
                txid=inp.get('txid'),
                vout=inp.get('vout'),
                asset_type=AssetType.TBC
            ))
        return utxos
    
    async def _select_ft_transfer(self, tx_data, vin):
        """
        FT Transfer: 主要追踪 FT 的来源
        次要追踪 TBC 手续费来源
        """
        utxos = []
        
        for inp in vin:
            source_txid = inp.get('txid')
            vout_idx = inp.get('vout')
            
            # 获取来源交易判断类型
            source_tx = await self.api.get_transaction(source_txid)
            if source_tx:
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    output = source_vout[vout_idx]
                    script = output.get('scriptPubKey', {}).get('hex', '')
                    
                    # 判断是否是 FT 输出
                    if '4654617065' in script:
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.FT,
                            value=output.get('value', 0)
                        ))
                    elif output.get('value', 0) > 0:
                        # TBC 输出
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.TBC,
                            value=output.get('value', 0)
                        ))
        
        # 优先返回 FT，如果没有则返回 TBC
        ft_utxos = [u for u in utxos if u.asset_type == AssetType.FT]
        if ft_utxos:
            return ft_utxos
        return utxos
    
    async def _select_ft_mint(self, tx_data, vin):
        """
        FT Mint: 追踪 TBC 来源（支付铸造费用）
        FT 是新创建的，没有来源
        """
        utxos = []
        for inp in vin:
            source_txid = inp.get('txid')
            vout_idx = inp.get('vout')
            
            source_tx = await self.api.get_transaction(source_txid)
            if source_tx:
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    output = source_vout[vout_idx]
                    value = output.get('value', 0)
                    
                    # FT Mint 只关心 TBC 输入（手续费）
                    if value > 0:
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.TBC,
                            value=value
                        ))
        
        return utxos
    
    async def _select_ft_merge(self, tx_data, vin):
        """
        FT Merge: 追踪所有 FT 输入
        合并多个 FT UTXO 成一个
        """
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
                    
                    # 只追踪 FT 输入
                    if '4654617065' in script:
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.FT,
                            value=output.get('value', 0)
                        ))
        
        return utxos
    
    async def _select_ft_split(self, tx_data, vin):
        """
        FT Split: 追踪 FT 输入
        将一个 FT UTXO 拆分成多个
        """
        # 和 Transfer 类似，找 FT 输入
        return await self._select_ft_transfer(tx_data, vin)
    
    async def _select_nft_mint(self, tx_data, vin):
        """
        NFT Mint: 追踪 TBC 来源（支付铸造费用）
        """
        return await self._select_ft_mint(tx_data, vin)
    
    async def _select_nft_transfer(self, tx_data, vin):
        """
        NFT Transfer: 追踪 NFT 的来源
        """
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
                    
                    # 判断是否是 NFT 输出
                    if '4e54617065' in script or '4e486f6c64' in script:
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.NFT,
                            value=output.get('value', 0)
                        ))
        
        return utxos
    
    async def _select_nft_collection(self, tx_data, vin):
        """NFT Collection: 追踪 TBC 来源"""
        return await self._select_ft_mint(tx_data, vin)
    
    async def _select_pool_create(self, tx_data, vin):
        """Pool Create: 追踪 TBC 和 FT 来源"""
        # 创建池子需要 TBC 和 FT
        return await self._select_p2pkh(tx_data, vin)
    
    async def _select_pool_add_lp(self, tx_data, vin):
        """Pool Add LP: 追踪 TBC 和 FT 来源"""
        return await self._select_p2pkh(tx_data, vin)
    
    async def _select_pool_remove_lp(self, tx_data, vin):
        """Pool Remove LP: 追踪 LP Token 来源"""
        utxos = []
        for inp in vin:
            utxos.append(UTXO(
                txid=inp.get('txid'),
                vout=inp.get('vout'),
                asset_type=AssetType.LP
            ))
        return utxos
    
    async def _select_pool_swap_tbc_to_ft(self, tx_data, vin):
        """
        Pool Swap (TBC→FT): 追踪 TBC 来源
        用户用 TBC 换 FT
        """
        utxos = []
        for inp in vin:
            source_txid = inp.get('txid')
            vout_idx = inp.get('vout')
            
            source_tx = await self.api.get_transaction(source_txid)
            if source_tx:
                source_vout = source_tx.get('vout', [])
                if vout_idx < len(source_vout):
                    output = source_vout[vout_idx]
                    value = output.get('value', 0)
                    
                    # 追踪 TBC 输入
                    if value > 0 and '4654617065' not in output.get('scriptPubKey', {}).get('hex', ''):
                        utxos.append(UTXO(
                            txid=source_txid,
                            vout=vout_idx,
                            asset_type=AssetType.TBC,
                            value=value
                        ))
        
        return utxos
    
    async def _select_pool_swap_ft_to_tbc(self, tx_data, vin):
        """
        Pool Swap (FT→TBC): 追踪 FT 来源
        用户用 FT 换 TBC
        """
        return await self._select_ft_transfer(tx_data, vin)
    
    async def _select_default(self, tx_data, vin):
        """默认：追踪所有输入"""
        return await self._select_p2pkh(tx_data, vin)


class SmartTracer:
    """智能溯源引擎"""
    
    def __init__(self, api: TBCAPIClient, max_depth: int = 100):
        self.api = api
        self.max_depth = max_depth
        self.selector = InputSelector(api)
        self.visited: Set[str] = set()
    
    async def trace(self, txid: str) -> TraceResult:
        """智能溯源入口"""
        start_time = datetime.now()
        self.visited.clear()
        
        # 获取目标交易
        target_tx = await self.api.get_transaction(txid)
        if not target_tx:
            raise Exception(f"无法获取交易: {txid}")
        
        # 识别交易类型
        tx_type = TxTypeClassifier.classify(target_tx)
        print(f"\n目标交易类型: {tx_type.name}")
        
        # 选择需要追踪的输入
        inputs = await self.selector.select_inputs(target_tx, tx_type)
        print(f"识别到 {len(inputs)} 条溯源路径:")
        for i, utxo in enumerate(inputs):
            print(f"  路径{i+1}: {utxo.asset_type.name} - {utxo.txid[:20]}...:{utxo.vout}")
        
        # 并发追踪所有路径
        tasks = [self._trace_path(utxo, i+1) for i, utxo in enumerate(inputs)]
        paths = await asyncio.gather(*tasks)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        
        return TraceResult(
            target_txid=txid,
            target_type=tx_type,
            paths=[p for p in paths if p],
            total_depth=max((len(p) for p in paths if p), default=0),
            api_calls=self.api.request_count,
            elapsed_time=elapsed
        )
    
    async def _trace_path(self, start_utxo: UTXO, path_id: int) -> List[TraceNode]:
        """追踪单条路径"""
        nodes = []
        current_utxo = start_utxo
        depth = 0
        
        print(f"\n[路径{path_id}] 开始追踪 {start_utxo.asset_type.name}...")
        
        while depth < self.max_depth:
            # 防止循环
            cache_key = f"{current_utxo.txid}:{current_utxo.vout}"
            if cache_key in self.visited:
                print(f"  [路径{path_id}] 深度{depth}: 检测到循环")
                break
            self.visited.add(cache_key)
            
            # 获取交易
            tx = await self.api.get_transaction(current_utxo.txid)
            if not tx:
                print(f"  [路径{path_id}] 深度{depth}: 无法获取交易")
                break
            
            # 识别类型
            tx_type = TxTypeClassifier.classify(tx)
            
            # 创建节点
            node = TraceNode(
                txid=current_utxo.txid,
                tx_type=tx_type,
                depth=depth,
                utxo=current_utxo
            )
            nodes.append(node)
            
            # 打印进度
            if depth <= 5 or depth % 10 == 0:
                print(f"  [路径{path_id}] 深度{depth}: {tx_type.name} - {current_utxo.txid[:20]}...")
            
            # 检查是否是终点
            if tx_type == TxType.COINBASE:
                print(f"  [路径{path_id}] ✓✓✓ 找到 Coinbase!")
                break
            
            # 选择下一个输入
            next_inputs = await self.selector.select_inputs(tx, tx_type)
            if not next_inputs:
                print(f"  [路径{path_id}] 深度{depth}: 没有更多输入")
                break
            
            # 继续追踪第一个匹配的输入
            current_utxo = next_inputs[0]
            depth += 1
        
        return nodes


async def main():
    """测试智能溯源"""
    test_txid = "c340f810b98039ddd37fef357f947f37c3735733cf23c858727ec10a3008e0a9"
    
    async with TBCAPIClient() as api:
        tracer = SmartTracer(api, max_depth=50)
        result = await tracer.trace(test_txid)
        
        print(f"\n{'='*60}")
        print("智能溯源完成!")
        print(f"{'='*60}")
        print(f"目标交易: {result.target_txid}")
        print(f"交易类型: {result.target_type.name}")
        print(f"溯源路径: {len(result.paths)} 条")
        print(f"最大深度: {result.total_depth}")
        print(f"API 调用: {result.api_calls}")
        print(f"耗时: {result.elapsed_time:.2f} 秒")


if __name__ == "__main__":
    asyncio.run(main())
