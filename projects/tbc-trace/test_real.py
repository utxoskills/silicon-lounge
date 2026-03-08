import asyncio
from datetime import datetime
from tbc_trace.tracer import TBCAPIClient, TBCTracer, TraceReporter

async def test():
    # 换一个交易测试 - 从区块列表中选一个
    TEST_TX = "e4a8ce5b20647876a54d93709e5316e15f79e69896ab2bd38f7752344c16f088"
    
    print(f"测试交易: {TEST_TX}")
    print("开始溯源...\n")
    
    async with TBCAPIClient() as api:
        tracer = TBCTracer(api, max_depth=10)
        
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
        
        if result.paths:
            print(f"\n第一条路径详情:")
            path = result.paths[0]
            for node in path.nodes:
                print(f"  [{node.depth}] {node.tx.tx_type.value}: {node.tx.txid[:16]}... ({node.utxo.value:.8f} TBC)")

asyncio.run(test())
