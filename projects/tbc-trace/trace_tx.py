import asyncio
import sys
sys.path.insert(0, '.')

from tbc_trace.tracer_fixed import TBCAPIClient, TBCTracer, TraceReporter
from datetime import datetime

async def trace_transaction(txid):
    print(f"\n{'='*70}")
    print(f"溯源交易: {txid}")
    print(f"{'='*70}\n")
    
    async with TBCAPIClient() as api:
        tracer = TBCTracer(api, max_depth=15)
        
        start = datetime.now()
        result = await tracer.trace(txid)
        elapsed = (datetime.now() - start).total_seconds()
        
        # 打印报告
        TraceReporter.print_report(result)
        
        # 统计
        print(f"\n性能统计:")
        print(f"  API 请求: {api._request_count}")
        print(f"  耗时: {elapsed:.2f} 秒")
        
        # 验证
        all_coinbase = all(path.end_tx.is_coinbase for path in result.paths)
        print(f"\n验证: {'✓ 全部到达 Coinbase' if all_coinbase else '✗ 有路径未到达 Coinbase'}")

# 要溯源的交易
txid = "c340f810b98039ddd37fef357f947f37c3735733cf23c858727ec10a3008e0a9"

asyncio.run(trace_transaction(txid))
