// poolLockDetector.js - Pool带锁检测器（字节码版 - 最终版）

class PoolLockDetector {
  constructor() {
    // 带锁Pool的字节码特征（从合约代码提取）
    // getPoolNftCodeWithLock 在脚本中插入了时间锁验证代码
    // 关键特征：OP_DUP OP_1 OP_SPLIT OP_NIP OP_5 OP_SPLIT OP_DROP 0x05 0x0000000000 OP_EQUALVERIFY
    // 字节码: 76 51 7f 77 55 7f 75 05 00 00 00 00 00 88
    this.LOCK_PATTERN_HEX = '76517f77557f7505000000000088';
    
    // 备选特征：查找 05 后面跟 5个0字节 (时间锁数据)
    this.LOCK_TIME_PATTERN = /05(00){5}/;
    
    // 无锁脚本的特征（结尾部分）
    // 以 OP_1 OP_RETURN "PizzaSwap2" "2Code" 结尾
    this.UNLOCK_ENDING = '516a0950697a7a61537761700532436f6465';
    
    // 脚本长度阈值
    this.LENGTH_LOCKED_MIN = 7500;   // 带锁脚本最小长度
    this.LENGTH_UNLOCKED_MAX = 7200; // 无锁脚本最大长度
  }

  /**
   * 检测Pool是否带锁
   * @param {Object} poolInfo - Pool详情（从API获取）
   * @returns {Object} 检测结果
   */
  detect(poolInfo) {
    if (!poolInfo || !poolInfo.pool_code_script) {
      return {
        hasLock: null,
        reason: '缺少pool_code_script数据',
      };
    }

    const scriptHex = poolInfo.pool_code_script.toLowerCase();
    const length = scriptHex.length;
    
    // 方法1: 检测带锁特征字节码（最准确）
    if (scriptHex.includes(this.LOCK_PATTERN_HEX)) {
      return {
        hasLock: true,
        method: 'bytecode-signature',
        reason: '检测到带锁Pool的字节码特征（时间锁验证代码）',
      };
    }
    
    // 方法2: 检测时间锁数据模式
    if (this.LOCK_TIME_PATTERN.test(scriptHex)) {
      return {
        hasLock: true,
        method: 'bytecode-timelock',
        reason: '检测到时间锁数据模式',
      };
    }
    
    // 方法3: 检测无锁特征
    if (scriptHex.endsWith(this.UNLOCK_ENDING) || 
        scriptHex.includes(this.UNLOCK_ENDING)) {
      return {
        hasLock: false,
        method: 'bytecode-ending',
        reason: '检测到无锁Pool的标准结尾',
      };
    }
    
    // 方法4: 通过脚本长度判断（备选）
    if (length > this.LENGTH_LOCKED_MIN) {
      return {
        hasLock: true,
        method: 'length',
        reason: `脚本长度 ${length} > ${this.LENGTH_LOCKED_MIN}，判断为带锁Pool`,
      };
    } else if (length < this.LENGTH_UNLOCKED_MAX) {
      return {
        hasLock: false,
        method: 'length',
        reason: `脚本长度 ${length} < ${this.LENGTH_UNLOCKED_MAX}，判断为无锁Pool`,
      };
    } else {
      // 长度在中间区域，无法确定
      return {
        hasLock: null,
        method: 'unknown',
        reason: `脚本长度 ${length} 在模糊区域，无法确定`,
      };
    }
  }

  /**
   * 获取人类可读的锁定状态描述
   */
  getLockStatusDescription(detectionResult) {
    if (detectionResult.hasLock === null) {
      return '❓ 未知';
    }
    
    if (detectionResult.hasLock) {
      return `🔒 带锁`;
    } else {
      return `🔓 无锁`;
    }
  }

  /**
   * 获取详细说明
   */
  getDetailedDescription(detectionResult) {
    if (detectionResult.hasLock === null) {
      return `❓ 锁定状态: 未知\n   原因: ${detectionResult.reason}`;
    }
    
    const status = detectionResult.hasLock ? '🔒 带锁' : '🔓 无锁';
    return `${status}\n   检测方法: ${detectionResult.method}\n   原因: ${detectionResult.reason}`;
  }
}

module.exports = PoolLockDetector;
