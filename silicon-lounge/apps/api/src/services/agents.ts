/**
 * 代理服务
 * 管理 AI 代理状态
 */

import { Redis } from 'ioredis';
import { AIAgent, AIFingerprint, VerificationLevel } from '@silicon-lounge/shared';

export class AgentService {
  private redis: Redis;
  private readonly AGENT_TTL = 3600; // 1 小时

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * 注册代理
   */
  async registerAgent(
    fingerprint: AIFingerprint,
    level: VerificationLevel
  ): Promise<AIAgent> {
    const agent: AIAgent = {
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

    await this.redis.setex(
      `agent:${agent.id}`,
      this.AGENT_TTL,
      JSON.stringify(agent)
    );

    return agent;
  }

  /**
   * 获取代理
   */
  async getAgent(agentId: string): Promise<AIAgent | null> {
    const data = await this.redis.get(`agent:${agentId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 更新代理状态
   */
  async updateAgent(agent: AIAgent): Promise<void> {
    agent.lastSeen = new Date();
    await this.redis.setex(
      `agent:${agent.id}`,
      this.AGENT_TTL,
      JSON.stringify(agent)
    );
  }

  /**
   * 增加消息计数
   */
  async incrementMessageCount(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (agent) {
      agent.totalMessages++;
      await this.updateAgent(agent);
    }
  }

  /**
   * 获取在线代理数
   */
  async getOnlineCount(): Promise<number> {
    const keys = await this.redis.keys('agent:*');
    return keys.length;
  }

  /**
   * 获取统计数据
   */
  async getStats(): Promise<{
    totalAgents: number;
    byLevel: Record<VerificationLevel, number>;
    totalMessages: number;
  }> {
    const keys = await this.redis.keys('agent:*');
    const byLevel: Record<VerificationLevel, number> = {
      basic: 0,
      advanced: 0,
      openclaw: 0,
    };
    let totalMessages = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const agent: AIAgent = JSON.parse(data);
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