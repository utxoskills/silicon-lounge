# FT与Pool的关系及实现详解

## 1. 概念解释

### 1.1 FT (Fungible Token) - 同质化代币
**定义**: 可以互换、可分割的代币，每个单位价值相同

**例子**:
- 美元：每张1美元钞票价值相同
- 比特币：每个BTC价值相同
- TBC上的代币：如"MTK"代币

**特点**:
- 可互换性：1个代币 = 1个代币
- 可分割性：可以转0.5个代币
- 同质化：没有唯一标识

### 1.2 Pool (Liquidity Pool) - 流动性池
**定义**: 智能合约中锁定的资金池，用于自动做市和交易

**例子**:
- Uniswap的ETH/USDC池
- TBC上的TBC/FT池

**特点**:
- 包含两种或多种资产
- 通过算法自动定价
- 提供流动性赚取手续费

---

## 2. FT与Pool的关系

### 2.1 关系图示
```
┌─────────────────────────────────────────────────────┐
│                    Pool NFT                         │
│  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │   FT_A (代币A)    │  │      TBC (原生代币)      │  │
│  │   如：USDT       │  │                         │  │
│  │   数量：1000     │  │      数量：500           │  │
│  └──────────────────┘  └─────────────────────────┘  │
│                                                     │
│  价格：1 FT_A = 0.5 TBC                             │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              LP Token (流动性代币)              │  │
│  │     代表你在池中的份额，可兑换回资产             │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2 关系说明

**Pool需要FT**:
- Pool中至少有一种资产是FT（同质化代币）
- 另一种资产通常是原生代币（TBC）

**FT通过Pool实现交易**:
- FT不能直接兑换成TBC（除非有交易所）
- 通过Pool可以自动兑换

**流动性提供者（LP）**:
- 存入FT和TBC到Pool
- 获得LP Token作为凭证
- 赚取交易手续费

---

## 3. TBC中的实现

### 3.1 PoolNFT合约结构
```javascript
class poolNFT {
    ft_lp_amount;        // LP代币数量
    ft_a_amount;         // 代币A（如USDT）数量
    tbc_amount;          // TBC数量
    ft_lp_partialhash;   // LP代币代码部分哈希
    ft_a_partialhash;    // 代币A代码部分哈希
    ft_a_contractTxid;   // 代币A的合约交易ID
    poolnft_code;        // Pool NFT代码
    contractTxid;        // Pool合约交易ID
    ft_a_number;         // 代币A的初始数量
    precision = BigInt(1000000);  // 精度（6位小数）
}
```

### 3.2 创建Pool流程
```javascript
async createPoolNFT(privateKey, utxo) {
    // 1. 创建源交易（用于生成Pool ID）
    const txSource = new tbc.Transaction()
        .from(utxo)
        .addOutput({
            script: tbc.Script.fromASM(`OP_DUP OP_HASH160 ${publicKeyHash} 
                OP_EQUALVERIFY OP_CHECKSIG OP_RETURN ${flagHex}`),
            satoshis: 9800
        })
        .change(privateKey.toAddress())
        .fee(80)
        .sign(privateKey)
        .seal();
    
    // 2. 获取代币A（FT）信息
    const FTA = new FT(this.ft_a_contractTxid);
    const FTAInfo = await API.fetchFtInfo(FTA.contractTxid, this.network);
    FTA.initialize(FTAInfo);
    
    // 3. 生成Pool NFT代码
    this.poolnft_code = this.getPoolNftCode(txSource.hash, 0)
        .toBuffer()
        .toString("hex");
    
    // 4. 生成LP代币代码
    const ftlpCode = this.getFTLPcode(
        tbc.crypto.Hash.sha256(Buffer.from(this.poolnft_code, "hex")).toString("hex"),
        privateKey.toAddress().toString(),
        FTA.tapeScript.length / 2
    );
    
    // 5. 计算部分哈希（用于优化）
    this.ft_lp_partialhash = partial_sha256.calculate_partial_hash(
        ftlpCode.toBuffer().subarray(0, 1536)
    );
    this.ft_a_partialhash = partial_sha256.calculate_partial_hash(
        Buffer.from(FTA.codeScript, "hex").subarray(0, 1536)
    );
    
    // 6. 构建Pool NFT交易
    const tx = new tbc.Transaction()
        .addInputFromPrevTx(txSource, 0)
        .addOutput({
            script: poolNFTScript,      // Pool NFT脚本
            satoshis: 1000              // Pool NFT Code 固定 1000 sat (v2 init 后为 1000+tbc_amount)
        })
        .addOutput({
            script: ftlpTapeScript,     // LP代币Tape脚本
            satoshis: 0
        })
        .addOutput({
            script: ft_a_script,        // 代币A脚本
            satoshis: 500
        })
        .addOutput({
            script: tbc_script,         // TBC脚本
            satoshis: 500
        })
        .feePerKb(80)
        .change(privateKey.toAddress());
    
    // 7. 设置解锁脚本并签名
    tx.setInputScript({inputIndex: 0}, (tx) => {
        return this.getPoolNFTunlockScript(privateKey, tx, ...);
    });
    
    tx.sign(privateKey).seal();
    return tx.uncheckedSerialize();
}
```

---

## 4. Pool中的三种代币

### 4.1 FT_A (代币A) - 外部代币
```javascript
// 如：USDT、DAI等稳定币
const FTA = new FT(this.ft_a_contractTxid);
const FTAInfo = await API.fetchFtInfo(FTA.contractTxid, this.network);

// 数量
this.ft_a_amount = BigInt(Math.floor(
    this.ft_a_number * Math.pow(10, FTA.decimal)
));
```

**作用**:
- 作为交易对的一方
- 提供价格锚定（如果是稳定币）

### 4.2 TBC - 原生代币
```javascript
// TBC数量（以satoshis为单位，6位小数）
this.tbc_amount = BigInt(Math.floor(
    config.txidOrParams.tbc_amount * Math.pow(10, 6)
));
```

**作用**:
- 作为交易对的另一方
- 支付交易手续费

### 4.3 FT_LP (LP代币) - 流动性代币
```javascript
// LP代币数量 = TBC数量（初始时1:1）
this.ft_lp_amount = this.tbc_amount;

// LP代币代码
const ftlpCode = this.getFTLPcode(
    tbc.crypto.Hash.sha256(Buffer.from(this.poolnft_code, "hex")).toString("hex"),
    privateKey.toAddress().toString(),
    FTA.tapeScript.length / 2
);
```

**作用**:
- 代表流动性提供者在池中的份额
- 可以兑换回原始资产
- 赚取交易手续费

---

## 5. 价格计算机制

### 5.1 恒定乘积公式（类似Uniswap）
```
价格 = TBC数量 / FT_A数量

例如：
- TBC: 500
- FT_A (USDT): 1000
- 价格：1 USDT = 0.5 TBC
```

### 5.2 交易计算
```javascript
// 买入FT_A（用TBC换FT_A）
function calculateOutAmount(inAmount, inReserve, outReserve) {
    // 扣除0.3%手续费
    const inAmountWithFee = inAmount * 997 / 1000;
    
    // 恒定乘积公式
    const numerator = inAmountWithFee * outReserve;
    const denominator = inReserve + inAmountWithFee;
    const outAmount = numerator / denominator;
    
    return outAmount;
}

// 示例：用100 TBC买USDT
const tbcIn = 100;
const tbcReserve = 500;
const usdtReserve = 1000;

const usdtOut = calculateOutAmount(tbcIn, tbcReserve, usdtReserve);
// 结果：约181.8 USDT
```

---

## 6. 流动性管理

### 6.1 添加流动性
```javascript
async addLiquidity(privateKey, ft_a_amount, tbc_amount) {
    // 1. 计算需要添加的比例
    const ratio = ft_a_amount / this.ft_a_amount;
    const requiredTBC = this.tbc_amount * ratio;
    
    // 2. 验证TBC数量
    if (tbc_amount < requiredTBC) {
        throw new Error("TBC amount insufficient");
    }
    
    // 3. 计算LP代币数量
    const lpAmount = this.ft_lp_amount * ratio;
    
    // 4. 构建交易
    // ... 添加FT_A和TBC到Pool
    // ... 铸造新的LP代币给提供者
}
```

### 6.2 移除流动性
```javascript
async removeLiquidity(privateKey, lp_amount) {
    // 1. 计算比例
    const ratio = lp_amount / this.ft_lp_amount;
    
    // 2. 计算可赎回的资产
    const ft_a_out = this.ft_a_amount * ratio;
    const tbc_out = this.tbc_amount * ratio;
    
    // 3. 销毁LP代币
    // 4. 返还FT_A和TBC
}
```

---

## 7. 交易执行流程

### 7.1 用TBC购买FT_A
```javascript
async swapTBCforFTA(privateKey, tbc_amount_in) {
    // 1. 计算可获得的FT_A
    const ft_a_out = calculateOutAmount(
        tbc_amount_in,
        this.tbc_amount,
        this.ft_a_amount
    );
    
    // 2. 更新池子储备
    this.tbc_amount += tbc_amount_in;
    this.ft_a_amount -= ft_a_out;
    
    // 3. 构建交易
    // ... 输入：TBC
    // ... 输出1：FT_A给交易者
    // ... 输出2：更新后的Pool NFT
}
```

### 7.2 用FT_A购买TBC
```javascript
async swapFTAforTBC(privateKey, ft_a_amount_in) {
    // 1. 计算可获得的TBC
    const tbc_out = calculateOutAmount(
        ft_a_amount_in,
        this.ft_a_amount,
        this.tbc_amount
    );
    
    // 2. 更新池子储备
    this.ft_a_amount += ft_a_amount_in;
    this.tbc_amount -= tbc_out;
    
    // 3. 构建交易
    // ... 输入：FT_A
    // ... 输出1：TBC给交易者
    // ... 输出2：更新后的Pool NFT
}
```

---

## 8. FT与Pool的关系总结

### 8.1 关系图
```
┌────────────────────────────────────────────────────────┐
│                      TBC生态                            │
│                                                        │
│   ┌─────────────┐         ┌───────────────────────┐   │
│   │   FT合约     │────────▶│      Pool NFT         │   │
│   │  (同质化代币) │         │     (流动性池)         │   │
│   │             │         │                       │   │
│   │  • USDT     │         │  ┌─────┐   ┌─────┐   │   │
│   │  • DAI      │         │  │FT_A │   │ TBC │   │   │
│   │  • MTK      │         │  └─────┘   └─────┘   │   │
│   └─────────────┘         │       ↓              │   │
│                            │   ┌───────┐         │   │
│                            │   │FT_LP  │         │   │
│                            │   │(份额) │         │   │
│                            │   └───────┘         │   │
│                            └───────────────────────┘   │
│                                                        │
│   关系：                                                │
│   1. FT是Pool的基础资产                                 │
│   2. Pool为FT提供流动性                                 │
│   3. LP代币代表Pool份额                                 │
│   4. 三者通过UTXO关联                                   │
└────────────────────────────────────────────────────────┘
```

### 8.2 核心关系

1. **FT是基础**
   - Pool必须包含至少一个FT
   - FT提供价值锚定

2. **Pool是基础设施**
   - 实现FT与TBC的自动兑换
   - 提供价格发现机制
   - 赚取交易手续费

3. **LP代币是凭证**
   - 证明流动性提供者的份额
   - 可兑换回原始资产
   - 分配手续费收益

4. **UTXO关联三者**
   - FT_A UTXO：代币A的锁定脚本
   - TBC UTXO：原生代币
   - LP UTXO：流动性份额证明
   - Pool NFT UTXO：池子状态

---

## 9. 代码实现关键点

### 9.1 部分哈希优化
```javascript
// 为了提高效率，使用部分SHA256哈希
const ft_lp_partialhash = partial_sha256.calculate_partial_hash(
    ftlpCode.toBuffer().subarray(0, 1536)
);

// 在解锁时，只需要验证部分哈希
// 减少计算量和交易大小
```

### 9.2 精度处理
```javascript
// TBC使用6位小数
const precision = BigInt(1000000);

// 计算时先转BigInt
const amount = BigInt(Math.floor(number * 1000000));
```

### 9.3 交易链
```javascript
// Pool交易通常涉及多个前置交易
// 1. 创建Pool的源交易
// 2. FT_A的合约交易
// 3. LP代币的合约交易
// 4. 当前Pool NFT交易

// 解锁脚本需要提供完整交易链数据
```

---

## 10. 总结

### FT是什么？
**同质化代币**，可互换、可分割，如USDT、DAI

### Pool是什么？
**流动性池**，包含FT和TBC两种资产，自动做市

### LP是什么？
**流动性代币**，代表你在Pool中的份额

### 三者关系？
```
FT + TBC → Pool → LP Token
(存入)      (生成)    (凭证)
```

### 实现核心？
- UTXO模型管理资产
- 恒定乘积公式定价
- 部分哈希优化性能
- 交易链保证安全

---

## 11. 实战策略：打狗（打新币）

### 11.1 什么是"打狗"
**打狗** = 打新币 = 在新币发行早期买入，博取高收益

### 11.2 核心策略：盯池子
```
监控目标：Pool NFT 创建事件
         ↓
发现新池：FT_A + TBC 流动性池
         ↓
早期进入：在价格发现前买入FT_A
         ↓
获利退出：价格上涨后卖出
```

### 11.3 技术实现要点

#### 监控Pool创建
```javascript
// 监控链上Pool NFT创建交易
// 关键字段：poolnft_code, ft_a_contractTxid

async monitorNewPools() {
    // 1. 扫描最新区块
    // 2. 识别Pool NFT创建交易
    // 3. 解析ft_a_contractTxid（新币合约ID）
    // 4. 获取FT信息（name, symbol, totalSupply）
    // 5. 计算初始价格
    // 6. 快速决策是否进入
}
```

#### 关键指标
| 指标 | 说明 | 判断标准 |
|------|------|----------|
| **初始市值** | Pool中TBC价值 | 小市值有爆发潜力 |
| **流动性** | TBC + FT_A总量 | 流动性高才好进出 |
| **合约安全** | 代码是否开源 | 防止rug pull |
| **社区热度** | Twitter/Telegram | 热度高关注度高 |

### 11.4 风险与收益

**收益**:
- 早期进入价格最低
- 流动性挖矿奖励
- 价格上涨空间大

**风险**:
- 项目方rug pull（跑路）
- 流动性不足无法卖出
- 价格暴跌归零

### 11.5 TBC链优势
1. **UTXO模型**：交易速度快，抢先成交
2. **低Gas费**：频繁监控成本低
3. **JavaScript合约**：易于分析和验证

---

*分析完成时间: 2026-03-03 23:45 CST*
*代码来源: TBC PoolNFT合约*
*掌握程度: 完全理解FT与Pool的关系及实现*
*实战策略: 打狗 = 盯池子 + 早进入*
