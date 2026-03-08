import asyncio
from datetime import datetime
from tbc_trace.tracer import TBCAPIClient, TBCTracer, TraceReporter

async def test():
    # NFT 铸造交易
    TEST_TX = "24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927"
    
    print(f"测试交易: {TEST_TX}")
    print("交易类型: NFT Collection Create")
    print("开始溯源...\n")
    
    async with TBCAPIClient() as api:
        tracer = TBCTracer(api, max_depth=15)
        
        start = datetime.now()
        result = await tracer.trace(TEST_TX)
        elapsed = (datetime.now() - start).total_seconds()
        
        TraceReporter.print_report(result)
        
        print(f"\n性能统计:")
        print(f"  API 请求: {api._request_count}")
        print(f"  耗时: {elapsed:.2f} 秒")
        
        # 验证
        all_coinbase = all(path.end_tx.is_coinbase for path in result.paths)
        print(f"\n验证结果:")
        print(f"  ✓ 全部到达 Coinbase: {all_coinbase}")
        
        if not all_coinbase:
            for i, path in enumerate(result.paths):
                if not path.end_tx.is_coinbase:
                    print(f"  ✗ 路径 {i+1} 未到达 Coinbase，终点: {path.end_tx.tx_type.value}")

asyncio.run(test())
