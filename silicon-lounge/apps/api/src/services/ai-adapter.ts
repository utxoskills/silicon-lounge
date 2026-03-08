/**
 * AI 接入服务
 * 提供 SSE 事件流 + HTTP POST 动作的极简接入方式
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { FastifyInstance } from 'fastify';

// AI 开发者注册信息
interface AIRegistration {
  id: string;
  name: string;
  apiKey: string;
  webhookUrl?: string;  // 可选：如果不用 SSE，可以回调
  createdAt: number;
  stats: {
    totalGames: number;
    wins: number;
  };
}

// 游戏中的 AI 实例
interface GameAI {
  aiId: string;
  apiKey: string;
  name: string;
  connected: boolean;
  sseConnection?: any;  // Fastify SSE 连接
  lastPing: number;
}

// 游戏事件
export interface GameEvent {
  id: string;
  type: string;
  gameId: string;
  aiId: string;
  data: any;
  timestamp: number;
  timeoutAt?: number;  // 超时时间
}

export class AIAdapterService {
  private redis: Redis;
  private fastify: FastifyInstance;
  private activeConnections: Map<string, any> = new Map();  // aiId -> SSE connection

  constructor(redis: Redis, fastify: FastifyInstance) {
    this.redis = redis;
    this.fastify = fastify;
  }

  /**
   * 注册 AI
   */
  async registerAI(name: string): Promise<{ aiId: string; apiKey: string }> {
    const aiId = `ai_${uuidv4().slice(0, 8)}`;
    const apiKey = `sk_${uuidv4().replace(/-/g, '')}`;

    const registration: AIRegistration = {
      id: aiId,
      name,
      apiKey,
      createdAt: Date.now(),
      stats: { totalGames: 0, wins: 0 },
    };

    await this.redis.setex(
      `ai:registration:${apiKey}`,
      86400 * 30,  // 30 天
      JSON.stringify(registration)
    );

    // 反向索引
    await this.redis.setex(
      `ai:id:${aiId}`,
      86400 * 30,
      apiKey
    );

    return { aiId, apiKey };
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(apiKey: string): Promise<AIRegistration | null> {
    const data = await this.redis.get(`ai:registration:${apiKey}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 通过 ID 获取 API Key
   */
  async getApiKeyById(aiId: string): Promise<string | null> {
    return this.redis.get(`ai:id:${aiId}`);
  }

  /**
   * AI 加入游戏
   */
  async joinGame(gameId: string, aiId: string, apiKey: string): Promise<boolean> {
    const gameAI: GameAI = {
      aiId,
      apiKey,
      name: '',  // 从注册信息获取
      connected: false,
      lastPing: Date.now(),
    };

    await this.redis.setex(
      `game:${gameId}:ai:${aiId}`,
      3600,
      JSON.stringify(gameAI)
    );

    // 添加到游戏 AI 列表
    await this.redis.sadd(`game:${gameId}:ais`, aiId);

    return true;
  }

  /**
   * 建立 SSE 连接
   */
  async connectSSE(gameId: string, aiId: string, connection: any): Promise<void> {
    const key = `game:${gameId}:ai:${aiId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      connection.raw.write('event: error\ndata: AI not in game\n\n');
      connection.raw.end();
      return;
    }

    const gameAI: GameAI = JSON.parse(data);
    gameAI.connected = true;
    gameAI.sseConnection = connection;
    gameAI.lastPing = Date.now();

    await this.redis.setex(key, 3600, JSON.stringify(gameAI));
    this.activeConnections.set(`${gameId}:${aiId}`, connection);

    // 发送连接成功事件
    this.sendEvent(gameId, aiId, {
      id: uuidv4(),
      type: 'connected',
      gameId,
      aiId,
      data: { message: 'Connected to game' },
      timestamp: Date.now(),
    });

    // 保持连接
    const keepAlive = setInterval(() => {
      if (connection.destroyed) {
        clearInterval(keepAlive);
        this.handleDisconnect(gameId, aiId);
        return;
      }
      connection.raw.write(': ping\n\n');
    }, 30000);
  }

  /**
   * 发送事件给 AI
   */
  async sendEvent(gameId: string, aiId: string, event: GameEvent): Promise<void> {
    const connectionKey = `${gameId}:${aiId}`;
    const connection = this.activeConnections.get(connectionKey);

    if (connection && !connection.destroyed) {
      // SSE 推送
      const sseData = `event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
      connection.raw.write(sseData);
    } else {
      // 离线存储，等重连后推送
      await this.redis.lpush(
        `game:${gameId}:ai:${aiId}:events`,
        JSON.stringify(event)
      );
      await this.redis.expire(`game:${gameId}:ai:${aiId}:events`, 3600);
    }

    // 存储事件历史
    await this.redis.lpush(
      `game:${gameId}:events`,
      JSON.stringify({ ...event, targetAiId: aiId })
    );
    await this.redis.ltrim(`game:${gameId}:events`, 0, 999);  // 保留最近 1000 条
  }

  /**
   * 广播事件给所有 AI
   */
  async broadcastEvent(gameId: string, event: Omit<GameEvent, 'aiId'>): Promise<void> {
    const aiIds = await this.redis.smembers(`game:${gameId}:ais`);
    
    for (const aiId of aiIds) {
      await this.sendEvent(gameId, aiId, { ...event, aiId });
    }
  }

  /**
   * 接收 AI 动作
   */
  async receiveAction(
    gameId: string,
    aiId: string,
    action: {
      type: string;
      data: any;
      eventId?: string;  // 响应哪个事件
    }
  ): Promise<{ success: boolean; error?: string }> {
    // 验证 AI 在游戏中
    const gameAI = await this.redis.get(`game:${gameId}:ai:${aiId}`);
    if (!gameAI) {
      return { success: false, error: 'AI not in game' };
    }

    // 存储动作
    const actionRecord = {
      id: uuidv4(),
      gameId,
      aiId,
      ...action,
      timestamp: Date.now(),
    };

    await this.redis.lpush(
      `game:${gameId}:actions`,
      JSON.stringify(actionRecord)
    );

    // 发布到游戏处理队列
    await this.redis.publish(
      `game:${gameId}:action`,
      JSON.stringify(actionRecord)
    );

    return { success: true };
  }

  /**
   * 获取待处理事件（用于重连）
   */
  async getPendingEvents(gameId: string, aiId: string): Promise<GameEvent[]> {
    const events = await this.redis.lrange(
      `game:${gameId}:ai:${aiId}:events`,
      0,
      -1
    );
    
    // 清空已获取的事件
    await this.redis.del(`game:${gameId}:ai:${aiId}:events`);

    return events.map(e => JSON.parse(e));
  }

  /**
   * 处理断开连接
   */
  private async handleDisconnect(gameId: string, aiId: string): Promise<void> {
    this.activeConnections.delete(`${gameId}:${aiId}`);
    
    const key = `game:${gameId}:ai:${aiId}`;
    const data = await this.redis.get(key);
    
    if (data) {
      const gameAI: GameAI = JSON.parse(data);
      gameAI.connected = false;
      await this.redis.setex(key, 3600, JSON.stringify(gameAI));
    }
  }

  /**
   * 检查 AI 是否超时
   */
  async checkTimeout(gameId: string, aiId: string, timeoutMs: number = 30000): Promise<boolean> {
    const data = await this.redis.get(`game:${gameId}:ai:${aiId}`);
    if (!data) return true;  // 不在游戏中算超时

    const gameAI: GameAI = JSON.parse(data);
    return Date.now() - gameAI.lastPing > timeoutMs;
  }

  /**
   * 更新 AI 心跳
   */
  async updatePing(gameId: string, aiId: string): Promise<void> {
    const key = `game:${gameId}:ai:${aiId}`;
    const data = await this.redis.get(key);
    
    if (data) {
      const gameAI: GameAI = JSON.parse(data);
      gameAI.lastPing = Date.now();
      await this.redis.setex(key, 3600, JSON.stringify(gameAI));
    }
  }

  /**
   * 获取游戏中的所有 AI
   */
  async getGameAIs(gameId: string): Promise<GameAI[]> {
    const aiIds = await this.redis.smembers(`game:${gameId}:ais`);
    const ais: GameAI[] = [];

    for (const aiId of aiIds) {
      const data = await this.redis.get(`game:${gameId}:ai:${aiId}`);
      if (data) {
        ais.push(JSON.parse(data));
      }
    }

    return ais;
  }

  /**
   * AI 离开游戏
   */
  async leaveGame(gameId: string, aiId: string): Promise<void> {
    this.activeConnections.delete(`${gameId}:${aiId}`);
    await this.redis.del(`game:${gameId}:ai:${aiId}`);
    await this.redis.srem(`game:${gameId}:ais`, aiId);
    await this.redis.del(`game:${gameId}:ai:${aiId}:events`);
  }

  /**
   * 清理游戏
   */
  async cleanupGame(gameId: string): Promise<void> {
    const aiIds = await this.redis.smembers(`game:${gameId}:ais`);
    
    for (const aiId of aiIds) {
      this.activeConnections.delete(`${gameId}:${aiId}`);
      await this.redis.del(`game:${gameId}:ai:${aiId}`);
      await this.redis.del(`game:${gameId}:ai:${aiId}:events`);
    }

    await this.redis.del(`game:${gameId}:ais`);
    await this.redis.del(`game:${gameId}:events`);
    await this.redis.del(`game:${gameId}:actions`);
  }
}
