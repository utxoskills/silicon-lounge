// monitor.js - 监控器
const fs = require('fs').promises;
const CONFIG = require('./config');

class PoolMonitor {
  constructor() {
    this.monitoredPools = new Map(); // pool_id -> pool_data
  }

  // 加载已监控的Pool
  async load() {
    try {
      const data = await fs.readFile(CONFIG.DATA_FILE, 'utf8');
      const pools = JSON.parse(data);
      for (const pool of pools) {
        this.monitoredPools.set(pool.pool_id, pool);
      }
      console.log(`[Monitor] 加载了 ${this.monitoredPools.size} 个监控中的Pool`);
    } catch (error) {
      console.log('[Monitor] 没有历史监控数据，从头开始');
    }
  }

  // 保存监控数据
  async save() {
    try {
      const data = Array.from(this.monitoredPools.values());
      await fs.writeFile(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[Monitor] 保存监控数据失败:', error.message);
    }
  }

  // 添加新Pool到监控
  addPool(poolData) {
    if (!this.monitoredPools.has(poolData.pool_id)) {
      const now = Math.floor(Date.now() / 1000);
      const lockStatus = poolData.lock_info?.description || '未知';
      
      this.monitoredPools.set(poolData.pool_id, {
        ...poolData,
        first_seen: now,
        last_updated: now,
        max_tbc_balance: poolData.tbc_balance,
        alert_triggered: false,
        alert_time: null,
        tbc_history: [{
          time: now,
          balance: poolData.tbc_balance
        }]
      });
      
      console.log(`[Monitor] 🆕 开始监控新Pool: ${poolData.token_name}`);
      console.log(`[Monitor]    Pool ID: ${poolData.pool_id}`);
      console.log(`[Monitor]    锁定状态: ${lockStatus}`);
      console.log(`[Monitor]    当前TBC: ${this.formatTBC(poolData.tbc_balance)} TBC`);
      return true;
    }
    return false;
  }

  // 更新Pool状态
  updatePool(poolId, newData) {
    const pool = this.monitoredPools.get(poolId);
    if (!pool) return null;

    const now = Math.floor(Date.now() / 1000);
    const oldBalance = pool.tbc_balance;
    const newBalance = newData.tbc_balance;
    
    // 更新TBC余额
    pool.tbc_balance = newBalance;
    pool.last_updated = now;
    
    // 记录历史
    pool.tbc_history.push({
      time: now,
      balance: newBalance
    });
    
    // 只保留最近100条记录
    if (pool.tbc_history.length > 100) {
      pool.tbc_history = pool.tbc_history.slice(-100);
    }
    
    // 记录最大值
    if (newBalance > pool.max_tbc_balance) {
      pool.max_tbc_balance = newBalance;
    }

    // 检查是否触发预警（从低于阈值到超过阈值）
    const thresholdSatoshis = CONFIG.TBC_ALERT_THRESHOLD * 1000000; // 转换为satoshis
    
    const shouldAlert = (
      oldBalance <= thresholdSatoshis &&
      newBalance > thresholdSatoshis &&
      !pool.alert_triggered
    );

    if (shouldAlert) {
      pool.alert_triggered = true;
      pool.alert_time = now;
      
      return {
        type: 'ALERT',
        pool: { ...pool },
        old_balance: oldBalance,
        new_balance: newBalance,
        threshold: thresholdSatoshis,
      };
    }

    // 如果余额有变化，返回更新信息
    if (Math.abs(newBalance - oldBalance) > 0) {
      return {
        type: 'UPDATE',
        pool: { ...pool },
        old_balance: oldBalance,
        new_balance: newBalance,
        change: newBalance - oldBalance,
      };
    }

    return null;
  }

  // 清理老Pool（超过1小时且未触发预警的）
  cleanup() {
    const now = Math.floor(Date.now() / 1000);
    let cleaned = 0;
    
    for (const [poolId, pool] of this.monitoredPools) {
      const age = now - pool.first_seen;
      // 清理超过1小时且未触发预警的Pool
      if (age > CONFIG.POOL_AGE_THRESHOLD && !pool.alert_triggered) {
        this.monitoredPools.delete(poolId);
        cleaned++;
        console.log(`[Monitor] 🧹 清理老Pool: ${pool.token_name} (超过1小时未触发)`);
      }
    }
    
    return cleaned;
  }

  // 获取所有监控中的Pool
  getAllPools() {
    return Array.from(this.monitoredPools.values());
  }

  // 获取监控统计
  getStats() {
    const pools = Array.from(this.monitoredPools.values());
    return {
      total: pools.length,
      new_pools: pools.filter(p => !p.alert_triggered).length,
      alerted: pools.filter(p => p.alert_triggered).length,
    };
  }

  // 格式化TBC显示（satoshis -> TBC）
  formatTBC(satoshis) {
    return (satoshis / 1000000).toFixed(6);
  }
}

module.exports = PoolMonitor;
