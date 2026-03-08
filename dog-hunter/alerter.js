// alerter.js - 预警器
const axios = require('axios');
const CONFIG = require('./config');

class Alerter {
  constructor() {
    this.alertHistory = [];
  }

  // 发送预警
  async sendAlert(alertData) {
    const message = this.formatAlertMessage(alertData);
    
    // 控制台输出（带颜色）
    console.log('\n' + '🔥'.repeat(25));
    console.log(message);
    console.log('🔥'.repeat(25) + '\n');

    // 记录到历史
    this.alertHistory.push({
      time: new Date().toISOString(),
      data: alertData
    });

    // 发送Webhook（如果有配置）
    if (CONFIG.ALERT_WEBHOOK) {
      try {
        await axios.post(CONFIG.ALERT_WEBHOOK, {
          type: 'dog_hunter_alert',
          text: message,
          data: alertData,
          timestamp: new Date().toISOString(),
        }, {
          timeout: 10000
        });
        console.log('[Alerter] Webhook发送成功');
      } catch (error) {
        console.error('[Alerter] Webhook发送失败:', error.message);
      }
    }

    // 发送Telegram通知（如果启用）
    if (CONFIG.TELEGRAM?.ENABLED) {
      try {
        // 使用OpenClaw的消息工具发送
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        // 简化消息用于Telegram
        const tgMessage = this.formatTelegramAlert(alertData);
        
        // 调用openclaw message工具
        const cmd = `cd /Users/jay/.openclaw/workspace && echo '${tgMessage.replace(/'/g, "'\\''")}' | openclaw message send --target "${CONFIG.TELEGRAM.CHAT_ID}"`;
        await execAsync(cmd);
        console.log('[Alerter] Telegram通知发送成功');
      } catch (error) {
        console.error('[Alerter] Telegram通知发送失败:', error.message);
      }
    }
  }

  // 发送更新通知
  async sendUpdate(updateData) {
    const pool = updateData.pool;
    const change = updateData.change;
    const changeTBC = change / 1000000;
    
    const direction = change > 0 ? '📈' : '📉';
    const action = change > 0 ? '增加' : '减少';
    
    console.log(`[Alerter] ${direction} ${pool.token_name} TBC${action}: ${Math.abs(changeTBC).toFixed(6)} TBC`);
    console.log(`[Alerter]    当前: ${(updateData.new_balance / 1000000).toFixed(6)} TBC`);
  }

  // 格式化Telegram预警消息（简化版）
  formatTelegramAlert(alertData) {
    const pool = alertData.pool;
    const thresholdTBC = CONFIG.TBC_ALERT_THRESHOLD;
    const currentTBC = alertData.new_balance / 1000000;
    const oldTBC = alertData.old_balance / 1000000;
    const lockStatus = pool.lock_info?.description || '未知';
    
    return `
🚨 打狗预警 - 发现目标！

🔐 锁定状态: ${lockStatus}

💎 代币: ${pool.token_name} (${pool.token_symbol})
   持币人数: ${pool.token_holder_count}

💰 TBC余额突破 ${thresholdTBC} TBC
   之前: ${oldTBC.toFixed(6)} TBC
   现在: ${currentTBC.toFixed(6)} TBC ⬆️
   增长: ${(currentTBC - oldTBC).toFixed(6)} TBC

⏰ Pool创建: ${new Date(pool.create_time * 1000).toLocaleString()}
   监控时长: ${Math.floor((Date.now()/1000 - pool.first_seen)/60)} 分钟

⚡ 建议: 立即查看代币合约和持有人分布
💡 风险提示: 新币风险极高，建议小额试水
    `.trim();
  }

  // 格式化预警消息
  formatAlertMessage(alertData) {
    const pool = alertData.pool;
    const thresholdTBC = CONFIG.TBC_ALERT_THRESHOLD;
    const currentTBC = alertData.new_balance / 1000000;
    const oldTBC = alertData.old_balance / 1000000;
    const lockStatus = pool.lock_info?.description || '未知';
    
    return `
🚨🚨🚨 打狗预警 - 发现目标！🚨🚨🚨

🔐 锁定状态: ${lockStatus}

💎 代币信息:
   名称: ${pool.token_name}
   符号: ${pool.token_symbol}
   精度: ${pool.token_decimal}
   总供应: ${pool.token_total_supply}
   持币人数: ${pool.token_holder_count}

📊 Pool信息:
   Pool ID: ${pool.pool_id}
   代币ID: ${pool.token_id}
   版本: ${pool.version}
   手续费率: ${pool.service_fee_rate / 10000}%

💰 TBC余额突破阈值:
   阈值: ${thresholdTBC} TBC
   之前: ${oldTBC.toFixed(6)} TBC
   现在: ${currentTBC.toFixed(6)} TBC ⬆️
   增长: ${(currentTBC - oldTBC).toFixed(6)} TBC

📈 Pool状态:
   TBC余额: ${currentTBC.toFixed(6)} TBC
   Token余额: ${pool.token_balance}
   LP余额: ${pool.lp_balance}

⏰ 时间信息:
   Pool创建: ${new Date(pool.create_time * 1000).toLocaleString()}
   首次发现: ${new Date(pool.first_seen * 1000).toLocaleString()}
   预警时间: ${new Date().toLocaleString()}
   监控时长: ${Math.floor((Date.now()/1000 - pool.first_seen)/60)} 分钟

🔗 快速链接:
   浏览器: https://explorer.turingwallet.xyz/pool/${pool.pool_id}
   代币详情: https://explorer.turingwallet.xyz/ft/${pool.token_id}

⚡ 建议操作:
   1. 立即查看代币合约和持有人分布
   2. 分析交易历史和流动性变化
   3. 评估是否进入及进入仓位
   4. 设置止损和止盈点

💡 风险提示:
   - 新币风险极高，可能归零
   - 注意Rug Pull风险
   - 建议小额试水，不要重仓
   - 及时止损，保护本金
    `.trim();
  }

  // 发送统计报告
  async sendReport(stats) {
    const message = `
📊 打狗监控统计报告

当前监控状态:
  总监控Pool数: ${stats.total}
  新Pool监控中: ${stats.new_pools}
  已触发预警: ${stats.alerted}

最后更新: ${new Date().toLocaleString()}
    `.trim();
    
    console.log('\n' + '='.repeat(40));
    console.log(message);
    console.log('='.repeat(40) + '\n');
  }

  // 发送启动消息
  async sendStartup() {
    const message = `
🚀 打狗预警程序已启动！

监控配置:
  API地址: ${CONFIG.API_BASE_URL}
  扫描新Pool: 每 ${CONFIG.NEW_POOL_SCAN_INTERVAL / 1000} 秒
  监控余额: 每 ${CONFIG.MONITOR_SCAN_INTERVAL / 1000} 秒
  新Pool定义: ${CONFIG.POOL_AGE_THRESHOLD / 60} 分钟内创建
  TBC预警阈值: ${CONFIG.TBC_ALERT_THRESHOLD} TBC
  
启动时间: ${new Date().toLocaleString()}
    `.trim();
    
    console.log('\n' + '✅'.repeat(20));
    console.log(message);
    console.log('✅'.repeat(20) + '\n');
  }

  // 获取预警历史
  getAlertHistory() {
    return this.alertHistory;
  }
}

module.exports = Alerter;
