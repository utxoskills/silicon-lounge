---
name: trade-decision
description: "Crypto trading decision and analysis framework. Use when: (1) user asks to analyze a trading opportunity, (2) considering entering or exiting a position, (3) reviewing market conditions for trading, (4) user asks about trading strategy or risk management. Provides comprehensive analysis framework covering macro, technical, and market structure analysis with risk management principles."
---

# Trading Decision & Analysis Skill

Comprehensive framework for analyzing crypto **futures** trading opportunities. Long and short are equally valid -- direction depends on analysis, not bias. This is a reference guide for thinking through trades -- not a rigid checklist. Synthesize across dimensions and use judgment.

**铁律：所有价格、盈亏、持仓数据必须来自工具返回的真实数据。没拿到数据就说"未获取到"，绝对不许编造数字。**

## Analysis Framework

### 1. Macro Environment

**US Equities**
- Nasdaq: high correlation with crypto, tech stock sentiment drives risk appetite
- MSTR (MicroStrategy): BTC leading indicator, MSTR drop -> BTC drop -> ETH drop (1-2h lag)
- S&P 500: overall risk sentiment

**News & Events**
- Geopolitics (conflicts, international relations)
- Fed policy (rates, CPI, NFP data releases)
- Industry events (ETF approvals, regulatory changes, protocol upgrades)
- Black swans (exchange hacks, project rugs)

**Market Cycle**
- Bull / Bear / Range-bound
- Where are we in the cycle?

### 2. Technical Analysis

**Trend**
- MA alignment: MA7 > MA25 > MA99 = bullish; reverse = bearish
- MACD: golden cross = buy signal, death cross = sell signal
- Price relative to recent range

**Support & Resistance**
- Previous highs/lows
- Round numbers (psychological levels)
- High-volume price zones

**Momentum**
- RSI: >70 overbought (consider short), <30 oversold (consider long)
- Divergence between price and indicators = strong signal

**Volatility**
- Bollinger Bands: squeeze = breakout coming, expansion = trend continuation
- ATR: measure of volatility magnitude

### 3. Market Structure Data

**Liquidation Map (CoinGlass)**
- High-density liquidation zones act as price "magnets"
- Cascade effects: one liquidation triggers more
- Use for: entry points near liquidation clusters, stop loss beyond clusters, take profit at next cluster

**Long/Short Ratio**
- \>1.5: extremely bullish sentiment, watch for reversal
- <0.7: extremely bearish, watch for bounce
- Extreme readings = contrarian signal

**Liquidation Data**
- 24h liquidation amounts
- Long vs short liquidation ratio
- Side with more liquidations tends to get squeezed further

**Open Interest (OI)**
- OI up + price up: trend confirmed
- OI up + price flat: breakout imminent
- OI down + price down: trend exhausting

**Funding Rate**
- Positive (longs pay shorts): market bullish, can short to collect funding
- Negative (shorts pay longs): market bearish, can long to collect funding
- Extreme funding = contrarian signal

**Whale / Smart Money (Arkham)**
- Large wallet accumulation = bullish signal
- Large transfers to exchanges = sell pressure incoming
- Notable entity activity (funds, institutions, known traders)
- Cross-reference with price action: whale buying during dip = strong

### 4. Key Data Sources

| Data | URL |
|------|-----|
| Nasdaq | https://hk.finance.yahoo.com/quote/%5EIXIC/ |
| Liquidation Map | https://www.coinglass.com/zh/pro/futures/LiquidationMap |
| News | https://cpytppulse.f1nd.fun/ |
| Binance Futures (demo) | https://demo.binance.com/zh-CN/futures/ETHUSDT |
| CoinGlass (OI, funding, liq) | https://www.coinglass.com/ |
| Arkham (whale tracking) | https://platform.arkhamintelligence.com/ |

## Strategy Reference

These are tools in the toolbox, not prescriptions. Pick what fits the current market.

**Trend Following**: ride the trend, buy pullbacks to support/MA in uptrend, sell rallies to resistance in downtrend. Stop at previous swing.

**Breakout**: enter on confirmed break of key level with volume. Watch for fakeouts (quick return inside range = stop out immediately).

**Pullback Buy**: in strong uptrend, wait for dip to support/MA. Don't chase if already up 5%+.

**Scalping**: short holds (minutes to hours), small targets, tight stops (0.5-1%), requires low fees.

**Grid Trading**: range-bound markets, buy low sell high within a band. Risk: trend breakout causes one-sided loss.

**Funding Rate Arbitrage**: collect funding by taking the opposite side of extreme funding. Watch for directional risk.

## Risk Management Principles

**Position Sizing**
- Single trade risk: 1-2% of capital max
- Total exposure: 20-30% of capital max
- Leverage: conservative 5-10x, experienced 15-20x

**Stop Loss**
- Technical stop: below support / above resistance
- Percentage stop: 2-3% from entry
- Time stop: close if no profit after extended hold

**Take Profit**
- Scale out: 50% at target 1, remainder at target 2
- Trailing stop: move stop to breakeven once in profit
- Target: next support/resistance level

## Pre-Trade Sanity Check

Before entering a position, think through:

- Does the macro picture support this direction?
- Is the trend clear or am I guessing?
- Am I at a good level (support/resistance), or chasing?
- What does the liquidation map suggest?
- Is sentiment extreme? (contrarian warning)
- Where exactly is my stop? Can I afford it?
- What's my target? Is the risk/reward reasonable (aim for >= 1:2)?
- Is my position size appropriate?

This is not a gate where all must pass. It's a framework for making sure you've considered the key factors.

## Trade Record Template

Log every trade to `memory/daily/YYYY-MM-DD.md`:

```
### Trade: [PAIR] [LONG/SHORT]
- Entry: $XX | Stop: $XX | Target: $XX
- Leverage: Xx | Size: X% of capital
- Analysis: [1-2 sentence summary of reasoning]
- Result: [P&L]
- Lesson: [What to improve]
```
