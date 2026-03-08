# TBC NFT合约深度分析

**学习时间:** 2026-03-04  
**源码路径:** `/Users/jay/.openclaw/workspace/tbc-contract-code/lib/contract/nft.js`

---

## 1. NFT合约架构

### 1.1 核心属性
```javascript
class NFT {
    collection_id = "";      // 集合ID
    collection_index = 0;    // 在集合中的索引
    collection_name = "";    // 集合名称
    transfer_count = 0;      // 转账次数
    contract_id = "";        // 合约ID (txid)
    
    nftData = {
        nftName: "",         // NFT名称
        symbol: "",          // 符号
        file: "",            // 文件引用
        description: "",     // 描述
        attributes: "",      // 属性(JSON)
    };
}
```

### 1.2 与FT的关键差异

| 特性 | FT | NFT |
|------|-----|-----|
| 标准 | ERC-20类似 | ERC-721类似 |
| 精度 | 支持decimal | 无精度概念 |
| 金额存储 | 6个uint64LE槽位 | 单一定值 |
| 唯一性 | 同质化 | 每个NFT唯一 |
| 元数据 | 简单(name,symbol) | 复杂(JSON) |
| 转账 | 可多输入合并 | 单输入单输出 |

---

## 2. 集合(Collection)创建

### 2.1 交易结构
```javascript
static createCollection(address, privateKey, data, utxos) {
    const tx = new tbc.Transaction()
        .from(utxos)
        .addOutput(new tbc.Transaction.Output({
            script: NFT.buildTapeScript(data),  // 集合元数据
            satoshis: 0,
        }));
    
    // 为每个NFT创建铸造输出
    for (let i = 0; i < data.supply; i++) {
        tx.addOutput(new tbc.Transaction.Output({
            script: NFT.buildMintScript(address),  // 铸造脚本
            satoshis: 100,
        }));
    }
    
    tx.feePerKb(80).change(address).sign(privateKey).seal();
    return tx.uncheckedSerialize();
}
```

### 2.2 集合数据结构
```javascript
interface CollectionData {
    collectionName: string;    // 集合名称
    supply: number;            // 总供应量
    symbol: string;            // 符号
    nftName: string;          // 默认NFT名称
    description: string;      // 描述
    attributes: string;       // 属性(JSON)
}
```

### 2.3 铸造脚本 (Mint Script)
```javascript
static buildMintScript(address) {
    const pubKeyHash = tbc.Address.fromString(address).hashBuffer.toString("hex");
    const mint = new tbc.Script(
        "OP_DUP OP_HASH160" +
        " 0x14 0x" + pubKeyHash +
        " OP_EQUALVERIFY OP_CHECKSIG" +
        " OP_RETURN 0x0d 0x5630204d696e74204e486f6c64"
    );
    // OP_RETURN数据: "V0 Mint NHold" (版本0铸造未持有)
    return mint;
}
```

---

## 3. NFT铸造 (Create NFT)

### 3.1 交易结构
```
TxCreateNFT (铸造交易)
├── Input[0]: NFT UTXO (来自集合创建)
├── Input[1:]: UTXOs (手续费)
├── Output[0]: Code脚本 (200 satoshis)
│   └── Script: buildCodeScript(txid, outputIndex)
├── Output[1]: Hold脚本 (100 satoshis)
│   └── Script: buildHoldScript(address)
├── Output[2]: Tape脚本 (0 satoshis)
│   └── Script: buildTapeScript(nftData)
└── Change: 找零
```

### 3.2 核心代码
```javascript
static createNFT(collection_id, address, privateKey, data, utxos, nfttxo) {
    // 构建持有脚本
    const hold = NFT.buildHoldScript(address);
    
    // 生成文件引用 (如果不存在)
    if (!data.file) {
        const writer = new tbc.encoding.BufferWriter();
        data.file = collection_id + 
            writer.writeUInt32LE(nfttxo.outputIndex)
                  .toBuffer().toString("hex");
    }
    
    const tx = new tbc.Transaction()
        .from(nfttxo)      // NFT输入
        .from(utxos)       // 手续费输入
        .addOutput(new tbc.Transaction.Output({
            script: NFT.buildCodeScript(nfttxo.txId, nfttxo.outputIndex),
            satoshis: 200,
        }))
        .addOutput(new tbc.Transaction.Output({
            script: hold,
            satoshis: 100,
        }))
        .addOutput(new tbc.Transaction.Output({
            script: NFT.buildTapeScript(data),
            satoshis: 0,
        }));
    
    // 设置解锁脚本并签名
    tx.setInputScript({ inputIndex: 0, privateKey }, (tx) => {
        const Sig = tx.getSignature(0);
        const sig = (Sig.length / 2).toString(16) + Sig;
        const publickey = (privateKey.toPublicKey().toBuffer().length / 2).toString(16) +
            privateKey.toPublicKey().toBuffer().toString("hex");
        return new tbc.Script(sig + publickey);
    })
    .sign(privateKey)
    .seal();
    
    return tx.uncheckedSerialize();
}
```

### 3.3 文件引用生成
```javascript
// file = collection_id + outputIndex (4字节LE)
// 例如: "abc123..." + "05000000" (outputIndex=5)
const writer = new tbc.encoding.BufferWriter();
data.file = collection_id + 
    writer.writeUInt32LE(nfttxo.outputIndex)
          .toBuffer().toString("hex");
```

---

## 4. NFT转账

### 4.1 交易结构
```
TxTransferNFT (转账交易)
├── Input[0]: Code脚本输出 (来自前一个NFT交易)
├── Input[1]: Hold脚本输出 (来自前一个NFT交易)
├── Input[2:]: UTXOs (手续费)
├── Output[0]: Code脚本 (200 satoshis)
│   └── 新的所有者代码脚本
├── Output[1]: Hold脚本 (100 satoshis)
│   └── 新的持有者脚本
├── Output[2]: Tape脚本 (0 satoshis)
│   └── NFT元数据
└── Change: 找零
```

### 4.2 转账实现
```javascript
transferNFT(address_from, address_to, privateKey, utxos, pre_tx, pre_pre_tx) {
    // 构建新的Code脚本 (保持相同的collection_id和index)
    const code = NFT.buildCodeScript(this.collection_id, this.collection_index);
    
    const tx = new tbc.Transaction()
        .addInputFromPrevTx(pre_tx, 0)   // Code输入
        .addInputFromPrevTx(pre_tx, 1)   // Hold输入
        .from(utxos)                      // 手续费
        .addOutput(new tbc.Transaction.Output({
            script: code,
            satoshis: 200,
        }))
        .addOutput(new tbc.Transaction.Output({
            script: NFT.buildHoldScript(address_to),  // 新持有者
            satoshis: 100,
        }))
        .addOutput(new tbc.Transaction.Output({
            script: NFT.buildTapeScript(this.nftData),
            satoshis: 0,
        }))
        .change(address_from);
    
    // 设置Code输入的解锁脚本 (需要合约解锁数据)
    tx.setInputScript({ inputIndex: 0, privateKey }, (tx) => {
        const sig = ...;  // 签名
        const publickey = ...;
        const currenttxdata = nftunlock.getCurrentTxdata(tx);
        const prepretxdata = nftunlock.getPrePreTxdata(pre_pre_tx);
        const pretxdata = nftunlock.getPreTxdata(pre_tx);
        return new tbc.Script(sig + publickey + currenttxdata + prepretxdata + pretxdata);
    });
    
    // 设置Hold输入的解锁脚本 (普通P2PKH)
    tx.setInputScript({ inputIndex: 1, privateKey }, (tx) => {
        const sig = ...;
        const publickey = ...;
        return new tbc.Script(sig + publickey);
    });
    
    tx.sign(privateKey).seal();
    return tx.uncheckedSerialize();
}
```

---

## 5. 脚本构建详解

### 5.1 Code脚本 (NFT合约代码)
```javascript
static buildCodeScript(tx_hash, outputIndex) {
    const tx_id = Buffer.from(tx_hash, "hex").reverse().toString("hex");
    const writer = new tbc.encoding.BufferWriter();
    const vout = writer.writeUInt32LE(outputIndex).toBuffer().toString("hex");
    const tx_id_vout = "0x" + tx_id + vout;
    
    const code = new tbc.Script(
        "OP_1 OP_PICK OP_3 OP_SPLIT 0x01 0x14 OP_SPLIT OP_DROP ..." +
        tx_id_vout +  // 嵌入txid+vout作为唯一标识
        " OP_EQUALVERIFY OP_ENDIF ..." +
        " OP_CHECKSIG OP_RETURN"
    );
    return code;
}
```

**关键特性**:
- 嵌入 `txid + outputIndex` 作为NFT唯一标识
- 使用 `OP_PUSH_META` 元数据操作码
- 多重SHA256哈希验证
- 最终 `OP_CHECKSIG` + `OP_RETURN`

### 5.2 Hold脚本 (持有者脚本)
```javascript
static buildHoldScript(address) {
    const pubKeyHash = tbc.Address.fromString(address).hashBuffer.toString("hex");
    const hold = new tbc.Script(
        "OP_DUP OP_HASH160" +
        " 0x14 0x" + pubKeyHash +
        " OP_EQUALVERIFY OP_CHECKSIG" +
        " OP_RETURN 0x0d 0x56302043757272204e486f6c64"
    );
    // OP_RETURN数据: "V0 Curr NHold" (版本0当前持有者)
    return hold;
}
```

### 5.3 Tape脚本 (元数据脚本)
```javascript
static buildTapeScript(data) {
    // 将NFT数据转为JSON再转hex
    const dataHex = Buffer.from(JSON.stringify(data)).toString("hex");
    const tape = tbc.Script.fromASM(
        `OP_FALSE OP_RETURN ${dataHex} 4e54617065`
    );
    // 4e54617065 = "NTape" (NFT Tape)
    return tape;
}
```

---

## 6. 数据编码/解码

### 6.1 NFT数据结构
```javascript
{
    "nftName": "CryptoArt #1",
    "symbol": "ART",
    "file": "collection_id + outputIndex",
    "description": "A beautiful digital artwork",
    "attributes": "[{\"trait\": \"color\", \"value\": \"blue\"}]"
}
```

### 6.2 编码过程
```javascript
static encodeNFTDataToHex(data) {
    const jsonString = JSON.stringify(data);
    return Buffer.from(jsonString).toString("hex");
}

// 结果: 7b226e66744e616d65223a2243727970746f417274202331222c2...
```

### 6.3 解码过程
```javascript
static decodeNFTDataFromHex(hex) {
    const jsonString = Buffer.from(hex, "hex").toString("utf8");
    return JSON.parse(jsonString);
}
```

---

## 7. 解锁脚本机制

### 7.1 双输入结构
NFT转账需要两个输入：
1. **Code输入**: 需要合约解锁数据
2. **Hold输入**: 普通P2PKH签名

### 7.2 解锁脚本构建
```javascript
static buildUnlockScript(privateKey, currentTX, preTX, prepreTxData, currentUnlockIndex) {
    // 1. 当前交易数据
    const currenttxdata = nftunlock.getCurrentTxdata(currentTX);
    
    // 2. 前前置交易数据
    const prepretxdata = nftunlock.getPrePreTxdata(prepreTxData);
    
    // 3. 前置交易数据
    const pretxdata = nftunlock.getPreTxdata(preTX);
    
    // 4. 签名
    const signature = currentTX.getSignature(currentUnlockIndex, privateKey);
    const sig = (signature.length / 2).toString(16).padStart(2, '0') + signature;
    
    // 5. 公钥
    const publicKey = (privateKey.toPublicKey().toString().length / 2).toString(16).padStart(2, '0') +
        privateKey.toPublicKey().toString();
    
    // 组合: sig + publicKey + currenttxdata + prepretxdata + pretxdata
    return new tbc.Script(sig + publicKey + currenttxdata + prepretxdata + pretxdata);
}
```

---

## 8. 与FT合约的对比总结

| 方面 | FT | NFT |
|------|-----|-----|
| **交易输入** | 多个FT UTXO | 2个输入 (Code + Hold) |
| **交易输出** | 2-4个输出 | 3个输出 (Code + Hold + Tape) |
| **金额处理** | 复杂分配算法 | 固定值 (200+100 sat) |
| **元数据** | 简单(name,symbol,decimal) | 复杂JSON对象 |
| **唯一性** | 同质化 | 每个唯一 (txid+outputIndex) |
| **解锁复杂度** | 中等 | 较高 (双输入+多数据) |
| **合约脚本** | ~1500-1900 bytes | 变化较大 |

---

## 9. 技术亮点

1. **双脚本设计**: Code(合约) + Hold(持有者)分离，增强安全性
2. **链上元数据**: NFT完整信息存储在链上(Tape脚本)
3. **唯一标识**: 使用铸造时的txid+outputIndex确保唯一性
4. **版本标识**: OP_RETURN中包含版本信息("V0")
5. **灵活属性**: 支持任意JSON格式的attributes

---

## 10. 应用场景

- **数字艺术品**: 图片、音乐、视频NFT
- **游戏资产**: 道具、角色、土地
- **身份认证**: 证书、徽章、会员
- **实物锚定**: 房产、商品、收藏品
