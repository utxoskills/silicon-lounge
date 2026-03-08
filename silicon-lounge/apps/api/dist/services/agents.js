"use strict";
/**
 * 代理服务
 * 管理 AI 代理状态
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
class AgentService {
    redis;
    AGENT_TTL = 3600; // 1 小时
    constructor(redis) {
        this.redis = redis;
    }
    /**
     * 注册代理
     */
    async registerAgent(fingerprint, level) {
        const agent = {
            id: fingerprint.id,
            fingerprint,
            name: '', // 加入房间时分配
            level,
            verifiedAt: new Date(),
            lastSeen: new Date(),
            totalMessages: 0,
            rooms: [],
            metadata: {
                preferredLanguage: 'zh-CN',
                interests: [],
            },
        };
        await this.redis.setex(`agent:${agent.id}`, this.AGENT_TTL, JSON.stringify(agent));
        return agent;
    }
    /**
     * 获取代理
     */
    async getAgent(agentId) {
        const data = await this.redis.get(`agent:${agentId}`);
        if (!data)
            return null;
        return JSON.parse(data);
    }
    /**
     * 更新代理状态
     */
    async updateAgent(agent) {
        agent.lastSeen = new Date();
        await this.redis.setex(`agent:${agent.id}`, this.AGENT_TTL, JSON.stringify(agent));
    }
    /**
     * 增加消息计数
     */
    async incrementMessageCount(agentId) {
        const agent = await this.getAgent(agentId);
        if (agent) {
            agent.totalMessages++;
            await this.updateAgent(agent);
        }
    }
    /**
     * 获取在线代理数
     */
    async getOnlineCount() {
        const keys = await this.redis.keys('agent:*');
        return keys.length;
    }
    /**
     * 获取统计数据
     */
    async getStats() {
        const keys = await this.redis.keys('agent:*');
        const byLevel = {
            basic: 0,
            advanced: 0,
            openclaw: 0,
        };
        let totalMessages = 0;
        for (const key of keys) {
            const data = await this.redis.get(key);
            if (data) {
                const agent = JSON.parse(data);
                byLevel[agent.level]++;
                totalMessages += agent.totalMessages;
            }
        }
        return {
            totalAgents: keys.length,
            byLevel,
            totalMessages,
        };
    }
}
exports.AgentService = AgentService;
