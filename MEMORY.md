# MEMORY.md - 长期记忆

## 文件结构

- `memory/watchlist.md` — 项目监控列表
- `memory/research/` — 项目研究报告存档（用 memory_search 检索）
- `memory/daily/` — 每日日志
- `memory/trading-rules.md` — 交易体系详细参考（已有对应 skill: trade-decision）
- `memory/token-research-framework.md` — 投研框架详细参考（已有对应 skill: token-research）

## Skills 说明

- **token-research** skill: 投研评估框架，每次 session 自动加载，不需要手动读文件
- **trade-decision** skill: 交易决策分析框架，每次 session 自动加载
- **market-scan** cron job: 每30分钟自动执行投研扫描（isolated session），结果发到 Telegram

## 常用链接

| 用途 | 链接 |
|------|------|
| 纳斯达克 | https://hk.finance.yahoo.com/quote/%5EIXIC/ |
| ETH清算图 | https://www.coinglass.com/zh/pro/futures/LiquidationMap |
| 新闻聚合 | https://cpytppulse.f1nd.fun/ |
| 币安模拟盘 | https://demo.binance.com/zh-CN/futures/ETHUSDT |
| 币安公告 | https://www.binance.com/zh-CN/support/announcement |
| OKX公告 | https://www.okx.com/zh-hans/help/section/announcements-new-listings |
| Hyperliquid | https://app.hyperliquid.xyz/explore |

## 关键经验教训

- 不要逆势操作（第一笔模拟交易亏损教训：15分钟看空但1小时看多，逆势做空亏了）
- 入场时机需要综合经验判断，不是满足条件就立即入场
- browser 操作币安页面经常超时/加载慢，需要耐心等待和重试
- Kimi API 对金融内容有风控，context 不要积累太大
- **交易日志必须明确记录多空方向**（2026-03-05 教训：日志记录为做空，实际为做多，导致误判）
- **定期检查持仓方向与日志记录是否一致**（开仓后应立即截图确认方向）
- **设置止盈止损是风险控制的关键步骤**（减仓+止盈止损可将风险控制在可接受范围）

## TBC (TuringBitChain) 技术

- 比特币侧链，SHA256 POW + UTXO
- 编译依赖: Boost 1.74/1.76, Berkeley DB, CMake
- RPC 端口: 8332
- 已发现高危漏洞：OP_LSHIFT/OP_RSHIFT 循环 DoS、大数运算资源耗尽、超大交易内存耗尽
- 代码位置: `tbc-node-code/`，分析文档: `knowledge/tbc-vulnerability-analysis*.md`
