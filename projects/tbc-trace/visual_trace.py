"""
TBC 可视化溯源 - 完整实现
"""

import asyncio
import aiohttp
import sys
sys.path.insert(0, '/Users/jay/.openclaw/workspace/projects/tbc-trace')

from tbc_trace.visualizer import GraphvizGenerator, TxType, AssetType, TraceNode, TracePath, UTXO

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
            if '32436f6465' in scripts:
                return TxType.FT_MINT
            return TxType.FT_TRANSFER
        
        if '4e54617065' in scripts or '4e486f6c64' in scripts:
            return TxType.NFT_TRANSFER
        
        if '6269736f6e' in scripts:
            return TxType.POOL_SWAP
        
        return TxType.P2PKH


class VisualTracer:
    def __init__(self, api, max_depth=50):
        self.api = api
        self.max_depth = max_depth
        self.visited = set()
    
    async def trace(self, txid):
        """溯源并返回路径"""
        target_tx = await self.api.get_transaction(txid)
        if not target_tx:
            return None, None, []
        
        target_type = TxClassifier.classify(target_tx)
        print(f"目标交易类型: {target_type.value}")
        
        # 获取输入
        vin = target_tx.get('vin', [])
        paths = []
        
        for i, inp in enumerate(vin[:2]):  # 只追踪前2个输入
            path = await self._trace_input(inp, i+1)
            if path:
                paths.append(path)
        
        return txid, target_type, paths
    
    async def _trace_input(self, inp, path_id):
        """追踪单个输入"""
        txid = inp.get('txid')
        vout = inp.get('vout')
        
        nodes = []
        current_txid = txid
        depth = 0
        
        print(f"\n[路径{path_id}] 开始追踪: {txid[:20]}...")
        
        while depth < self.max_depth:
            if current_txid in self.visited:
                print(f"  深度{depth}: 检测到循环")
                break
            self.visited.add(current_txid)
            
            tx = await self.api.get_transaction(current_txid)
            if not tx:
                break
            
            tx_type = TxClassifier.classify(tx)
            vout_data = tx.get('vout', [])
            value = vout_data[vout]['value'] if vout < len(vout_data) else 0
            
            node = TraceNode(
                txid=current_txid,
                tx_type=tx_type,
                depth=depth,
                utxo=UTXO(current_txid, vout, AssetType.TBC, value),
                block_height=tx.get('height')
            )
            nodes.append(node)
            
            if depth <= 3 or depth % 10 == 0:
                print(f"  深度{depth}: {tx_type.value} - {current_txid[:20]}... ({value:.4f})")
            
            if tx_type == TxType.COINBASE:
                print(f"  ✓✓✓ 找到 Coinbase!")
                break
            
            # 继续追踪第一个输入
            vin = tx.get('vin', [])
            if vin:
                current_txid = vin[0].get('txid')
                vout = vin[0].get('vout')
                depth += 1
            else:
                break
        
        return TracePath(path_id, AssetType.TBC, nodes)


async def main():
    txid = "c340f810b98039ddd37fef357f947f37c3735733cf23c858727ec10a3008e0a9"
    
    print("=" * 80)
    print("TBC 可视化溯源")
    print("=" * 80)
    print(f"目标交易: {txid}\n")
    
    async with TBCAPIClient() as api:
        tracer = VisualTracer(api, max_depth=30)
        target_txid, target_type, paths = await tracer.trace(txid)
        
        if not paths:
            print("溯源失败")
            return
        
        # 生成 Graphviz DOT
        generator = GraphvizGenerator()
        dot_code = generator.generate(target_txid, target_type, paths)
        
        # 保存 DOT 文件
        dot_file = "/tmp/tbc_trace.dot"
        with open(dot_file, "w") as f:
            f.write(dot_code)
        
        print(f"\n{'='*80}")
        print("Graphviz DOT 代码已生成:")
        print(f"{'='*80}\n")
        print(dot_code)
        
        print(f"\n{'='*80}")
        print("ASCII 流程图:")
        print(f"{'='*80}\n")
        ascii_art = generator.generate_ascii(target_txid, target_type, paths)
        print(ascii_art)
        
        print(f"\n{'='*80}")
        print(f"统计: API调用 {api.request_count} 次")
        print(f"DOT 文件保存至: {dot_file}")
        print(f"{'='*80}")
        
        # 尝试生成 PNG（如果安装了 graphviz）
        try:
            import subprocess
            png_file = "/tmp/tbc_trace.png"
            result = subprocess.run(
                ["dot", "-Tpng", dot_file, "-o", png_file],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                print(f"PNG 图片已生成: {png_file}")
            else:
                print(f"生成 PNG 失败: {result.stderr}")
                print("请手动运行: dot -Tpng /tmp/tbc_trace.dot -o /tmp/tbc_trace.png")
        except FileNotFoundError:
            print("未安装 graphviz，无法生成 PNG 图片")
            print("安装命令: brew install graphviz (macOS) 或 apt-get install graphviz (Linux)")

if __name__ == "__main__":
    asyncio.run(main())
