# TBC技术学习记录 - FT合约深度分析

**学习时间:** 2026-03-04  
**学习范围:** FT (Fungible Token) 合约源码  
**源码路径:** `/Users/jay/.openclaw/workspace/tbc-contract-code/lib/contract/ft.js`

---

## 1. FT合约架构

### 1.1 核心属性
```javascript
class FT {
    name;           // 代币名称
    symbol;         // 代币符号
    decimal;        // 精度 (1-18)
    totalSupply;    // 总供应量 (BigInt)
    codeScript;     // 锁定脚本 (hex)
    tapeScript;     // 数据脚本 (hex)
    contractTxid;   // 合约交易ID
}
```

### 1.2 构造函数逻辑
- 支持两种初始化方式：
  1. **通过txid**: 已有合约，后续调用initialize()加载详情
  2. **通过参数**: 创建新代币，设置name/symbol/decimal/amount

### 1.3 参数验证规则
```javascript
// 金额验证
if (amount <= 0) throw new Error('Amount must be a natural number');

// 精度验证
if (!Number.isInteger(decimal) || decimal <= 0 || decimal > 18) {
    throw new Error('Decimal must be a positive integer not exceeding 18');
}

// 最大供应量限制
const maxAmount = parseDecimalToBigInt(1, 18 - decimal);
if (BigInt(amount) > maxAmount) {
    throw new Error(`When decimal is ${decimal}, max amount cannot exceed ${maxAmount}`);
}
```

---

## 2. 铸造 (Mint) 流程

### 2.1 交易结构
```
TxSource (预备交易)
├── Input: UTXO (用于支付手续费)
├── Output[0]: 找零输出 (9900 satoshis)
│   └── Script: P2PKH + OP_RETURN "for ft mint"
├── Output[1]: Tape脚本 (satoshis=0)
│   └── Script: OP_FALSE OP_RETURN {amount} {decimal} {name} {symbol} 4654617065
└── Change: 找零地址

TxMint (铸造交易)
├── Input[0]: TxSource.output[0]
├── Output[0]: Code脚本 (500 satoshis)
│   └── Script: 通过getFTmintCode()生成
├── Output[1]: Tape脚本 (0 satoshis)
└── Change: 找零
```

### 2.2 Tape脚本格式
```javascript
const tapeScript = tbc.Script.fromASM(
    `OP_FALSE OP_RETURN ${tapeAmount} ${decimalHex} ${nameHex} ${symbolHex} 4654617065`
);
// 4654617065 = "FTape" in hex
```

### 2.3 金额编码
```javascript
// 6个uint64LE，每个8字节，共48字节
const amountwriter = new tbc.encoding.BufferWriter();
amountwriter.writeUInt64LEBN(amountbn);  // 实际金额
for (let i = 1; i < 6; i++) {
    amountwriter.writeUInt64LEBN(new tbc.crypto.BN(0));  // 补零
}
const tapeAmount = amountwriter.toBuffer().toString('hex');
```

---

## 3. 转账 (Transfer) 流程

### 3.1 核心方法签名
```javascript
transfer(
    privateKey_from,  // 发送方私钥
    address_to,       // 接收方地址
    ft_amount,        // 转账金额
    ftutxo_a,         // FT UTXO输入列表
    utxo,             // TBC UTXO (用于手续费)
    preTX,            // 前置交易列表
    prepreTxData,     // 前前置交易数据
    tbc_amount        // 可选：同时转账TBC
)
```

### 3.2 余额检查逻辑
```javascript
// 计算输入总额
let tapeAmountSum = BigInt(0);
for (let i = 0; i < ftutxo_a.length; i++) {
    tapeAmountSetIn.push(ftutxo_a[i].ftBalance);
    tapeAmountSum += BigInt(tapeAmountSetIn[i]);
}

// 检查余额充足
if (amountbn > tapeAmountSum) {
    throw new Error('Insufficient balance, please add more FT UTXOs');
}
```

### 3.3 交易输出构建
```javascript
const tx = new tbc.Transaction()
    .from(ftutxo_a)      // FT输入
    .from(utxo);         // TBC输入(手续费)

// 输出1: 接收方Code脚本
tx.addOutput(new tbc.Transaction.Output({
    script: FT.buildFTtransferCode(code, address_to),
    satoshis: 500
}));

// 输出2: 转账金额Tape脚本
tx.addOutput(new tbc.Transaction.Output({
    script: FT.buildFTtransferTape(tape, amountHex),
    satoshis: 0
}));

// 可选：同时转账TBC
if (tbc_amount) {
    tx.to(address_to, parseDecimalToBigInt(tbc_amount, 6));
}

// 输出3&4: 找零(如果有)
if (amountbn < tapeAmountSum) {
    tx.addOutput({ script: changeCodeScript, satoshis: 500 });
    tx.addOutput({ script: changeTapeScript, satoshis: 0 });
}
```

### 3.4 解锁脚本设置
```javascript
for (let i = 0; i < ftutxo_a.length; i++) {
    tx.setInputScript({ inputIndex: i }, (tx) => {
        const unlockingScript = this.getFTunlock(
            privateKey, tx, preTX[i], prepreTxData[i], 
            i, ftutxo_a[i].outputIndex
        );
        return unlockingScript;
    });
}
```

---

## 4. 脚本构建方法

### 4.1 buildFTtransferCode - 构建Code脚本
```javascript
static buildFTtransferCode(code, addressOrHash) {
    if (tbc.Address.isValid(addressOrHash)) {
        // 地址模式：hash160 + 0x00
        const publicKeyHashBuffer = tbc.Address.fromString(addressOrHash).hashBuffer;
        const hashBuffer = Buffer.concat([publicKeyHashBuffer, Buffer.from([0x00])]);
    } else {
        // Hash模式：hash + 0x01
        const hash = addressOrHash + '01';
        const hashBuffer = Buffer.from(hash, 'hex');
    }
    
    // 替换脚本倒数第二个chunk的buf
    const codeScript = tbc.Script.fromHex(code);
    codeScript.chunks[codeScript.chunks.length - 2].buf = hashBuffer;
    return tbc.Script.fromASM(codeScript.toASM());
}
```

### 4.2 buildFTtransferTape - 构建Tape脚本
```javascript
static buildFTtransferTape(tape, amountHex) {
    const amountHexBuffer = Buffer.from(amountHex, 'hex');
    const tapeBuffer = Buffer.from(tape, 'hex');
    
    // 替换tape中第3字节开始的48字节(6个uint64LE)
    amountHexBuffer.copy(tapeBuffer, 3, 0, 48);
    
    return new tbc.Script(tapeBuffer.toString('hex'));
}
```

### 4.3 buildTapeAmount - 金额分配算法
```javascript
static buildTapeAmount(amountBN, tapeAmountSetIn, ftInputIndex) {
    // 遍历6个输入槽位，分配金额
    for (i = 0; i < 6; i++) {
        if (amountBN <= BigInt(0)) break;
        
        if (tapeAmountSet[i] < amountBN) {
            // 当前槽位金额不足，全部使用
            amountwriter.writeUInt64LEBN(new tbc.crypto.BN(tapeAmountSet[i].toString()));
            changewriter.writeUInt64LEBN(new tbc.crypto.BN(0));
            amountBN -= BigInt(tapeAmountSet[i]);
        } else {
            // 当前槽位金额充足，使用部分
            amountwriter.writeUInt64LEBN(new tbc.crypto.BN(amountBN.toString()));
            changewriter.writeUInt64LEBN(new tbc.crypto.BN((BigInt(tapeAmountSet[i]) - amountBN).toString()));
            amountBN = BigInt(0);
        }
    }
    
    return { amountHex, changeHex };
}
```

---

## 5. 关键发现

### 5.1 UTXO模型特点
- TBC FT使用**UTXO模型**，不是账户模型
- 每个FT UTXO包含Code脚本和Tape脚本
- 转账时需要消耗旧的UTXO，创建新的UTXO

### 5.2 脚本结构
- **Code脚本**: 锁定脚本，包含公钥哈希，用于验证所有权
- **Tape脚本**: 数据脚本，包含金额、精度、名称等信息
- 每个输出固定500 satoshis (Code) + 0 satoshis (Tape)

### 5.3 多输入处理
- 支持最多6个FT UTXO作为输入
- 通过遍历分配金额到各个槽位
- 剩余金额自动作为找零

### 5.4 解锁机制
- 使用`getFTunlock()`生成解锁脚本
- 需要当前交易、前置交易、前前置交易数据
- 使用partial-sha256优化大脚本处理

---

## 6. 技术要点总结

1. **BigInt处理**: 金额计算使用BigInt避免精度丢失
2. **Buffer操作**: 大量使用Buffer进行hex/bytes转换
3. **UTXO选择**: 需要手动管理FT UTXO输入
4. **交易链**: 需要preTX和prepreTxData来构建解锁脚本
5. **脚本模板**: Code脚本通过修改模板中的hash来变更所有者

---

## 7. 重要修正 (2026-03-05)

### 关于 FT Mint vs FT Transfer 的判断

**之前的错误理解:**
- ❌ 认为有 `2Code` (32436f6465) 就是 Mint
- ❌ 通过输出脚本中是否有 2Code 来判断

**正确的理解:**
- ✅ **应该看输入类型**
- **FT Mint**: 输入是 **TBC** (支付铸造费用)，输出是新的 FT
- **FT Transfer**: 输入是 **FT** (已有的代币)，输出是转移后的 FT

### SDK 代码验证

**Mint 的 Code 脚本** (`getFTmintCode`):
```javascript
// 末尾有 2Code
0x05 0x32436f6465
```

**Transfer 的 Code 脚本** (`buildFTtransferCode`):
```javascript
// 直接复制/修改原 Code 脚本，保留所有标记
// 如果原脚本有 2Code，Transfer 后也有
```

### 正确的判断逻辑

```python
# 分析交易输入
ft_inputs = []   # FT UTXO 输入
tbc_inputs = []  # TBC UTXO 输入

for input in tx.inputs:
    if input.script contains '4654617065':  # FTape
        ft_inputs.append(input)
    else:
        tbc_inputs.append(input)

# 判断类型
if ft_inputs and ft_outputs:
    return "FT_Transfer"  # 有 FT 输入 + FT 输出 = 转移

if not ft_inputs and ft_outputs:
    return "FT_Mint"      # 无 FT 输入 + 有 FT 输出 = 铸造
```

### 关键教训

1. **2Code 不是区分 Mint/Transfer 的标志**
   - 2Code 在 Code 脚本末尾，不是 Tape 脚本
   - Transfer 会保留原 Code 脚本的所有标记

2. **必须分析输入**
   - 需要获取来源交易的输出
   - 判断输入是 FT 还是 TBC

3. **复合交易**
   - 一个交易可以同时包含 Mint 和 Transfer
   - 需要分别追踪不同类型的输入

---

*修正时间: 2026-03-05*

## 7. 待深入学习

- [ ] FT解锁脚本的详细生成逻辑 (ftunlock.js)
- [ ] NFT合约实现差异
- [ ] PoolNFT合约的AMM算法
- [ ] MultiSig合约的多签验证
- [ ] HTLC合约的时间锁实现
