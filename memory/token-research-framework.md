# 代币投研经验知识库

## 一、投研核心框架

### 1.1 必须收集的数据

#### 基础数据
| 数据项 | 来源 | 重要性 |
|--------|------|--------|
| 当前价格 | CoinGecko/DropsTab/币安 | ⭐⭐⭐ |
| 市值 (MC) | CoinGecko/DropsTab | ⭐⭐⭐ |
| 完全稀释估值 (FDV) | CoinGecko/DropsTab | ⭐⭐⭐ |
| 流通供应量 | CoinGecko/DropsTab | ⭐⭐⭐ |
| 总供应量 | 官方文档/白皮书 | ⭐⭐⭐ |
| 24h交易量 | CoinGecko/币安 | ⭐⭐ |
| 合约地址 | CoinGecko/官方 | ⭐⭐⭐ |

#### 上线信息
| 数据项 | 来源 | 重要性 |
|--------|------|--------|
| 上线时间 | ICO Drops/官方推特 | ⭐⭐⭐ |
| 上线交易所 | ICO Drops/币安公告 | ⭐⭐⭐ |
| 现货/合约 | 币安官网 | ⭐⭐⭐ |
| Launchpool/Airdrop | 币安公告 | ⭐⭐ |

#### 融资与背书
| 数据项 | 来源 | 重要性 |
|--------|------|--------|
| 投资方 | RootData/ICO Drops | ⭐⭐⭐ |
| 融资轮次/金额 | RootData/官方 | ⭐⭐⭐ |
| 估值 | 官方披露 | ⭐⭐ |
| KOL关注 | TweetScout/Sorsa | ⭐⭐ |

---

## 二、关键判断标准

### 2.1 投资方评级

**Tier 1 (顶级)**
- YZi Labs (原币安Labs)
- Jump Crypto
- a16z
- Paradigm
- Polychain

**Tier 2 (优质)**
- Amber Group
- Animoca Brands
- Hack VC
- Primitive Ventures
- DWF Labs

**Tier 3 (一般)**
- 其他中小VC

### 2.2 交易所支持评级

**最强信号**
- 币安 Launchpool + 现货 + 合约
- Coinbase 上市

**强信号**
- 币安现货 + 合约
- OKX/Bybit 双上线

**一般信号**
- 仅合约交易
- 仅二线交易所

### 2.3 Twitter 影响力评分 (Sorsa/TweetScout)

| 指标 | 优秀 | 良好 | 一般 |
|------|------|------|------|
| 粉丝数 | >200K | 100K-200K | <100K |
| 评分 | >800 | 500-800 | <500 |
| 影响力账号 | >500 | 200-500 | <200 |
| KOL关注 | CZ/Yi He/顶级KOL | 知名KOL | 普通账号 |

---

## 三、快速筛选流程

### 3.1 发现项目
1. **ICO Drops** -  upcoming token sales
2. **币安公告** - Launchpool/New Listings
3. **RootData** - Hot Projects 排名
4. **TweetScout** - Trending projects

### 3.2 初步筛选 (5分钟)
- [ ] 有顶级投资方？
- [ ] 有币安支持？
- [ ] Twitter 评分 >500？
- [ ] 距离上线还有时间？

**满足3项以上 → 深入研究**

### 3.3 深度研究 (30分钟)
1. 收集完整数据 (价格、市值、融资)
2. 分析代币经济 (分配、解锁、用途)
3. 评估赛道地位 (#1/#2/#3)
4. 查看 KOL 站台情况
5. 总结投资逻辑和风险

---

## 四、常见陷阱

### 4.1 数据陷阱
| 陷阱 | 识别方法 | 应对 |
|------|----------|------|
| 假价格 | 对比多个数据源 | 以币安为准 |
| 假市值 | FDV vs MC 差距大 | 关注流通量 |
| 假交易量 | 刷量交易所 | 看币安/OKX数据 |

### 4.2 时间陷阱
| 陷阱 | 识别 | 应对 |
|------|------|------|
| 已上线合约 | 币安已有合约交易 | 等现货或看其他 |
| 即将TGE | 只剩1-2天 | 来不及研究就放弃 |
| 已发币很久 | 上线超过1周 | 错过早期机会 |

### 4.3 背书陷阱
| 陷阱 | 识别 | 应对 |
|------|------|------|
| 假VC背书 | 查证 RootData | 交叉验证 |
| 假KOL关注 | 看互动质量 | 用 Sorsa 评分 |
| 币安假支持 | 看官方公告 | 以公告为准 |

---

## 五、工具清单

### 数据源
- **ICO Drops**: https://icodrops.com/
- **DropsTab**: https://dropstab.com/
- **CoinGecko**: https://www.coingecko.com/
- **RootData**: https://rootdata.com/
- **币安公告**: https://www.binance.com/en/support/announcement/

### 社交分析
- **Sorsa (原TweetScout)**: https://app.sorsa.io/
- **Twitter**: https://x.com/

### 链上数据
- **DexScreener**: https://dexscreener.com/
- **CoinGlass**: https://www.coinglass.com/

---

## 六、输出模板

### 快速简报 (5分钟输出)
```
## [项目名] (代币)

### 核心数据
- 价格: $X.XX (±X%)
- 市值: $XXM (Rank #X)
- FDV: $XXM
- 上线时间: YYYY-MM-DD

### 投资方
- 领投: XXX
- 总融资: $XXM @ $XXM估值

### 交易所
- [ ] 币安 Launchpool
- [ ] 币安现货
- [ ] 币安合约

### 结论
- 评级: X/5
- 行动: 关注/放弃/深入研究
```

### 深度报告 (30分钟输出)
```
# [项目名] 深度投研报告

## 核心数据速览
## 项目定位
## 融资历程
## 交易所支持
## 代币经济
## 当前活动
## 安全审计
## 赛道对比
## 风险提示
## 投研结论
```

---

## 七、更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-03-04 | 初始版本，总结 BSB/OPN 投研经验 |

---

*下次投研时直接参考此框架，确保不遗漏关键信息*
