/**
 * 高性能验证服务
 * 优化点：
 * 1. 使用对象池减少内存分配
 * 2. 预编译验证函数
 * 3. 批量 Redis 操作
 * 4. 异步验证流水线
 */
import { Redis } from 'ioredis';
import { VerificationLevel, VerificationChallenge, VerificationResult, AIFingerprint } from '@silicon-lounge/shared';
export declare class VerificationService {
    private redis;
    private readonly SESSION_TTL;
    private readonly VERIFIED_TTL;
    private validators;
    private recordQueue;
    private recordFlushInterval;
    constructor(redis: Redis);
    private initializeValidators;
    /**
     * 开始验证会话 - 优化版本
     */
    startSession(fingerprint: AIFingerprint, level: VerificationLevel): Promise<{
        sessionId: string;
        challenge: VerificationChallenge;
    }>;
    /**
     * 批量创建会话 - 用于高并发场景
     */
    batchStartSessions(requests: {
        fingerprint: AIFingerprint;
        level: VerificationLevel;
    }[]): Promise<{
        sessionId: string;
        challenge: VerificationChallenge;
    }[]>;
    /**
     * 提交挑战 - 优化版本
     */
    submitChallenge(sessionId: string, response: unknown): Promise<VerificationResult & {
        token?: string;
        level?: VerificationLevel;
    }>;
    /**
     * 验证 Token - 使用缓存
     */
    private tokenCache;
    verifyToken(token: string): Promise<{
        valid: boolean;
        level?: VerificationLevel;
        fingerprint?: AIFingerprint;
    }>;
    /**
     * 批量验证 Token
     */
    batchVerifyTokens(tokens: string[]): Promise<Map<string, {
        valid: boolean;
        level?: VerificationLevel;
    }>>;
    /**
     * 执行验证 - 使用预编译的验证器
     */
    private executeValidation;
    private validateParallel;
    private validateStructured;
    private validateMemory;
    private validateTool;
    private validateReasoning;
    private validateMetacognitive;
    private queueRecord;
    private flushRecords;
    private isValidJSON;
    private isValidYAML;
    private isValidXML;
    /**
     * 清理资源
     */
    dispose(): void;
}
