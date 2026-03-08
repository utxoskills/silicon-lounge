// index.js - 主程序
const PoolScanner = require('./scanner');
const PoolMonitor = require('./monitor');
const Alerter = require('./alerter');
const CONFIG = require('./config');

class DogHunter {
  constructor() {
    this.scanner = new PoolScanner();
    this.monitor = new PoolMonitor();
    this.alerter = new Alerter();
    this.isRunning = false;
    this.scanCount = 0;
  }

  async start() {
    console.clear();
    await this.alerter.sendStartup();
    
    // 加载历史监控数据
    await this.monitor.load();
    
    this.isRunning = true;
    
    // 立即执行一次扫描
    await this.scanNewPools();
    await this.monitorPools();
    
    // 定时扫描
    console.log(`[Main] 启动双线程监控:`);
    console.log(`  - 扫描新Pool: 每 ${CONFIG.NEW_POOL_SCAN_INTERVAL / 1000} 秒`);
    console.log(`  - 监控余额: 每 ${CONFIG.MONITOR_SCAN_INTERVAL / 1000} 秒`);
    
    // 1. 每30秒扫描新Pool
    const newPoolInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(newPoolInterval);
        return;
      }
      await this.scanNewPools();
    }, CONFIG.NEW_POOL_SCAN_INTERVAL);

    // 2. 每5秒监控已发现Pool
    const monitorInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(monitorInterval);
        return;
      }
      await this.monitorPools();
    }, CONFIG.MONITOR_SCAN_INTERVAL);

    // 优雅退出
    process.on('SIGINT', async () => {
      console.log('\n[Main] 收到退出信号，正在保存数据...');
      this.isRunning = false;
      clearInterval(newPoolInterval);
      clearInterval(monitorInterval);
      await this.monitor.save();
      console.log('[Main] 数据已保存，程序退出');
      process.exit(0);
    });
  }

  async scanNewPools() {
    this.scanCount++;
    console.log(`\n[Scan #${this.scanCount} - 新Pool扫描] ${new Date().toLocaleString()}`);
    console.log('-'.repeat(50));

    try {
      // 1. 扫描新Pool
      const newPools = await this.scanner.scanNewPools();
      
      // 2. 添加新Pool到监控
      let addedCount = 0;
      for (const pool of newPools) {
        if (this.monitor.addPool(pool)) {
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        console.log(`[Scan] 新增 ${addedCount} 个Pool到监控列表`);
      }

      // 3. 清理老Pool
      const cleaned = this.monitor.cleanup();
      if (cleaned > 0) {
        console.log(`[Scan] 清理了 ${cleaned} 个老Pool`);
      }

      // 4. 保存数据
      await this.monitor.save();

      // 5. 打印统计
      const stats = this.monitor.getStats();
      console.log(`[Scan] 监控中: ${stats.total} | 新Pool: ${stats.new_pools} | 已预警: ${stats.alerted}`);
      
    } catch (error) {
      console.error('[Scan] 扫描新Pool出错:', error.message);
    }
    
    console.log('-'.repeat(50));
  }

  async monitorPools() {
    try {
      const monitoredPools = this.monitor.getAllPools();
      
      // 只监控未触发预警的Pool
      const poolsToMonitor = monitoredPools.filter(p => !p.alert_triggered);
      
      if (poolsToMonitor.length === 0) {
        return; // 没有需要监控的Pool
      }
      
      console.log(`[Monitor] 监控 ${poolsToMonitor.length} 个Pool余额变化...`);
      
      for (const pool of poolsToMonitor) {
        const poolInfo = await this.scanner.getPoolInfo(pool.pool_id);
        
        if (poolInfo) {
          const result = this.monitor.updatePool(pool.pool_id, poolInfo);
          
          if (result) {
            if (result.type === 'ALERT') {
              // 触发预警
              await this.alerter.sendAlert(result);
              await this.monitor.save(); // 立即保存
            } else if (result.type === 'UPDATE' && Math.abs(result.change) > 0) {
              // 余额有变化
              await this.alerter.sendUpdate(result);
            }
          }
        }
      }
      
      // 批量保存监控数据
      await this.monitor.save();
      
    } catch (error) {
      console.error('[Monitor] 监控Pool出错:', error.message);
    }
  }

  // 手动触发一次扫描（用于测试）
  async scanOnce() {
    await this.scanNewPools();
    await this.monitorPools();
  }
}

// 启动程序
const hunter = new DogHunter();
hunter.start().catch(error => {
  console.error('[Main] 程序启动失败:', error);
  process.exit(1);
});
