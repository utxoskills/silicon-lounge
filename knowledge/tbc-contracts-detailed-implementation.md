# TBC合约实现细节深度分析（更新版）

## 重要更新 (2026-03-06)

### 关键修正

#### 1. FT Mint vs Transfer 判断
**之前错误:**
- ❌ 认为有 `2Code` (32436f6465) 就是 Mint
- ❌ 通过输出脚本判断

**正确理解:**
- ✅ **看输入类型**
- **Mint**: 输入是 TBC，输出是 FT
- **Transfer**: 输入是 FT，输出是 FT

#### 2. NFT 合约流程
```
创建集合 (TBC输入)
    └── 生成多个 Mint UTXO
            └── 作为输入创建 NFT
                    └── 生成 NFT UTXO
                            └── 作为输入转移 NFT
```

#### 3. Pool 合约特点
- **Pool v1** (poolNFT.ts): 使用 AMM 公式 `x * y = k`，**无手续费**
- **Pool v2** (poolNFT2.0.ts): 在 v1 基础上增加手续费，service_fee_rate 默认 25（万分之25），总费率 = (service_fee_rate + 10) / 10000 = 万分之35
- Swap 需要 3 个输入: Pool NFT + 支付资产 + 池中资产
- 使用部分哈希优化脚本大小

---

## 1. 合约架构总览

### 1.1 合约继承关系
```
FT (基础同质化代币)
├── stableCoin (稳定币，继承FT)
└── poolNFT (流动性池，使用FT)

NFT (基础非同质化代币)
└── coinNFT (稳定币证书NFT)

MultiSig (多签钱包)
HTLC (哈希时间锁)
OrderBook (订单簿DEX)
PiggyBank (储蓄合约)
```

### 1.2 合约分类
| 类型 | 合约 | 功能 |
|------|------|------|
| **Token** | FT, NFT, stableCoin | 代币发行 |
| **DeFi** | poolNFT, OrderBook | 去中心化金融 |
| **工具** | MultiSig, HTLC, PiggyBank（时间锁冻结） | 实用工具 |

---

## 2. MultiSig合约详解（多签钱包）

### 2.1 核心功能
```javascript
class MultiSig {
    // 1. 创建多签钱包
    static createMultiSigWallet(address_from, pubKeys, signatureCount, 
                                publicKeyCount, tbc_amount, utxos, privateKey)
    
    // 2. P2PKH转账到多签地址
    static p2pkhToMultiSig_sendTBC(address_from, address_to, amount_tbc, 
                                    utxos, privateKey)
    
    // 3. 构建多签交易（不签名）
    static buildMultiSigTransaction_sendTBC(address_from, address_to, 
                                           amount_tbc, utxos)
    
    // 4. 签名多签交易
    static signMultiSigTransaction_sendTBC(address_from, multiSigTxraw, privateKey)
    
    // 5. 完成多签交易（聚合签名）
    static finishMultiSigTransaction_sendTBC(txraw, sigs, pubKeys)
}
```

### 2.2 创建多签钱包流程
```javascript
static createMultiSigWallet(address_from, pubKeys, signatureCount, 
                           publicKeyCount, tbc_amount, utxos, privateKey) {
    // 1. 生成多签地址
    const address = MultiSig.getMultiSigAddress(pubKeys, signatureCount, publicKeyCount);
    
    // 2. 获取锁定脚本
    const script_asm = MultiSig.getMultiSigLockScript(address);
    
    // 3. 构建交易
    const tx = new tbc.Transaction();
    tx.from(utxos);
    
    // 输出1: 多签钱包主输出
    tx.addOutput(new tbc.Transaction.Output({
        script: tbc.Script.fromASM(script_asm),
        satoshis: Number(parseDecimalToBigInt(tbc_amount, 6)),
    }));
    
    // 输出2-N: 每个公钥一个Hold脚本（用于后续签名验证）
    for (let i = 0; i < publicKeyCount; i++) {
        tx.addOutput(new tbc.Transaction.Output({
            script: MultiSig.buildHoldScript(pubKeys[i]),
            satoshis: 200,  // 每个200 satoshis
        }));
    }
    
    // 输出N+1: Tape脚本（记录多签配置）
    tx.addOutput(new tbc.Transaction.Output({
        script: MultiSig.buildTapeScript(address, pubKeys),
        satoshis: 0,
    }));
    
    tx.change(address_from);
    tx.sign(privateKey).seal();
    return tx.uncheckedSerialize();
}
```

### 2.3 多签脚本结构

**注意**: TBC 多签**不是**标准 Bitcoin P2SH 多签。公钥**不嵌入**在锁定脚本中，而是在花费时提供，并通过哈希验证。

**锁定脚本**:
```
OP_<M>                        // 需要M个签名
OP_SWAP                       // 栈操作
<split/pick/cat验证操作>       // 公钥拼接与验证
OP_HASH160 <hash: 20字节>     // 公钥集合的哈希
OP_EQUALVERIFY                // 验证公钥哈希匹配
OP_<N>                        // 总共N个公钥
OP_CHECKMULTISIG              // 多签验证
```

**关键区别**:
- 公钥不嵌入锁定脚本，减小脚本体积
- 花费时在解锁脚本中提供公钥，通过 `OP_HASH160 <hash> OP_EQUALVERIFY` 验证
- 锁定脚本中只存储公钥集合的哈希值

**解锁脚本**:
```
OP_0                          // CHECKMULTISIG的bug补偿
<sig1: 71-72字节>             // 签名1
<sig2: 71-72字节>             // 签名2
...
<sigM: 71-72字节>             // 签名M
<pubKey1: 33字节>             // 公钥1（花费时提供）
<pubKey2: 33字节>             // 公钥2（花费时提供）
...
<pubKeyN: 33字节>             // 公钥N（花费时提供）
```

### 2.4 多签交易流程
```
阶段1: 构建交易（任意一方）
   ↓
阶段2: 分发交易给各方签名
   ↓
阶段3: 各方分别签名
   ↓
阶段4: 聚合签名完成交易
   ↓
阶段5: 广播到网络
```

---

## 3. HTLC合约详解（哈希时间锁）

### 3.1 核心功能
```javascript
// 1. 部署HTLC（锁定资金）
function deployHTLC(sender, receiver, hashlock, timelock, amount, utxo)

// 2. 提取资金（提供原像）
function withdraw(receiver, htlcUtxo)

// 3. 退款（超时后）
function refund(sender, htlcUtxo, timelock)

// 4. 填充签名
function fillSigDeploy(deployHTLCTxRaw, sig, publicKey)
function fillSigWithdraw(withdrawTxRaw, secret, sig, publicKey)
function fillSigRefund(refundTxRaw, sig, publicKey)
```

### 3.2 HTLC脚本实现
```javascript
function getCode(senderPubHash, receiverPubHash, hashlock, timelock) {
    const writer = new tbc.encoding.BufferWriter();
    const timelockHex = writer.writeUInt32LE(timelock).toBuffer().toString("hex");
    
    const script = tbc.Script.fromASM(
        `OP_IF 
            OP_SHA256 ${hashlock} OP_EQUALVERIFY 
            OP_DUP OP_HASH160 ${receiverPubHash}
        OP_ELSE 
            ${timelockHex} OP_BIN2NUM 
            OP_2 OP_PUSH_META OP_BIN2NUM 
            OP_2DUP OP_GREATERTHAN 
            OP_NOTIF 
                OP_2DUP 0065cd1d OP_GREATERTHANOREQUAL 
                OP_IF 
                    0065cd1d OP_GREATERTHANOREQUAL OP_VERIFY OP_LESSTHANOREQUAL 
                OP_ELSE 
                    OP_2DROP OP_DROP OP_TRUE 
                OP_ENDIF 
            OP_ELSE 
                OP_FALSE 
            OP_ENDIF 
            OP_VERIFY 
            OP_6 OP_PUSH_META 24 OP_SPLIT OP_NIP OP_BIN2NUM ffffffff OP_NUMNOTEQUAL OP_VERIFY 
            OP_DUP OP_HASH160 ${senderPubHash}
        OP_ENDIF 
        OP_EQUALVERIFY OP_CHECKSIG`
    );
    return script;
}
```

### 3.3 HTLC脚本解析
**条件分支结构**:
```
OP_IF
    // 分支1: 正常提取（提供原像）
    OP_SHA256 <hashlock> OP_EQUALVERIFY  // 验证哈希
    OP_DUP OP_HASH160 <receiverPubHash>  // 验证接收者
OP_ELSE
    // 分支2: 退款（超时）
    <timelock> OP_BIN2NUM OP_2 OP_PUSH_META OP_BIN2NUM
    // 复杂的时间验证逻辑...
    OP_DUP OP_HASH160 <senderPubHash>     // 验证发送者
OP_ENDIF
OP_EQUALVERIFY OP_CHECKSIG
```

### 3.4 使用场景：跨链原子交换
```
Alice (BTC)                    Bob (TBC)
   |                              |
   |  1. 创建HTLC1 (hash=H, t=24h)  |
   |----------------------------->|
   |                              |
   |  2. 创建HTLC2 (hash=H, t=12h) |
   |<-----------------------------|
   |                              |
   |  3. 用preimage解锁HTLC2      |
   |----------------------------->|
   |  (Bob看到preimage)           |
   |                              |
   |  4. 用preimage解锁HTLC1      |
   |<-----------------------------|
```

### 3.5 时间锁机制
```javascript
// 设置时间锁（退款用）
function refund(sender, htlcUtxo, timelock) {
    const tx = new tbc.Transaction();
    tx.from(htlcUtxo);
    tx.to(sender, htlcUtxo.satoshis - 80);
    tx.fee(80);
    tx.setInputSequence(0, 4294967294);  // 启用时间锁
    tx.setLockTime(timelock);             // 设置锁定时间
    return tx.uncheckedSerialize();
}
```

---

## 4. StableCoin合约详解（稳定币）

### 4.1 设计特点
```javascript
class stableCoin extends FT {
    // 继承FT的基础功能
    // 添加稳定币特有的功能：
    // 1. 管理员铸造/销毁
    // 2. NFT证书（证明发行）
    // 3. 供应量追踪
}
```

### 4.2 核心功能
```javascript
class stableCoin {
    // 1. 创建稳定币（首次发行）
    createCoin(privateKey_admin, address_to, utxo, utxoTX, mintMessage)
    
    // 2. 增发稳定币
    mintCoin(privateKey_admin, address_to, mintAmount, utxo, 
             nftPreTX, nftPrePreTX, mintMessage)
    
    // 3. 销毁稳定币
    burnCoin(privateKey_admin, burnAmount, utxo, nftPreTX, nftPrePreTX, burnMessage)
    
    // 4. 转账（继承FT）
    transfer(privateKey_from, address_to, amount, utxos, preTX, prepreTxData)
}
```

### 4.3 创建稳定币流程
```javascript
createCoin(privateKey_admin, address_to, utxo, utxoTX, mintMessage) {
    // 1. 准备代币数据
    const name = this.name;
    const symbol = this.symbol;
    const decimal = this.decimal;
    const totalSupply = parseDecimalToBigInt(this.totalSupply, decimal);
    
    // 2. 构建tape脚本
    const tapeScript = tbc.Script.fromASM(
        `OP_FALSE OP_RETURN ${tapeAmount} ${decimalHex} ${nameHex} ${symbolHex} ${lockTimeHex} 4654617065`
    );
    
    // 3. 创建NFT证书（证明发行）
    const data = {
        nftName: name + " NFT",
        nftSymbol: symbol + " NFT",
        description: "发行证书，记录供应量和发行历史",
        coinDecimal: decimal,
        coinTotalSupply: "0",
    };
    const coinNftTX = stableCoin.buildCoinNftTX(privateKey, utxo, data);
    
    // 4. 构建代码脚本
    const originCodeHash = tbc.crypto.Hash.sha256(
        coinNftTX.outputs[0].script.toBuffer()
    ).toString("hex");
    const codeScript = stableCoin.getCoinMintCode(
        adminAddress, address_to, originCodeHash, tapeSize
    );
    
    // 5. 构建完整交易
    const tx = new tbc.Transaction()
        .addInputFromPrevTx(coinNftTX, 0)
        .addInputFromPrevTx(coinNftTX, 1)
        .addInputFromPrevTx(coinNftTX, 3);
    
    // 添加NFT输出
    coinNftOutputs.forEach((output) => tx.addOutput(output));
    
    // 添加稳定币输出
    tx.addOutput(new tbc.Transaction.Output({
        script: codeScript,
        satoshis: 500,
    }));
    tx.addOutput(new tbc.Transaction.Output({
        script: tapeScript,
        satoshis: 0,
    }));
    
    // 可选：添加铸造消息
    if (mintMessage) {
        const msgScript = tbc.Script.fromASM(
            `OP_FALSE OP_RETURN ${mintMessageHex}`
        );
        tx.addOutput({script: msgScript, satoshis: 0});
    }
    
    tx.feePerKb(80).change(privateKey.toAddress());
    
    // 设置解锁脚本
    tx.setInputScript({inputIndex: 0, privateKey}, (tx) => {
        return coinNft.buildUnlockScript(privateKey, tx, coinNftTX, utxoTX, 0);
    });
    
    tx.sign(privateKey).seal();
    return [coinNftTXRaw, coinMintRaw];
}
```

### 4.4 稳定币特点
1. **管理员权限**: 只有管理员可以铸造/销毁
2. **NFT证书**: 每次发行都有NFT证书记录
3. **供应量追踪**: 实时更新总供应量
4. **透明可审计**: 所有操作记录在链上

---

## 5. OrderBook合约详解（订单簿DEX）

### 5.1 核心概念
- **Maker**: 挂单者，提供流动性
- **Taker**: 吃单者，消耗流动性
- **OrderBook**: 订单簿，记录所有挂单

### 5.2 订单结构
```javascript
class Order {
    orderId;           // 订单ID（交易哈希）
    maker;             // 挂单者地址
    tokenSell;         // 卖出的代币合约ID
    tokenBuy;          // 买入的代币合约ID
    amountSell;        // 卖出数量
    amountBuy;         // 买入数量
    price;             // 价格（amountBuy/amountSell）
    status;            // open/partial/filled/cancelled
}
```

### 5.3 交易流程
```
1. Maker创建订单
   - 锁定卖出的代币
   - 生成订单ID
   
2. OrderBook记录订单
   - 按价格排序
   - 维护买卖队列
   
3. Taker匹配订单
   - 查找合适价格
   - 执行交易
   
4. 结算
   - 代币转移
   - 订单状态更新
```

---

## 6. PiggyBank合约详解（时间锁冻结）

### 6.1 功能
PiggyBank 是一个简单的时间锁冻结合约，用于将 TBC 冻结到指定区块高度，到期后才能解冻取回。**没有利息、没有提前取款、没有罚金机制。**

### 6.2 核心 API
```javascript
class PiggyBank {
    // 冻结 TBC 直到指定区块高度（address 版本）
    static freezeTBC(address, tbcNumber, lockTime, utxos)
    
    // 解冻 TBC（到期后才能调用）
    static unfreezeTBC(address, utxos, network?)
    
    // 冻结 TBC（privateKey 版本）
    static _freezeTBC(privateKey, tbcNumber, lockTime, utxos)
    
    // 解冻 TBC（privateKey 版本）
    static _unfreezeTBC(privateKey, utxos, network?)
    
    // 查询 UTXO 的锁定区块高度
    static fetchTBCLockTime(utxo)
}
```

### 6.3 参数说明
| 参数 | 说明 |
|------|------|
| `address` / `privateKey` | 冻结/解冻的所有者 |
| `tbcNumber` | 要冻结的 TBC 数量 |
| `lockTime` | 锁定到的区块高度（非时间戳） |
| `utxos` | 可用的 UTXO 列表 |
| `network?` | 可选网络参数（mainnet/testnet） |

---

## 7. 合约对比总结

### 7.1 技术对比
| 合约 | 复杂度 | 主要用途 | 关键特性 |
|------|--------|----------|----------|
| **FT** | 中 | 代币发行 | UTXO模型、Tape脚本 |
| **NFT** | 中 | 数字藏品 | 集合概念、元数据 |
| **MultiSig** | 高 | 多签管理 | M-of-N签名、哈希验证公钥 |
| **HTLC** | 高 | 原子交换 | 哈希锁+时间锁 |
| **StableCoin** | 高 | 稳定币 | 管理员权限、NFT证书 |
| **PoolNFT** | 很高 | 流动性池 | AMM算法、LP代币 |
| **OrderBook** | 高 | DEX | 订单匹配、价格发现 |

### 7.2 脚本复杂度排名
1. **PoolNFT** - 最复杂（多代币交互、AMM计算）
2. **StableCoin** - 很复杂（NFT证书、管理员逻辑）
3. **HTLC** - 复杂（条件分支、时间锁）
4. **MultiSig** - 较复杂（多签名聚合）
5. **OrderBook** - 中等（订单匹配）
6. **NFT** - 中等（元数据处理）
7. **FT** - 相对简单（基础转账）

---

## 8. 学习总结

### 核心发现
1. **TBC合约使用JavaScript**，开发门槛低
2. **UTXO模型创新**，通过脚本实现复杂逻辑
3. **丰富的合约生态**，覆盖Token、DeFi、工具
4. **脚本优化**，使用部分哈希减少交易大小

### 技术亮点
- **MultiSig**: 完整的M-of-N多签流程
- **HTLC**: 安全的跨链原子交换
- **StableCoin**: NFT证书保证透明
- **PoolNFT**: 创新的AMM实现

### 实现难点
- 解锁脚本复杂（需要多笔交易数据）
- 部分哈希计算（优化性能）
- UTXO管理（找零、合并）

---

*更新时间: 2026-03-06 CST*
*代码来源: TBC GitHub开源代码*
*更新内容: 修正 PiggyBank（时间锁冻结，无利息/罚金）、Pool v1无手续费/v2费率、MultiSig 锁定脚本（哈希验证公钥）*
