# TBC Pool 合约深度分析

**学习时间:** 2026-03-06  
**学习范围:** PoolNFT (流动性池) 合约源码  
**源码路径:** `/Users/jay/.openclaw/workspace/tbc-contract-code/lib/contract/poolNFT.js`

---

## 1. Pool 合约概述

PoolNFT 是 TBC 上的 AMM (自动做市商) 流动性池合约，支持：
- 创建流动性池
- 添加/移除流动性
- 代币交换 (TBC ↔ FT)

---

## 2. 核心概念

### 2.1 流动性池结构
```
Pool NFT
├── ft_lp_amount: LP 代币总量
├── ft_a_amount: 池中 FT 数量
├── tbc_amount: 池中 TBC 数量
├── ft_lp_partialhash: LP 代码部分哈希
├── ft_a_partialhash: FT 代码部分哈希
└── ft_a_contractTxid: FT 合约交易ID
```

### 2.2 AMM 公式
```javascript
// 恒定乘积做市商
poolMul = ft_a_amount * tbc_amount  // 恒定

// Swap TBC→FT
new_tbc_amount = old_tbc_amount + amount_tbc
new_ft_a_amount = poolMul / new_tbc_amount
ft_out = old_ft_a_amount - new_ft_a_amount
```

---

## 3. 交易类型详解

### 3.1 Create Pool (创建池子)

**输入:**
- TBC UTXO (支付创建费用)

**输出:**
- Pool NFT Code (v1: 1000 satoshis; v2: 1000 satoshis 创建时，init 后变为 1000 + tbc_amount)
- Pool Tape (0 satoshis)

**脚本:**
```javascript
const poolnftTapeScript = tbc.Script.fromASM(
    `OP_FALSE OP_RETURN ${ft_lp_partialhash + ft_a_partialhash} ${amountData} ${ft_a_contractTxid} 4e54617065`
);
```

**溯源:** 追踪 TBC 费用来源

---

### 3.2 Add LP (添加流动性)

**输入:**
- Pool NFT UTXO
- FT UTXO
- TBC UTXO (手续费)

**输出:**
- 新的 Pool NFT (更新金额)
- LP Token (给流动性提供者)

**溯源:** 追踪 Pool NFT + FT + TBC 来源

---

### 3.3 Swap TBC→FT (TBC 换 FT)

**输入:**
- Pool NFT UTXO
- TBC UTXO (要换出的 TBC)
- FT UTXO (池中的 FT，用于计算)

**输出:**
- 新的 Pool NFT (更新后的金额)
- FT 给交易者
- 找零 FT 回池子

**AMM 计算:**
```javascript
const poolMul = this.ft_a_amount * this.tbc_amount;
const ft_a_amount = this.ft_a_amount;
this.tbc_amount = BigInt(this.tbc_amount) + BigInt(amount_tbcbn);
this.ft_a_amount = BigInt(poolMul) / BigInt(this.tbc_amount);
const ft_a_amount_decrement = BigInt(ft_a_amount) - BigInt(this.ft_a_amount);
```

**溯源:** 追踪 TBC 来源

---

### 3.4 Swap FT→TBC (FT 换 TBC)

**输入:**
- Pool NFT UTXO
- FT UTXO (要换出的 FT)

**输出:**
- 新的 Pool NFT
- TBC 给交易者

**溯源:** 追踪 FT 来源

---

### 3.5 Remove LP (移除流动性)

**输入:**
- LP Token UTXO

**输出:**
- FT (按比例)
- TBC (按比例)

**溯源:** 追踪 LP Token 来源

---

## 4. 脚本标记

### 4.1 Pool NFT Code
- v2 脚本末尾为 `32436f6465` ("2Code")，v1 为 `31436f6465` ("1Code") — 这是识别 Pool 交易的正确标记
- ⚠️ "bison"（6269736f6e）**不在脚本中**，它只是 `serverProvider_tag` 参数值，嵌入在 Code 脚本的 tag 字段里，不能用作识别标记
- 复杂的解锁脚本逻辑
- 使用部分哈希优化

### 4.2 Pool Tape
- 包含 `4e54617065` (NTape) 标记
- 格式: `partialhash1 + partialhash2 + amountData + contractId`

---

## 5. 溯源策略总结

| 交易类型 | 追踪目标 | 说明 |
|---------|---------|------|
| **Create Pool** | TBC 费用 | 创建需要支付 TBC |
| **Add LP** | Pool NFT + FT + TBC | 三种资产都参与 |
| **Swap TBC→FT** | TBC | 支付 TBC 获得 FT |
| **Swap FT→TBC** | FT | 支付 FT 获得 TBC |
| **Remove LP** | LP Token | 销毁 LP 获得资产 |

---

## 6. 关键发现

### 6.1 部分哈希优化
Pool 使用 `partial_sha256` 减少脚本大小：
```javascript
this.ft_lp_partialhash = partial_sha256.calculate_partial_hash(
    ftlpCode.toBuffer().subarray(0, 1536)
);
```

### 6.2 异步解锁脚本
Pool 解锁脚本需要异步获取数据：
```javascript
await tx.setInputScriptAsync({
    inputIndex: 0,
}, async (tx) => {
    const unlockingScript = await this.getPoolNFTunlock(
        privateKey, tx, 0, poolnft.txId, poolnft.outputIndex, 3, 1
    );
    return unlockingScript;
});
```

### 6.3 复合输入
Swap 交易通常有 3 个输入：
1. Pool NFT
2. TBC (或 FT)
3. FT (池中的，用于计算)

---

## 7. 与 FT/NFT 的区别

| 特性 | FT | NFT | Pool |
|------|-----|-----|------|
| **输入判断** | 看是否有 FT 输入 | 看是否有 NFT_Mint/NFT 输入 | 看 Pool NFT 输入 |
| **费用支付** | TBC | TBC | TBC |
| **复合资产** | 否 | 否 | 是 (FT + TBC) |
| **AMM 计算** | 无 | 无 | 有 |

---

## 8. 溯源实现要点

1. **识别 Pool 交易**: 看 vout[0] 脚本末尾是否有 `32436f6465` ("2Code", v2) 或 `31436f6465` ("1Code", v1)。⚠️ 不要用 "bison"（6269736f6e）作为识别标记，它不在脚本中
2. **判断操作类型**: 根据输入输出资产组合
3. **追踪策略**:
   - 支付什么资产就追踪什么资产
   - Create/Add 追踪所有输入
   - Swap 追踪支付的那方
   - Remove 追踪 LP Token

---

*更新时间: 2026-03-06*  
*代码来源: TBC GitHub SDK*
