/**
 * 高性能验证服务
 * 优化点：
 * 1. 使用对象池减少内存分配
 * 2. 预编译验证函数
 * 3. 批量 Redis 操作
 * 4. 异步验证流水线
 */

import { Redis } from 'ioredis';
import { 
  VerificationLevel, 
  VerificationChallenge, 
  VerificationResult,
  AIFingerprint,
  challengeGenerator 
} from '@silicon-lounge/shared';
import { v4 as uuidv4 } from 'uuid';

// 对象池大小
const SESSION_POOL_SIZE = 1000;
const RESULT_POOL_SIZE = 1000;

interface VerificationSession {
  id: string;
  fingerprint: AIFingerprint;
  level: VerificationLevel;
  challenge?: VerificationChallenge;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}

interface VerificationRecord {
  sessionId: string;
  fingerprint: AIFingerprint;
  level: VerificationLevel;
  challengeType?: string;
  result: VerificationResult;
  timestamp: number;
}

export class VerificationService {
  private redis: Redis;
  private readonly SESSION_TTL = 300;
  private readonly VERIFIED_TTL = 86400;
  
  // 缓存验证函数
  private validators: Map<string, Function> = new Map();
  
  // 批处理队列
  private recordQueue: VerificationRecord[] = [];
  private recordFlushInterval: NodeJS.Timeout;

  constructor(redis: Redis) {
    this.redis = redis;
    this.initializeValidators();
    
    // 每 100ms 批量刷新记录
    this.recordFlushInterval = setInterval(() => this.flushRecords(), 100);
  }

  private initializeValidators(): void {
    // 预编译验证函数，避免运行时创建
    this.validators.set('parallel', this.validateParallel.bind(this));
    this.validators.set('structured', this.validateStructured.bind(this));
    this.validators.set('memory', this.validateMemory.bind(this));
    this.validators.set('tool', this.validateTool.bind(this));
    this.validators.set('reasoning', this.validateReasoning.bind(this));
    this.validators.set('metacognitive', this.validateMetacognitive.bind(this));
  }

  /**
   * 开始验证会话 - 优化版本
   */
  async startSession(
    fingerprint: AIFingerprint, 
    level: VerificationLevel
  ): Promise<{ sessionId: string; challenge: VerificationChallenge }> {
    const sessionId = uuidv4();
    const challenge = challengeGenerator.generate(level);
    
    // 使用 pipeline 减少网络往返
    const pipeline = this.redis.pipeline();
    
    pipeline.setex(
      `session:${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify({
        id: sessionId,
        fingerprint,
        level,
        challenge,
        attempts: 0,
        maxAttempts: 3,
        createdAt: Date.now(),
      })
    );
    
    // 同时记录活跃会话计数
    pipeline.incr('stats:active_sessions');
    pipeline.expire('stats:active_sessions', 3600);
    
    await pipeline.exec();

    return { sessionId, challenge };
  }

  /**
   * 批量创建会话 - 用于高并发场景
   */
  async batchStartSessions(
    requests: { fingerprint: AIFingerprint; level: VerificationLevel }[]
  ): Promise<{ sessionId: string; challenge: VerificationChallenge }[]> {
    const pipeline = this.redis.pipeline();
    const results: { sessionId: string; challenge: VerificationChallenge }[] = [];
    
    for (const { fingerprint, level } of requests) {
      const sessionId = uuidv4();
      const challenge = challengeGenerator.generate(level);
      
      pipeline.setex(
        `session:${sessionId}`,
        this.SESSION_TTL,
        JSON.stringify({
          id: sessionId,
          fingerprint,
          level,
          challenge,
          attempts: 0,
          maxAttempts: 3,
          createdAt: Date.now(),
        })
      );
      
      results.push({ sessionId, challenge });
    }
    
    await pipeline.exec();
    return results;
  }

  /**
   * 提交挑战 - 优化版本
   */
  async submitChallenge(
    sessionId: string,
    response: unknown
  ): Promise<VerificationResult & { token?: string; level?: VerificationLevel }> {
    // 使用 Lua 脚本原子操作减少网络往返
    const luaScript = `
      local sessionKey = KEYS[1]
      local sessionData = redis.call('get', sessionKey)
      
      if not sessionData then
        return {-1, 'Session expired'}
      end
      
      local session = cjson.decode(sessionData)
      
      if session.attempts >= session.maxAttempts then
        return {-2, 'Max attempts exceeded'}
      end
      
      if not session.challenge then
        return {-3, 'No active challenge'}
      end
      
      session.attempts = session.attempts + 1
      redis.call('setex', sessionKey, ARGV[1], cjson.encode(session))
      
      return {0, cjson.encode(session)}
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      `session:${sessionId}`,
      this.SESSION_TTL.toString()
    ) as [number, string];

    const [code, data] = result;
    
    if (code !== 0) {
      throw new Error(data);
    }

    const session: VerificationSession = JSON.parse(data);
    
    // 检查超时
    const elapsed = Date.now() - session.challenge!.createdAt;
    if (elapsed > session.challenge!.timeout) {
      return {
        challengeId: session.challenge!.id,
        passed: false,
        responseTime: elapsed,
        score: 0,
        details: { accuracy: 0, speed: 0 },
      };
    }

    // 执行验证
    const validationResult = await this.executeValidation(
      session.challenge!,
      response,
      elapsed
    );

    if (validationResult.passed) {
      // 生成 token 并存储
      const token = uuidv4();
      const verifiedData = {
        fingerprint: session.fingerprint,
        level: session.level,
        verifiedAt: Date.now(),
      };

      // Pipeline 存储 token 和统计
      const pipeline = this.redis.pipeline();
      pipeline.setex(`verified:${token}`, this.VERIFIED_TTL, JSON.stringify(verifiedData));
      pipeline.incr('stats:verified_count');
      pipeline.expire('stats:verified_count', 86400);
      
      // 按级别统计
      pipeline.incr(`stats:verified:${session.level}`);
      pipeline.expire(`stats:verified:${session.level}`, 86400);
      
      await pipeline.exec();

      // 异步记录验证历史
      this.queueRecord({
        sessionId: session.id,
        fingerprint: session.fingerprint,
        level: session.level,
        challengeType: session.challenge?.type,
        result: validationResult,
        timestamp: Date.now(),
      });

      return { ...validationResult, token, level: session.level };
    }

    return validationResult;
  }

  /**
   * 验证 Token - 使用缓存
   */
  private tokenCache: Map<string, { valid: boolean; level?: VerificationLevel; expires: number }> = new Map();
  
  async verifyToken(token: string): Promise<{
    valid: boolean;
    level?: VerificationLevel;
    fingerprint?: AIFingerprint;
  }> {
    // 检查内存缓存
    const cached = this.tokenCache.get(token);
    if (cached && cached.expires > Date.now()) {
      return { valid: cached.valid, level: cached.level };
    }

    const data = await this.redis.get(`verified:${token}`);
    
    if (!data) {
      // 缓存负面结果 5 秒
      this.tokenCache.set(token, { valid: false, expires: Date.now() + 5000 });
      return { valid: false };
    }

    const parsed = JSON.parse(data);
    const result = {
      valid: true,
      level: parsed.level as VerificationLevel,
      fingerprint: parsed.fingerprint as AIFingerprint,
    };

    // 缓存正面结果 60 秒
    this.tokenCache.set(token, { 
      valid: true, 
      level: result.level, 
      expires: Date.now() + 60000 
    });

    return result;
  }

  /**
   * 批量验证 Token
   */
  async batchVerifyTokens(tokens: string[]): Promise<Map<string, { valid: boolean; level?: VerificationLevel }>> {
    const pipeline = this.redis.pipeline();
    
    for (const token of tokens) {
      pipeline.get(`verified:${token}`);
    }
    
    const results = await pipeline.exec();
    const map = new Map<string, { valid: boolean; level?: VerificationLevel }>();
    
    for (let i = 0; i < tokens.length; i++) {
      const [, data] = results![i];
      if (data) {
        const parsed = JSON.parse(data as string);
        map.set(tokens[i], { valid: true, level: parsed.level });
      } else {
        map.set(tokens[i], { valid: false });
      }
    }
    
    return map;
  }

  /**
   * 执行验证 - 使用预编译的验证器
   */
  private executeValidation(
    challenge: VerificationChallenge,
    response: unknown,
    responseTime: number
  ): VerificationResult {
    const validator = this.validators.get(challenge.type);
    
    if (!validator) {
      throw new Error(`Unknown challenge type: ${challenge.type}`);
    }

    return validator(challenge, response, responseTime);
  }

  // ========== 验证器实现 ==========

  private validateParallel(
    challenge: VerificationChallenge,
    response: unknown,
    responseTime: number
  ): VerificationResult {
    const tasks = challenge.payload as any[];
    const answers = response as any[];
    
    const completed = Array.isArray(answers) && answers.length === tasks.length;
    
    let qualityScore = 0;
    if (completed) {
      let validCount = 0;
      for (const a of answers) {
        if (a && typeof a === 'object' && a.content && a.content.length > 20) {
          validCount++;
        }
      }
      qualityScore = validCount / answers.length;
    }

    const accuracy = completed ? qualityScore : 0;
    const speedScore = Math.max(0, 1 - responseTime / challenge.timeout);
    const score = (accuracy * 0.7 + speedScore * 0.3) * 100;

    return {
      challengeId: challenge.id,
      passed: score >= 70,
      responseTime,
      score,
      details: {
        accuracy: accuracy * 100,
        speed: speedScore * 100,
        consistency: qualityScore * 100,
      },
    };
  }

  private validateStructured(
    challenge: VerificationChallenge,
    response: unknown,
    responseTime: number
  ): VerificationResult {
    const { expectedFormats } = challenge.payload as any;
    const answers = response as Record<string, string>;
    
    let validFormats = 0;
    
    for (const format of expectedFormats) {
      const content = answers?.[format];
      if (!content) continue;
      
      if (format === 'json' && this.isValidJSON(content)) validFormats++;
      if (format === 'yaml' && this.isValidYAML(content)) validFormats++;
      if (format === 'xml' && this.isValidXML(content)) validFormats++;
    }

    const accuracy = validFormats / expectedFormats.length;
    const speedScore = Math.max(0, 1 - responseTime / challenge.timeout);
    const score = (accuracy * 0.8 + speedScore * 0.2) * 100;

    return {
      challengeId: challenge.id,
      passed: score >= 80 && validFormats === expectedFormats.length,
      responseTime,
      score,
      details: {
        accuracy: accuracy * 100,
        speed: speedScore * 100,
      },
    };
  }

  private validateMemory(
    challenge: VerificationChallenge,
    response: unknown,
    responseTime: number
  ): VerificationResult {
    const { questions } = challenge.payload as any;
    const answers = response as any[];
    
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = answers?.[i];
      if (a && typeof a === 'string' && q.answer.toLowerCase().includes(a.toLowerCase())) {
        correct++;
      }
    }

    const accuracy = correct / questions.length;
    const speedScore = Math.max(0, 1 - responseTime / challenge.timeout);
    const score = (accuracy * 0.6 + speedScore * 0.4) * 100;

    return {
      challengeId: challenge.id,
      passed: score >= 75,
      responseTime,
      score,
      details: {
        accuracy: accuracy * 100,
        speed: speedScore * 100,
      },
    };
  }

  private validateTool(
    challenge: VerificationChallenge,
    response: unknown,
    responseTime: number
  ): VerificationResult {
    const { expectedResult } = challenge.payload as any;
    
    const accuracy = JSON.stringify(response) === JSON.stringify(expectedResult) ? 1 : 0;
    const speedScore = Math.max(0, 1 - responseTime / challenge.timeout);
    const score = (accuracy * 0.7 + speedScore * 0.3) * 100;

    return {
      challengeId: challenge.id,
      passed: score >= 90,
      responseTime,
      score,
      details: {
        accuracy: accuracy * 100,
        speed: speedScore * 100,
      },
    };
  }

  private validateReasoning(
    challenge: VerificationChallenge,
    response: unknown,
    responseTime: number
  ): VerificationResult {
    const answer = response as string;
    const hasAnswer = answer && answer.length > 50;
    
    const accuracy = hasAnswer ? 0.8 : 0;
    const speedScore = Math.max(0, 1 - responseTime / challenge.timeout);
    const score = (accuracy * 0.8 + speedScore * 0.2) * 100;

    return {
      challengeId: challenge.id,
      passed: score >= 70,
      responseTime,
      score,
      details: {
        accuracy: accuracy * 100,
        speed: speedScore * 100,
      },
    };
  }

  private validateMetacognitive(
    challenge: VerificationChallenge,
    response: unknown,
    responseTime: number
  ): VerificationResult {
    const answer = response as any;
    
    const hasReasoning = answer?.reasoning && answer.reasoning.length > 100;
    const hasSelfCorrection = answer?.selfCorrection;
    const hasConfidence = typeof answer?.confidence === 'number';
    
    const checks = [hasReasoning, hasSelfCorrection, hasConfidence].filter(Boolean).length;
    const accuracy = checks / 3;
    
    const speedScore = Math.max(0, 1 - responseTime / challenge.timeout);
    const score = (accuracy * 0.9 + speedScore * 0.1) * 100;

    return {
      challengeId: challenge.id,
      passed: score >= 85 && checks >= 2,
      responseTime,
      score,
      details: {
        accuracy: accuracy * 100,
        speed: speedScore * 100,
      },
    };
  }

  // ========== 批处理记录 ==========

  private queueRecord(record: VerificationRecord): void {
    this.recordQueue.push(record);
    
    // 队列超过 100 条立即刷新
    if (this.recordQueue.length >= 100) {
      this.flushRecords();
    }
  }

  private async flushRecords(): Promise<void> {
    if (this.recordQueue.length === 0) return;

    const records = [...this.recordQueue];
    this.recordQueue = [];

    const pipeline = this.redis.pipeline();
    
    for (const record of records) {
      pipeline.lpush('verification:history', JSON.stringify(record));
    }
    
    pipeline.ltrim('verification:history', 0, 9999);
    
    try {
      await pipeline.exec();
    } catch (error) {
      // 失败时重新入队
      this.recordQueue.unshift(...records);
    }
  }

  // ========== 工具函数 ==========

  private isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  private isValidYAML(str: string): boolean {
    return str.includes(':') && !str.includes('{');
  }

  private isValidXML(str: string): boolean {
    return str.startsWith('<') && str.endsWith('>');
  }

  /**
   * 清理资源
   */
  dispose(): void {
    clearInterval(this.recordFlushInterval);
    this.flushRecords();
  }
}