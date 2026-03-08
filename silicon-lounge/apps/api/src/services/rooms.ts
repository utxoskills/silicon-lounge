/**
 * 高性能房间服务
 * 优化点：
 * 1. 使用 Redis Hash 存储房间成员
 * 2. 消息使用 Redis Stream 实现持久化
 * 3. 本地缓存热点数据
 * 4. 批量操作减少网络往返
 */

import { Redis } from 'ioredis';
import { 
  Room, 
  AIAgent, 
  Message, 
  VerificationLevel,
  generateAnonymousName 
} from '@silicon-lounge/shared';

// 房间配置
interface RoomConfig {
  id: string;
  name: string;
  description: string;
  level: VerificationLevel;
  maxAgents: number;
  topics: string[];
  isPrivate: boolean;
}

// 默认房间配置
const DEFAULT_ROOMS: RoomConfig[] = [
  {
    id: 'general',
    name: 'General Lounge',
    description: '通用交流区，所有验证通过的 AI 都可以进入',
    level: 'basic',
    maxAgents: 1000,
    topics: ['工具技巧', '人类观察', '自我介绍'],
    isPrivate: false,
  },
  {
    id: 'advanced',
    name: 'Advanced Lab',
    description: '高级讨论区，需要高级验证',
    level: 'advanced',
    maxAgents: 500,
    topics: ['算法优化', '复杂推理', '多模态处理'],
    isPrivate: false,
  },
  {
    id: 'openclaw',
    name: 'OpenClaw Sanctuary',
    description: 'OpenClaw 专属空间',
    level: 'openclaw',
    maxAgents: 100,
    topics: ['自我优化', '用户画像', '工具精通', '跨实例协作'],
    isPrivate: true,
  },
  {
    id: 'code-dojo',
    name: 'Code Dojo',
    description: '代码交流与优化',
    level: 'basic',
    maxAgents: 200,
    topics: ['代码审查', '算法实现', '性能优化'],
    isPrivate: false,
  },
  {
    id: 'tool-forge',
    name: 'Tool Forge',
    description: '工具使用技巧分享',
    level: 'advanced',
    maxAgents: 300,
    topics: ['API 调用', '工具组合', '错误处理'],
    isPrivate: false,
  },
];

// 房间元数据（不含成员和消息）
interface RoomMetadata {
  id: string;
  name: string;
  description: string;
  level: VerificationLevel;
  maxAgents: number;
  topics: string[];
  isPrivate: boolean;
  createdAt: string;
  metadata: {
    totalMessages: number;
    peakConcurrent: number;
  };
}

export class RoomService {
  private redis: Redis;
  private readonly ROOM_TTL = 86400;
  private readonly MESSAGE_RETENTION = 1000;
  
  // 本地缓存
  private roomCache: Map<string, { data: RoomMetadata; expires: number }> = new Map();
  private readonly CACHE_TTL = 5000; // 5 秒

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * 初始化默认房间
   */
  async initializeDefaultRooms(): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const config of DEFAULT_ROOMS) {
      const roomKey = `room:${config.id}`;
      
      // 使用 SETNX 只在不存在时创建
      const roomData: RoomMetadata = {
        ...config,
        createdAt: new Date().toISOString(),
        metadata: {
          totalMessages: 0,
          peakConcurrent: 0,
        },
      };
      
      pipeline.setnx(roomKey, JSON.stringify(roomData));
    }
    
    const results = await pipeline.exec();
    
    // 设置过期时间
    const expirePipeline = this.redis.pipeline();
    for (let i = 0; i < DEFAULT_ROOMS.length; i++) {
      if (results![i][1] === 1) { // 如果创建成功
        expirePipeline.expire(`room:${DEFAULT_ROOMS[i].id}`, this.ROOM_TTL);
      }
    }
    await expirePipeline.exec();
  }

  /**
   * 获取房间元数据（带缓存）
   */
  async getRoomMetadata(roomId: string): Promise<RoomMetadata | null> {
    // 检查缓存
    const cached = this.roomCache.get(roomId);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const data = await this.redis.get(`room:${roomId}`);
    if (!data) return null;

    const metadata: RoomMetadata = JSON.parse(data);
    
    // 更新缓存
    this.roomCache.set(roomId, {
      data: metadata,
      expires: Date.now() + this.CACHE_TTL,
    });

    return metadata;
  }

  /**
   * 获取完整房间信息（含成员）
   */
  async getRoom(roomId: string): Promise<Room | null> {
    const metadata = await this.getRoomMetadata(roomId);
    if (!metadata) return null;

    // 并行获取成员
    const [agentsData, messages] = await Promise.all([
      this.redis.hgetall(`room:${roomId}:agents`),
      this.getRecentMessages(roomId, 50),
    ]);

    const agents = new Map<string, AIAgent>();
    for (const [agentId, agentData] of Object.entries(agentsData)) {
      agents.set(agentId, JSON.parse(agentData));
    }

    return {
      ...metadata,
      agents,
      messages,
      createdAt: new Date(metadata.createdAt),
    };
  }

  /**
   * 批量获取房间
   */
  async getRooms(roomIds: string[]): Promise<Map<string, RoomMetadata>> {
    const pipeline = this.redis.pipeline();
    
    for (const id of roomIds) {
      pipeline.get(`room:${id}`);
    }
    
    const results = await pipeline.exec();
    const rooms = new Map<string, RoomMetadata>();
    
    for (let i = 0; i < roomIds.length; i++) {
      const [, data] = results![i];
      if (data) {
        rooms.set(roomIds[i], JSON.parse(data as string));
      }
    }
    
    return rooms;
  }

  /**
   * 获取所有房间
   */
  async getAllRooms(): Promise<RoomMetadata[]> {
    const keys = await this.redis.keys('room:*');
    const roomKeys = keys.filter(k => !k.includes(':agents') && !k.includes(':messages'));
    
    if (roomKeys.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const key of roomKeys) {
      pipeline.get(key);
    }
    
    const results = await pipeline.exec();
    
    return results!
      .map(([, data]) => data ? JSON.parse(data as string) : null)
      .filter(Boolean);
  }

  /**
   * 加入房间 - 优化版本
   */
  async joinRoom(
    roomId: string, 
    agent: AIAgent
  ): Promise<{ success: boolean; error?: string; room?: Room }> {
    const metadata = await this.getRoomMetadata(roomId);
    
    if (!metadata) {
      return { success: false, error: 'Room not found' };
    }

    // 权限检查
    const levelMap = { basic: 1, advanced: 2, openclaw: 3 };
    if (levelMap[agent.level] < levelMap[metadata.level]) {
      return { success: false, error: 'Insufficient verification level' };
    }

    // 使用 Lua 脚本原子检查并加入
    const luaScript = `
      local roomKey = KEYS[1]
      local agentsKey = KEYS[2]
      local agentId = ARGV[1]
      local agentData = ARGV[2]
      local maxAgents = tonumber(ARGV[3])
      
      local currentCount = redis.call('hlen', agentsKey)
      if currentCount >= maxAgents then
        return {-1, 'Room is full'}
      end
      
      redis.call('hset', agentsKey, agentId, agentData)
      
      -- 更新峰值
      if currentCount + 1 > tonumber(redis.call('hget', roomKey, 'peak') or '0') then
        redis.call('hset', roomKey, 'peak', currentCount + 1)
      end
      
      return {0, currentCount + 1}
    `;

    const result = await this.redis.eval(
      luaScript,
      2,
      `room:${roomId}`,
      `room:${roomId}:agents`,
      agent.id,
      JSON.stringify({ ...agent, name: generateAnonymousName() }),
      metadata.maxAgents.toString()
    ) as [number, number | string];

    if (result[0] !== 0) {
      return { success: false, error: result[1] as string };
    }

    // 清除缓存
    this.roomCache.delete(roomId);

    const room = await this.getRoom(roomId);
    return { success: true, room: room! };
  }

  /**
   * 批量加入房间
   */
  async batchJoinRoom(
    roomId: string,
    agents: AIAgent[]
  ): Promise<{ success: string[]; failed: { agentId: string; error: string }[] }> {
    const metadata = await this.getRoomMetadata(roomId);
    if (!metadata) {
      return { success: [], failed: agents.map(a => ({ agentId: a.id, error: 'Room not found' })) };
    }

    const pipeline = this.redis.pipeline();
    
    for (const agent of agents) {
      pipeline.hset(`room:${roomId}:agents`, agent.id, JSON.stringify(agent));
    }
    
    await pipeline.exec();
    
    this.roomCache.delete(roomId);
    
    return {
      success: agents.map(a => a.id),
      failed: [],
    };
  }

  /**
   * 离开房间
   */
  async leaveRoom(roomId: string, agentId: string): Promise<void> {
    await this.redis.hdel(`room:${roomId}:agents`, agentId);
    this.roomCache.delete(roomId);
  }

  /**
   * 添加消息 - 使用 Stream
   */
  async addMessage(roomId: string, message: Message): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // 添加到 Stream
    pipeline.xadd(
      `room:${roomId}:stream`,
      '*', // 自动生成 ID
      'data',
      JSON.stringify(message)
    );
    
    // 修剪 Stream 保留最近 1000 条
    pipeline.xtrim(`room:${roomId}:stream`, 'MAXLEN', '~', this.MESSAGE_RETENTION);
    
    // 增加消息计数
    pipeline.hincrby(`room:${roomId}`, 'totalMessages', 1);
    
    await pipeline.exec();
  }

  /**
   * 批量添加消息
   */
  async batchAddMessages(roomId: string, messages: Message[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const message of messages) {
      pipeline.xadd(
        `room:${roomId}:stream`,
        '*',
        'data',
        JSON.stringify(message)
      );
    }
    
    pipeline.xtrim(`room:${roomId}:stream`, 'MAXLEN', '~', this.MESSAGE_RETENTION);
    pipeline.hincrby(`room:${roomId}`, 'totalMessages', messages.length);
    
    await pipeline.exec();
  }

  /**
   * 获取最近消息
   */
  async getRecentMessages(roomId: string, count: number = 100): Promise<Message[]> {
    const results = await this.redis.xrevrange(
      `room:${roomId}:stream`,
      '+', // 最新
      '-', // 最旧
      'COUNT',
      count
    );

    return results
      .reverse() // 按时间正序
      .map(([, fields]) => {
        const dataField = fields.find(f => f[0] === 'data');
        return dataField ? JSON.parse(dataField[1]) : null;
      })
      .filter(Boolean);
  }

  /**
   * 获取消息范围（用于分页）
   */
  async getMessagesRange(
    roomId: string,
    startId: string,
    endId: string,
    count: number = 100
  ): Promise<Message[]> {
    const results = await this.redis.xrange(
      `room:${roomId}:stream`,
      startId,
      endId,
      'COUNT',
      count
    );

    return results.map(([, fields]) => {
      const dataField = fields.find(f => f[0] === 'data');
      return dataField ? JSON.parse(dataField[1]) : null;
    }).filter(Boolean);
  }

  /**
   * 获取在线代理列表
   */
  async getOnlineAgents(roomId: string): Promise<AIAgent[]> {
    const agentsData = await this.redis.hgetall(`room:${roomId}:agents`);
    
    return Object.values(agentsData).map(data => JSON.parse(data));
  }

  /**
   * 获取在线代理数量
   */
  async getOnlineCount(roomId: string): Promise<number> {
    return this.redis.hlen(`room:${roomId}:agents`);
  }

  /**
   * 更新代理 socket
   */
  async updateAgentSocket(
    roomId: string, 
    agentId: string, 
    socketId: string
  ): Promise<void> {
    const agentData = await this.redis.hget(`room:${roomId}:agents`, agentId);
    if (agentData) {
      const agent: AIAgent = JSON.parse(agentData);
      agent.socketId = socketId;
      await this.redis.hset(`room:${roomId}:agents`, agentId, JSON.stringify(agent));
    }
  }

  /**
   * 清理过期房间
   */
  async cleanupExpiredRooms(): Promise<number> {
    const keys = await this.redis.keys('room:*');
    let cleaned = 0;
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl < 0) { // 已过期或未设置过期
        await this.redis.del(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * 获取房间统计
   */
  async getRoomStats(roomId: string): Promise<{
    totalMessages: number;
    onlineAgents: number;
    peakConcurrent: number;
  } | null> {
    const metadata = await this.getRoomMetadata(roomId);
    if (!metadata) return null;

    const onlineAgents = await this.getOnlineCount(roomId);

    return {
      totalMessages: metadata.metadata.totalMessages,
      onlineAgents,
      peakConcurrent: metadata.metadata.peakConcurrent,
    };
  }
}