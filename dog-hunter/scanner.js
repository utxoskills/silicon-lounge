// scanner.js - Pool扫描器
const axios = require('axios');
const CONFIG = require('./config');
const PoolLockDetector = require('./poolLockDetector');

class PoolScanner {
  constructor() {
    this.apiClient = axios.create({
      baseURL: CONFIG.API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    this.lockDetector = new PoolLockDetector();
  }

  // 获取所有Pool列表
  async getPoolList(start = 0, end = 500) {
    try {
      console.log(`[Scanner] 获取Pool列表: ${start}-${end}`);
      const response = await this.apiClient.get(
        `/pool/poollist/start/${start}/end/${end}`
      );
      
      if (response.data.code !== '200' && response.data.code !== 200) {
        console.error('[Scanner] API返回错误:', response.data.message);
        return [];
      }
      
      return response.data.data.pool_list || [];
    } catch (error) {
      console.error('[Scanner] 获取Pool列表失败:', error.message);
      return [];
    }
  }

  // 获取Pool详情
  async getPoolInfo(poolId) {
    try {
      const response = await this.apiClient.get(
        `/pool/poolinfo/poolid/${poolId}`
      );
      
      if (response.data.code !== '200' && response.data.code !== 200) {
        console.error(`[Scanner] 获取Pool ${poolId} 详情失败:`, response.data.message);
        return null;
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`[Scanner] 获取Pool ${poolId} 详情失败:`, error.message);
      return null;
    }
  }

  // 获取FT信息（代币详情）
  async getFTInfo(ftId) {
    try {
      const response = await this.apiClient.get(
        `/ft/ftinfo/ftid/${ftId}`
      );
      
      if (response.data.code !== '200' && response.data.code !== 200) {
        return null;
      }
      
      return response.data.data;
    } catch (error) {
      return null;
    }
  }

  // 扫描新Pool
  async scanNewPools() {
    const poolList = await this.getPoolList(0, 500);
    const now = Math.floor(Date.now() / 1000);
    const newPools = [];

    console.log(`[Scanner] 扫描到 ${poolList.length} 个Pool，筛选新Pool...`);

    for (const pool of poolList) {
      const age = now - pool.pool_create_timestamp;
      
      // 只关注1小时内创建的新Pool
      if (age <= CONFIG.POOL_AGE_THRESHOLD) {
        console.log(`[Scanner] 发现新Pool: ${pool.token_pair_b_name} (创建${Math.floor(age/60)}分钟前)`);
        
        const poolInfo = await this.getPoolInfo(pool.pool_id);
        if (poolInfo) {
          // 检测是否带锁
          const lockDetection = this.lockDetector.detect(poolInfo);
          
          // 如果配置了跳过带锁Pool，且检测到带锁，则跳过
          if (CONFIG.SKIP_LOCKED_POOLS && 
              lockDetection.hasLock === true && 
              lockDetection.confidence >= CONFIG.LOCK_CONFIDENCE_THRESHOLD) {
            console.log(`[Scanner] ⏭️  跳过带锁Pool: ${pool.token_pair_b_name} (${Math.round(lockDetection.confidence * 100)}% 置信度)`);
            continue;
          }
          
          // 获取代币详情
          const ftInfo = await this.getFTInfo(pool.token_pair_b_id);
          
          newPools.push({
            pool_id: pool.pool_id,
            token_name: pool.token_pair_b_name,
            token_id: pool.token_pair_b_id,
            token_symbol: ftInfo?.ft_symbol || pool.token_pair_b_name,
            token_decimal: ftInfo?.ft_decimal || 6,
            token_total_supply: ftInfo?.ft_total_supply || '0',
            token_holder_count: ftInfo?.ft_holder_count || 0,
            create_time: pool.pool_create_timestamp,
            tbc_balance: poolInfo.tbc_balance,
            token_balance: poolInfo.token_balance,
            lp_balance: poolInfo.lp_balance,
            version: poolInfo.version,
            service_fee_rate: poolInfo.service_fee_rate,
            age_seconds: age,
            // 带锁检测信息
            lock_info: {
              has_lock: lockDetection.hasLock,
              confidence: lockDetection.confidence,
              method: lockDetection.method,
              description: this.lockDetector.getLockStatusDescription(lockDetection),
            },
          });
        }
      }
    }

    console.log(`[Scanner] 找到 ${newPools.length} 个新Pool`);
    return newPools;
  }
}

module.exports = PoolScanner;
