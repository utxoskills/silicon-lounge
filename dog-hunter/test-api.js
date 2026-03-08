// test-api.js - 直接测试API并检测Pool带锁状态

const axios = require('axios');
const PoolLockDetector = require('./poolLockDetector');

const API_BASE_URL = 'https://api.turingbitchain.io/api/tbc';

async function test() {
  console.log('🧪 测试TBC API和Pool带锁检测\n');
  console.log('='.repeat(60));
  
  const detector = new PoolLockDetector();
  
  try {
    // 1. 获取Pool列表
    console.log('\n📡 获取Pool列表...');
    const response = await axios.get(`${API_BASE_URL}/pool/poollist/start/0/end/10`);
    
    if (response.data.code !== '200' && response.data.code !== 200) {
      console.error('API返回错误:', response.data.message);
      return;
    }
    
    const pools = response.data.data.pool_list;
    console.log(`✅ 获取到 ${pools.length} 个Pool`);
    
    // 2. 获取前3个Pool的详细信息并检测
    console.log('\n🔍 检测前3个Pool的带锁状态:\n');
    
    for (let i = 0; i < Math.min(3, pools.length); i++) {
      const pool = pools[i];
      console.log(`\n📋 Pool #${i + 1}: ${pool.token_pair_b_name}`);
      console.log(`   Pool ID: ${pool.pool_id}`);
      console.log(`   创建时间: ${new Date(pool.pool_create_timestamp * 1000).toLocaleString()}`);
      
      // 获取Pool详情
      try {
        const detailResponse = await axios.get(
          `${API_BASE_URL}/pool/poolinfo/poolid/${pool.pool_id}`
        );
        
        if (detailResponse.data.code === '200' || detailResponse.data.code === 200) {
          const poolInfo = detailResponse.data.data;
          
          console.log(`   TBC余额: ${poolInfo.tbc_balance / 1000000} TBC`);
          console.log(`   脚本长度: ${poolInfo.pool_code_script?.length || 0} 字符`);
          
          // 检测带锁状态
          const detection = detector.detect(poolInfo);
          console.log(`   锁定状态: ${detector.getDetailedDescription(detection)}`);
        }
      } catch (error) {
        console.error(`   获取详情失败: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

test();
