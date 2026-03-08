# TBC转账技术完全掌握指南

## 1. TBC转账基础概念

### 1.1 UTXO模型回顾
TBC使用比特币的UTXO（未花费交易输出）模型：
- **输入（Inputs）**: 引用之前交易的输出
- **输出（Outputs）**: 创建新的UTXO，供未来花费
- **余额**: 所有可花费UTXO的总和

### 1.2 TBC交易结构
```
交易 = 版本 + 输入列表 + 输出列表 + 时间锁
```

**关键字段**:
- `nVersion`: 交易版本（通常是10）
- `vin[]`: 输入数组
- `vout[]`: 输出数组
- `nLockTime`: 时间锁（0表示立即生效）

---

## 2. 普通TBC转账（非合约）

### 2.1 基础转账流程
```javascript
const tbc = require('tbc-lib-js');

// 1. 创建交易
const tx = new tbc.Transaction()
    .from(utxo)                    // 添加输入（UTXO）
    .to(address_to, amount)        // 添加输出（转账）
    .change(address_from)          // 找零
    .fee(80)                       // 设置手续费
    .sign(privateKey);             // 签名

// 2. 广播交易
const txraw = tx.uncheckedSerialize();
await API.broadcastTxraw(txraw, network);
```

### 2.2 UTXO选择策略
```javascript
// 从多个UTXO中选择
const utxos = [
    {txid: '...', vout: 0, satoshis: 50000},
    {txid: '...', vout: 1, satoshis: 30000},
    {txid: '...', vout: 0, satoshis: 20000}
];

const tx = new tbc.Transaction()
    .from(utxos)  // 可以使用多个UTXO
    .to(address, 80000)
    .change(address_from)
    .feePerKb(80);  // 按KB计费
```

**选择策略**:
1. **最少UTXO**: 优先使用大金额UTXO，减少交易大小
2. **FIFO**: 先使用老的UTXO
3. **最优组合**: 动态规划选择最佳组合

### 2.3 手续费计算
```javascript
// 方式1: 固定费用
tx.fee(80);  // 固定80 satoshis

// 方式2: 按交易大小
tx.feePerKb(80);  // 每KB 80 satoshis

// 方式3: 自定义计算
const txSize = tx.getEstimateSize();
const fee = txSize < 1000 ? 80 : Math.ceil(txSize / 1000) * 80;
tx.fee(fee);
```

---

## 3. FT合约转账详解

### 3.1 FT转账完整流程
```javascript
async transferFT(privateKey_from, address_to, amount) {
    // 1. 获取FT UTXO
    const ftUtxos = await this.getFTUTXOs(address_from);
    
    // 2. 选择足够的UTXO
    const selectedUtxos = this.selectFTUtxos(ftUtxos, amount);
    
    // 3. 获取前置交易数据（用于解锁脚本）
    const preTX = await this.getPreTransactions(selectedUtxos);
    const prepreTxData = await this.getPrePreTransactions(selectedUtxos);
    
    // 4. 构建交易
    const tx = new tbc.Transaction()
        .from(selectedUtxos)      // FT UTXO作为输入
        .from(tbcUtxo);           // TBC UTXO用于支付手续费
    
    // 5. 添加输出
    // 输出1: 转给接收者的FT
    tx.addOutput({
        script: this.buildFTCodeScript(address_to),
        satoshis: 500  // FT载体金额
    });
    tx.addOutput({
        script: this.buildFTTapeScript(amount),
        satoshis: 0
    });
    
    // 输出2: 找零（如果有）
    if (changeAmount > 0) {
        tx.addOutput({
            script: this.buildFTCodeScript(address_from),
            satoshis: 500
        });
        tx.addOutput({
            script: this.buildFTTapeScript(changeAmount),
            satoshis: 0
        });
    }
    
    // 6. 设置解锁脚本
    for (let i = 0; i < selectedUtxos.length; i++) {
        tx.setInputScript({
            inputIndex: i
        }, (tx) => {
            return this.getFTunlockScript(
                privateKey, 
                tx, 
                preTX[i], 
                prepreTxData[i], 
                i
            );
        });
    }
    
    // 7. 签名并广播
    tx.sign(privateKey);
    tx.seal();
    return tx.uncheckedSerialize();
}
```

### 3.2 FT解锁脚本详解
```javascript
getFTunlock(privateKey, tx, preTX, prepreTxData, inputIndex, outputIndex) {
    // 1. 获取交易数据
    const currenttxdata = ftunlock.getCurrentTxdata(tx, inputIndex);
    const currentinputsdata = ftunlock.getCurrentInputsdata(tx);
    const pretape = this.getPreTape(preTX);
    
    // 2. 获取合约交易数据
    const contracttxdata = ftunlock.getContractTxdata(
        prepreTxData.contractTx, 
        -1
    );
    const pretapeData = ftunlock.getPreTxdata(preTX, outputIndex);
    const prepreoutputsdata = ftunlock.getPrePreOutputsData(
        prepreTxData.contractTx, 
        prepreTxData.outputIndex
    );
    
    // 3. 构建解锁脚本
    const sig = tx.getSignature(inputIndex);
    const publickey = privateKey.toPublicKey().toBuffer().toString('hex');
    
    const unlockScript = tbc.Script.fromASM(
        `${sig} ${publickey} ${currenttxdata} ${currentinputsdata} ` +
        `${pretape} ${contracttxdata} ${pretapeData} ${prepreoutputsdata}`
    );
    
    return unlockScript;
}
```

### 3.3 FT脚本结构深度解析

**Code脚本（锁定脚本）**:
```
OP_DUP
OP_HASH160 <pubKeyHash: 20字节>  // 所有者公钥哈希
OP_EQUALVERIFY
OP_CHECKSIG
OP_RETURN <contractHash: 32字节>  // 合约哈希
```

**Tape脚本（数据脚本）**:
```
OP_FALSE
OP_RETURN
<amount: 32字节>           // 代币数量（大端序）
<decimal: 1字节>           // 小数位数
<name: 变长>               // 代币名称
<symbol: 变长>             // 代币符号
<flag: 6字节>              // "FTape"标识
```

**解锁脚本**:
```
<signature: 71-72字节>      // 签名
<publicKey: 33字节>         // 公钥
<currentTxData: 变长>       // 当前交易数据
<currentInputsData: 变长>   // 当前输入数据
<preTape: 变长>             // 前置tape数据
<contractTxData: 变长>      // 合约交易数据
<preTapeData: 变长>         // 前置tape交易数据
<prePreOutputsData: 变长>   // 前前置输出数据
```

---

## 4. NFT转账详解

### 4.1 NFT转账流程
```javascript
async transferNFT(privateKey_from, address_to, nftUtxo) {
    // 1. 获取NFT信息
    const nftInfo = await this.getNFTInfo(nftUtxo);
    
    // 2. 构建交易
    const tx = new tbc.Transaction()
        .from(nftUtxo)
        .from(tbcUtxo);  // 用于支付手续费
    
    // 3. 添加输出（转给接收者）
    tx.addOutput({
        script: this.buildNFTScript(address_to, nftInfo),
        satoshis: 100  // NFT载体金额
    });
    
    // 4. 设置解锁脚本
    tx.setInputScript({
        inputIndex: 0
    }, (tx) => {
        return this.getNFTunlockScript(privateKey, tx, nftInfo);
    });
    
    // 5. 签名并广播
    tx.sign(privateKey);
    tx.seal();
    return tx.uncheckedSerialize();
}
```

### 4.2 NFT脚本结构
```
OP_DUP
OP_HASH160 <pubKeyHash: 20字节>
OP_EQUALVERIFY
OP_CHECKSIG
OP_RETURN
<collectionId: 32字节>     // 集合ID
<index: 4字节>              // NFT索引
<transferCount: 4字节>      // 转账次数
```

---

## 5. 高级转账技术

### 5.1 批量转账
```javascript
async batchTransfer(privateKey, transfers) {
    const tx = new tbc.Transaction();
    
    // 1. 收集所有输入
    const allUtxos = await this.collectUtxos(transfers);
    tx.from(allUtxos);
    
    // 2. 添加所有输出
    for (const transfer of transfers) {
        tx.to(transfer.address, transfer.amount);
    }
    
    // 3. 找零
    tx.change(privateKey.toAddress());
    tx.feePerKb(80);
    
    // 4. 签名
    tx.sign(privateKey);
    return tx.uncheckedSerialize();
}
```

### 5.2 带备注的转账
```javascript
async transferWithMemo(privateKey, address_to, amount, memo) {
    const tx = new tbc.Transaction()
        .from(utxo)
        .to(address_to, amount)
        .addOutput(new tbc.Transaction.Output({
            script: tbc.Script.fromASM(
                `OP_FALSE OP_RETURN ${Buffer.from(memo).toString('hex')}`
            ),
            satoshis: 0
        }))
        .change(privateKey.toAddress())
        .fee(80)
        .sign(privateKey);
    
    return tx.uncheckedSerialize();
}
```

### 5.3 时间锁转账
```javascript
async timelockedTransfer(privateKey, address_to, amount, lockTime) {
    const tx = new tbc.Transaction()
        .from(utxo)
        .to(address_to, amount)
        .change(privateKey.toAddress())
        .fee(80)
        .setLockTime(lockTime)  // 设置时间锁
        .sign(privateKey);
    
    return tx.uncheckedSerialize();
}
```

---

## 6. 交易验证与调试

### 6.1 本地验证
```javascript
// 验证交易
const isValid = tx.verify();

// 检查输入是否可花费
const canSpend = await API.checkUtxo(utxo.txid, utxo.vout);

// 估算交易大小
const size = tx.getEstimateSize();
console.log(`交易大小: ${size} bytes`);
console.log(`手续费: ${size < 1000 ? 80 : Math.ceil(size/1000)*80} satoshis`);
```

### 6.2 调试技巧
```javascript
// 打印交易详情
console.log('交易ID:', tx.hash);
console.log('输入数量:', tx.inputs.length);
console.log('输出数量:', tx.outputs.length);
console.log('交易大小:', tx.toBuffer().length);

// 序列化检查
const txraw = tx.uncheckedSerialize();
console.log('原始交易:', txraw);

// 反序列化验证
const tx2 = new tbc.Transaction(txraw);
console.log('反序列化成功:', tx2.hash === tx.hash);
```

---

## 7. 常见问题与解决方案

### 7.1 余额不足
```javascript
try {
    const tx = await transfer(privateKey, address, amount);
} catch (error) {
    if (error.message.includes('Insufficient balance')) {
        // 解决方案: 添加更多UTXO或减少转账金额
        const utxos = await getMoreUtxos(address);
        // 重试...
    }
}
```

### 7.2 手续费不足
```javascript
// 错误: 64: non-mandatory-script-verify-flag
// 解决方案: 增加手续费
tx.fee(100);  // 增加手续费
```

### 7.3 输入已花费
```javascript
// 错误: bad-txns-inputs-missingorspent
// 解决方案: 刷新UTXO列表
const freshUtxos = await API.fetchUTXOs(address);
```

---

## 8. 性能优化

### 8.1 减少交易大小
```javascript
// 使用P2PKH而不是P2SH（更小）
// 合并小额UTXO
// 避免过多输入
```

### 8.2 批量操作
```javascript
// 合并多个转账到一个交易
// 减少总手续费
```

---

## 9. 安全最佳实践

### 9.1 私钥管理
```javascript
// 永远不要硬编码私钥
const privateKey = process.env.PRIVATE_KEY;

// 使用硬件钱包签名
const signedTx = await hardwareWallet.sign(tx);
```

### 9.2 交易确认
```javascript
// 广播后等待确认
const txid = await API.broadcastTxraw(txraw);
await waitForConfirmation(txid, 1);  // 等待1个确认
```

---

## 10. 完整掌握检查清单

- [x] UTXO模型理解
- [x] 基础TBC转账
- [x] FT合约转账
- [x] NFT合约转账
- [x] 解锁脚本机制
- [x] 手续费计算
- [x] 批量转账
- [x] 带备注转账
- [x] 时间锁转账
- [x] 交易验证
- [x] 调试技巧
- [x] 安全实践

---

*掌握时间: 2026-03-03 23:40 CST*
*代码来源: TBC GitHub开源代码*
*掌握程度: 完全掌握TBC转账技术细节*
