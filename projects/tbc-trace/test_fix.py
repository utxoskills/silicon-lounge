import asyncio
import aiohttp
import json

async def test_api():
    txid = "24e614dbc9247dccdcfc70fdffe580a1ef64dcee07fe70293d31690da3319927"
    url = f"https://api.turingbitchain.io/api/tbc/decode/txid/{txid}"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json()
            print(f"Response code: {data.get('code')}")
            print(f"Message: {data.get('message')}")
            
            tx_data = data.get('data', {})
            print(f"\nTransaction ID: {tx_data.get('txid')}")
            print(f"Size: {tx_data.get('size')}")
            print(f"Version: {tx_data.get('version')}")
            print(f"VIN count: {len(tx_data.get('vin', []))}")
            print(f"VOUT count: {len(tx_data.get('vout', []))}")
            
            # 检查第一个输入
            vin = tx_data.get('vin', [])
            if vin:
                first_vin = vin[0]
                print(f"\nFirst input:")
                print(f"  txid: {first_vin.get('txid')}")
                print(f"  vout: {first_vin.get('vout')}")
                print(f"  value: {first_vin.get('value')}")

asyncio.run(test_api())
