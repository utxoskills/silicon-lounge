// config.js - 配置文件
const CONFIG = {
  // API配置
  API_BASE_URL: 'https://api.turingbitchain.io/api/tbc',
  
  // 监控配置
  NEW_POOL_SCAN_INTERVAL: 30000,      // 扫描新Pool：30秒一次
  MONITOR_SCAN_INTERVAL: 5000,        // 监控已发现Pool：5秒一次
  POOL_AGE_THRESHOLD: 3600,           // 新Pool定义：1小时内创建（秒）
  TBC_ALERT_THRESHOLD: 1000,          // TBC预警阈值：1000 TBC（注意：API返回的是satoshis，需要转换）
  
  // 带锁Pool过滤配置
  SKIP_LOCKED_POOLS: false,           // 是否跳过带锁的Pool（true=只监控无锁Pool，false=监控所有）
  LOCK_CONFIDENCE_THRESHOLD: 0.7,     // 带锁检测置信度阈值（超过此值认为是带锁）
  
  // 存储配置
  DATA_FILE: './data/monitored_pools.json',
  
  // 预警配置
  ALERT_WEBHOOK: '',  // 发送预警的webhook地址，为空则只打印到控制台
  
  // Telegram通知配置
  TELEGRAM: {
    ENABLED: true,
    CHAT_ID: '8148831329',  // 你的Telegram ID
  },
  
  // 日志配置
  LOG_LEVEL: 'info',  // debug, info, warn, error
};

module.exports = CONFIG;
