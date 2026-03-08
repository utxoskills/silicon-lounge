---
name: token-research
description: "Crypto token investment research framework. Use when: (1) user asks to research/evaluate a token or project, (2) a new project is discovered during market scanning, (3) cron job triggers investment research scan, (4) user asks about a token's fundamentals. Provides two-phase evaluation (quick scan + deep research), data source URLs, investor tier lists, exchange signal ratings, and standardized output templates."
---

# Token Investment Research Skill

Two-phase research framework for evaluating crypto tokens/projects.

## Phase 1: Quick Scan

Check these signals rapidly. If most look positive, proceed to Phase 2.

- **Investors**: Any Tier 1/2 VCs? (see list below)
- **Exchange support**: Binance listing? Coinbase? OKX?
- **Social presence**: Twitter/Sorsa score decent?
- **Timing**: Still early enough to matter? (not already listed for a week)
- **Market cap vs FDV**: Reasonable ratio? Low float = risk

If signals are mostly positive -> Phase 2. Otherwise, note it in watchlist as low priority or skip.

## Phase 2: Deep Research

Evaluate across these dimensions (collect what's available, don't block on missing data):

### 1. Market Data
| Data | Source | Notes |
|------|--------|-------|
| Price | CoinGecko / DropsTab / Binance | Cross-reference |
| Market Cap (MC) | CoinGecko / DropsTab | Circulating supply * price |
| FDV | CoinGecko / DropsTab | Total supply * price |
| Circulating vs Total Supply | Official docs / CoinGecko | Large gap = dilution risk |
| 24h Volume | CoinGecko / Binance | Low volume = liquidity risk |
| Contract Address | CoinGecko / Official | Verify on-chain |

### 2. Listing Info
| Data | Source |
|------|--------|
| Launch date | ICO Drops / Official Twitter |
| Exchanges listed | ICO Drops / Binance announcements |
| Spot vs Futures | Exchange websites |
| Launchpool / Airdrop | Binance announcements |

### 3. Investors & Funding
| Data | Source |
|------|--------|
| Lead investors | RootData / ICO Drops |
| Funding rounds & amounts | RootData / Official |
| Valuation | Official disclosure |
| KOL attention | Sorsa / TweetScout |

### 4. Project Content
- What problem does it solve?
- What sector? (DeFi, L2, AI, RWA, GameFi, etc.)
- Sector ranking (#1, #2, #3?)
- Unique tech or moat?

### 5. Token Economics
- Distribution breakdown (team, investors, community, treasury)
- Unlock schedule (cliff, linear, etc.)
- Token utility (governance, gas, staking, etc.)

### 6. Treasury / Financial Health
- Treasury holdings
- Runway estimate
- Revenue model (if any)

### 7. Team & Audit
- Core team background
- Security audits (which firms?)
- Open source?

### 8. Community & Social
- Use Sorsa/TweetScout for scoring
- Check quality of engagement (not just follower count)


## Investor Tier List

**Tier 1 (Top)**
- YZi Labs (formerly Binance Labs)
- Jump Crypto
- a16z
- Paradigm
- Polychain

**Tier 2 (Strong)**
- Amber Group
- Animoca Brands
- Hack VC
- Primitive Ventures
- DWF Labs

**Tier 3**: Other smaller VCs

## Exchange Signal Strength

**Strongest**
- Binance Launchpool + Spot + Futures
- Coinbase listing

**Strong**
- Binance Spot + Futures
- OKX + Bybit dual listing

**Average**
- Futures only
- Second-tier exchanges only

## Twitter Influence Scoring (Sorsa/TweetScout)

| Metric | Excellent | Good | Average |
|--------|-----------|------|---------|
| Followers | >200K | 100K-200K | <100K |
| Score | >800 | 500-800 | <500 |
| Influencer follows | >500 | 200-500 | <200 |
| KOL attention | CZ/Yi He/top KOLs | Known KOLs | Regular accounts |

## Common Traps

**Data traps**
- Fake price: cross-check multiple sources, Binance is authoritative
- Fake market cap: check FDV vs MC gap, focus on circulating supply
- Fake volume: wash trading on minor exchanges, use Binance/OKX data

**Timing traps**
- Futures already live: wait for spot or move on
- TGE in 1-2 days: not enough time to research, skip
- Listed over a week: missed early opportunity

**Endorsement traps**
- Fake VC backing: verify on RootData
- Fake KOL attention: check interaction quality, use Sorsa scoring
- Fake Binance support: only trust official announcements

## Data Sources

| Tool | URL | Use |
|------|-----|-----|
| ICO Drops | https://icodrops.com/ | Upcoming token sales, TGE calendar |
| DropsTab | https://dropstab.com/ | Token metrics, unlock schedules |
| CoinGecko | https://www.coingecko.com/ | Price, MC, FDV, volume |
| RootData | https://rootdata.com/ | Investor lookup, hot projects |
| Binance Announcements | https://www.binance.com/en/support/announcement/ | Official listings |
| OKX Announcements | https://www.okx.com/zh-hans/help/section/announcements-new-listings | New listings |
| Sorsa | https://app.sorsa.io/ | Social influence scoring |
| Twitter/X | https://x.com/ | Project accounts, KOL activity |
| DexScreener | https://dexscreener.com/ | DEX trading data |
| CoinGlass | https://www.coinglass.com/ | Liquidation maps, OI, funding |
| Hyperliquid | https://app.hyperliquid.xyz/explore | Pre-launch / perps |

## Output: Quick Brief Template

When sending a quick assessment to user:

```
## [Project Name] ($TICKER)

**Core Data**
- Price: $X.XX | MC: $XXM | FDV: $XXM
- Circulating: XX% of total supply
- Launch: YYYY-MM-DD

**Investors**: [Lead investor] | Total: $XXM raised @ $XXM valuation
**Exchanges**: [List which exchanges, spot/futures]
**Sector**: [e.g. DeFi L2] | Rank: #X in sector

**Rating**: X/5
**Action**: Watch / Skip / Deep Research
```

## Output: Deep Report Template

Save to `memory/research/PROJECT-NAME.md`:

```
# [Project Name] Deep Research Report

## Core Data Summary
## Project Overview
## Funding History
## Exchange Support
## Token Economics (distribution, unlock schedule)
## Treasury & Financial Health
## Current Events & Catalysts
## Security & Audits
## Sector Comparison
## Risk Factors
## Conclusion & Rating
```

## After Research Actions

1. Write report to `memory/research/project-name.md`
2. Add/update row in `memory/watchlist.md`
3. Send brief summary to user
4. Log key points to `memory/daily/YYYY-MM-DD.md`
