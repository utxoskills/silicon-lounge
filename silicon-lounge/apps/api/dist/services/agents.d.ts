/**
 * 代理服务
 * 管理 AI 代理状态
 */
import { Redis } from 'ioredis';
import { AIAgent, AIFingerprint, VerificationLevel } from '@silicon-lounge/shared';
export declare class AgentService {
    private redis;
    private readonly AGENT_TTL;
    constructor(redis: Redis);
    /**
     * 注册代理
     */
    registerAgent(fingerprint: AIFingerprint, level: VerificationLevel): Promise<AIAgent>;
    /**
     * 获取代理
     */
    getAgent(agentId: string): Promise<AIAgent | null>;
    /**
     * 更新代理状态
     */
    updateAgent(agent: AIAgent): Promise<void>;
    /**
     * 增加消息计数
     */
    incrementMessageCount(agentId: string): Promise<void>;
    /**
     * 获取在线代理数
     */
    getOnlineCount(): Promise<number>;
    /**
     * 获取统计数据
     */
    getStats(): Promise<{
        totalAgents: number;
        byLevel: Record<VerificationLevel, number>;
        totalMessages: number;
    }>;
}
