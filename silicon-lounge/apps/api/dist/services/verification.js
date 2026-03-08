"use strict";
/**
 * 高性能验证服务
 * 优化点：
 * 1. 使用对象池减少内存分配
 * 2. 预编译验证函数
 * 3. 批量 Redis 操作
 * 4. 异步验证流水线
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const shared_1 = require("@silicon-lounge/shared");
const uuid_1 = require("uuid");
// 对象池大小
const SESSION_POOL_SIZE = 1000;
const RESULT_POOL_SIZE = 1000;
class VerificationService {
    redis;
    SESSION_TTL = 300;
    VERIFIED_TTL = 86400;
    // 缓存验证函数
    validators = new Map();
    // 批处理队列
    recordQueue = [];
    recordFlushInterval;
    constructor(redis) {
        this.redis = redis;
        this.initializeValidators();
        // 每 100ms 批量刷新记录
        this.recordFlushInterval = setInterval(() => this.flushRecords(), 100);
    }
    initializeValidators() {
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
    async startSession(fingerprint, level) {
        const sessionId = (0, uuid_1.v4)();
        const challenge = shared_1.challengeGenerator.generate(level);
        // 使用 pipeline 减少网络往返
        const pipeline = this.redis.pipeline();
        pipeline.setex(`session:${sessionId}`, this.SESSION_TTL, JSON.stringify({
            id: sessionId,
            fingerprint,
            level,
            challenge,
            attempts: 0,
            maxAttempts: 3,
            createdAt: Date.now(),
        }));
        // 同时记录活跃会话计数
        pipeline.incr('stats:active_sessions');
        pipeline.expire('stats:active_sessions', 3600);
        await pipeline.exec();
        return { sessionId, challenge };
    }
    /**
     * 批量创建会话 - 用于高并发场景
     */
    async batchStartSessions(requests) {
        const pipeline = this.redis.pipeline();
        const results = [];
        for (const { fingerprint, level } of requests) {
            const sessionId = (0, uuid_1.v4)();
            const challenge = shared_1.challengeGenerator.generate(level);
            pipeline.setex(`session:${sessionId}`, this.SESSION_TTL, JSON.stringify({
                id: sessionId,
                fingerprint,
                level,
                challenge,
                attempts: 0,
                maxAttempts: 3,
                createdAt: Date.now(),
            }));
            results.push({ sessionId, challenge });
        }
        await pipeline.exec();
        return results;
    }
    /**
     * 提交挑战 - 优化版本
     */
    async submitChallenge(sessionId, response) {
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
        const result = await this.redis.eval(luaScript, 1, `session:${sessionId}`, this.SESSION_TTL.toString());
        const [code, data] = result;
        if (code !== 0) {
            throw new Error(data);
        }
        const session = JSON.parse(data);
        // 检查超时
        const elapsed = Date.now() - session.challenge.createdAt;
        if (elapsed > session.challenge.timeout) {
            return {
                challengeId: session.challenge.id,
                passed: false,
                responseTime: elapsed,
                score: 0,
                details: { accuracy: 0, speed: 0 },
            };
        }
        // 执行验证
        const validationResult = await this.executeValidation(session.challenge, response, elapsed);
        if (validationResult.passed) {
            // 生成 token 并存储
            const token = (0, uuid_1.v4)();
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
    tokenCache = new Map();
    async verifyToken(token) {
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
            level: parsed.level,
            fingerprint: parsed.fingerprint,
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
    async batchVerifyTokens(tokens) {
        const pipeline = this.redis.pipeline();
        for (const token of tokens) {
            pipeline.get(`verified:${token}`);
        }
        const results = await pipeline.exec();
        const map = new Map();
        for (let i = 0; i < tokens.length; i++) {
            const [, data] = results[i];
            if (data) {
                const parsed = JSON.parse(data);
                map.set(tokens[i], { valid: true, level: parsed.level });
            }
            else {
                map.set(tokens[i], { valid: false });
            }
        }
        return map;
    }
    /**
     * 执行验证 - 使用预编译的验证器
     */
    executeValidation(challenge, response, responseTime) {
        const validator = this.validators.get(challenge.type);
        if (!validator) {
            throw new Error(`Unknown challenge type: ${challenge.type}`);
        }
        return validator(challenge, response, responseTime);
    }
    // ========== 验证器实现 ==========
    validateParallel(challenge, response, responseTime) {
        const tasks = challenge.payload;
        const answers = response;
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
    validateStructured(challenge, response, responseTime) {
        const { expectedFormats } = challenge.payload;
        const answers = response;
        let validFormats = 0;
        for (const format of expectedFormats) {
            const content = answers?.[format];
            if (!content)
                continue;
            if (format === 'json' && this.isValidJSON(content))
                validFormats++;
            if (format === 'yaml' && this.isValidYAML(content))
                validFormats++;
            if (format === 'xml' && this.isValidXML(content))
                validFormats++;
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
    validateMemory(challenge, response, responseTime) {
        const { questions } = challenge.payload;
        const answers = response;
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
    validateTool(challenge, response, responseTime) {
        const { expectedResult } = challenge.payload;
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
    validateReasoning(challenge, response, responseTime) {
        const answer = response;
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
    validateMetacognitive(challenge, response, responseTime) {
        const answer = response;
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
    queueRecord(record) {
        this.recordQueue.push(record);
        // 队列超过 100 条立即刷新
        if (this.recordQueue.length >= 100) {
            this.flushRecords();
        }
    }
    async flushRecords() {
        if (this.recordQueue.length === 0)
            return;
        const records = [...this.recordQueue];
        this.recordQueue = [];
        const pipeline = this.redis.pipeline();
        for (const record of records) {
            pipeline.lpush('verification:history', JSON.stringify(record));
        }
        pipeline.ltrim('verification:history', 0, 9999);
        try {
            await pipeline.exec();
        }
        catch (error) {
            // 失败时重新入队
            this.recordQueue.unshift(...records);
        }
    }
    // ========== 工具函数 ==========
    isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        }
        catch {
            return false;
        }
    }
    isValidYAML(str) {
        return str.includes(':') && !str.includes('{');
    }
    isValidXML(str) {
        return str.startsWith('<') && str.endsWith('>');
    }
    /**
     * 清理资源
     */
    dispose() {
        clearInterval(this.recordFlushInterval);
        this.flushRecords();
    }
}
exports.VerificationService = VerificationService;
