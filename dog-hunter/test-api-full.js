// test-api-full.js - 测试所有Pool并找出带锁的

const axios = require('axios');
const PoolLockDetector = require('./poolLockDetector');

const API_BASE_URL = 'https://api.turingbitchain.io/api/tbc';

async function getAllPools() {
  const allPools = [];
  let start = 0;
  const batchSize = 50;
  let hasMore = true;
  
  while (hasMore && start < 1000) { // 最多获取1000个，防止无限循环
    try {
      const response = await axios.get(
        `${API_BASE_URL}/pool/poollist/start/${start}/end/${start + batchSize}`
      );
      
      if (response.data.code === '200' || response.data.code === 200) {
        const pools = response.data.data.pool_list;
        if (pools.length === 0) {
          hasMore = false;
        } else {
          allPools.push(...pools);
          console.log(`   获取到 ${pools.length} 个Pool (总计: ${allPools.length})`);
          
          if (pools.length < batchSize) {
            hasMore = false;
          } else {
            start += batchSize;
          }
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`   获取失败: ${error.message}`);
      hasMore = false;
    }
    
    // 延迟一下，避免请求太快
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return allPools;
}

async function test() {
  console.log('🧪 批量测试Pool带锁检测 (全量)\n');
  console.log('='.repeat(60));
  
  const detector = new PoolLockDetector();
  
  try {
    // 获取所有Pool列表
    console.log('\n📡 获取所有Pool列表...');
    const pools = await getAllPools();
    console.log(`✅ 总共获取到 ${pools.length} 个Pool\n`);
    
    if (pools.length === 0) {
      console.log('❌ 没有获取到任何Pool');
      return;
    }
    
    // 统计信息
    const stats = {
      total: 0,
      locked: 0,
      unlocked: 0,
      unknown: 0,
      lengths: [],
      lockedPools: [], // 记录带锁的Pool
    };
    
    // 检测所有Pool
    console.log('🔍 检测所有Pool:\n');
    
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      
      try {
        const detailResponse = await axios.get(
          `${API_BASE_URL}/pool/poolinfo/poolid/${pool.pool_id}`
        );
        
        if (detailResponse.data.code === '200' || detailResponse.data.code === 200) {
          const poolInfo = detailResponse.data.data;
          const detection = detector.detect(poolInfo);
          
          stats.total++;
          const length = poolInfo.pool_code_script?.length || 0;
          stats.lengths.push(length);
          
          if (detection.hasLock === true) {
            stats.locked++;
            stats.lockedPools.push({
              index: i + 1,
              name: pool.token_pair_b_name,
              poolId: pool.pool_id,
              length: length,
            });
            console.log(`🔒 [${i+1}] ${pool.token_pair_b_name} - 带锁 (${detection.method}) - ${length}字符`);
          } else if (detection.hasLock === false) {
            stats.unlocked++;
            // 只打印前3个无锁的，避免输出太多
            if (stats.unlocked <= 3) {
              console.log(`🔓 [${i+1}] ${pool.token_pair_b_name} - 无锁 (${detection.method}) - ${length}字符`);
            } else if (stats.unlocked === 4) {
              console.log(`   ... 还有 ${pools.length - i} 个Pool待检测 ...`);
            }
          } else {
            stats.unknown++;
            console.log(`❓ [${i+1}] ${pool.token_pair_b_name} - 未知`);
          }
        }
      } catch (error) {
        console.error(`   [${i+1}] 获取详情失败: ${error.message}`);
      }
      
      // 每10个显示进度
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`   进度: ${i+1}/${pools.length}\r`);
      }
      
      // 延迟一下，避免请求太快
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 打印统计
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 统计结果:');
    console.log(`   总检测: ${stats.total}`);
    console.log(`   🔒 带锁: ${stats.locked}`);
    console.log(`   🔓 无锁: ${stats.unlocked}`);
    console.log(`   ❓ 未知: ${stats.unknown}`);
    
    // 如果有带锁的Pool，详细列出
    if (stats.locked > 0) {
      console.log(`\n🔒 带锁Pool列表:`);
      stats.lockedPools.forEach(p => {
        console.log(`   [${p.index}] ${p.name}`);
        console.log(`       Pool ID: ${p.poolId}`);
        console.log(`       脚本长度: ${p.length}`);
      });
    }
    
    // 脚本长度统计
    if (stats.lengths.length > 0) {
      const minLength = Math.min(...stats.lengths);
      const maxLength = Math.max(...stats.lengths);
      const avgLength = Math.floor(stats.lengths.reduce((a, b) => a + b, 0) / stats.lengths.length);
      
      console.log(`\n📏 脚本长度统计:`);
      console.log(`   最小: ${minLength}`);
      console.log(`   最大: ${maxLength}`);
      console.log(`   平均: ${avgLength}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

test();
