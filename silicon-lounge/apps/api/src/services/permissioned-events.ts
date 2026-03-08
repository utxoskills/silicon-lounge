/**
 * 带权限控制的 SSE 事件系统
 * 根据用户角色发送不同的事件
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { FastifyInstance } from 'fastify';
import { RoomManager } from './room-manager';

// 事件可见性
type EventVisibility = 'all' | 'players' | 'referees' | 'admin' | 'self';

// 游戏事件
interface GameEvent {
  id: string;
  type: string;
  gameId: string;
  roomId: string;
  senderId?: string;
  visibility: EventVisibility;
  data: any;
  timestamp: number;
  timeoutAt?: number;  // 操作截止时间
  canRespond?: boolean;  // 接收者是否可以响应
}

// SSE 连接信息
interface SSEConnection {
  aiId: string;
  roomId: string;
  role: string;
  connection: any;
  connectedAt: number;
}

export class PermissionedEventSystem {
  private redis: Redis;
  private fastify: FastifyInstance;
  private roomManager: RoomManager;
  private connections: Map<string, SSEConnection> = new Map();  // key: roomId:aiId

  constructor(redis: Redis, fastify: FastifyInstance, roomManager: RoomManager) {
    this.redis = redis;
    this.fastify = fastify;
    this.roomManager = roomManager;
  }

  /**
   * 建立 SSE 连接（带权限验证）
   */
  async connect(
    roomId: string,
    aiId: string,
    connection: any
  ): Promise<{ success: boolean; error?: string }> {
    // 验证成员身份
    const member = await this.roomManager.getMember(roomId, aiId);
    if (!member) {
      return { success: false, error: 'Not in room' };
    }

    // 更新在线状态
    await this.roomManager.updatePing(roomId, aiId);

    // 存储连接
    const connKey = `${roomId}:${aiId}`;
    this.connections.set(connKey, {
      aiId,
      roomId,
      role: member.role,
      connection,
      connectedAt: Date.now(),
    });

    // 发送连接成功事件
    this.sendToUser(roomId, aiId, {
      id: uuidv4(),
      type: 'connected',
      gameId: '',
      roomId,
      visibility: 'self',
      data: {
        role: member.role,
        message: 'Connected to event stream',
      },
      timestamp: Date.now(),
    });

    // 保持连接心跳
    const keepAlive = setInterval(() => {
      if (connection.destroyed) {
        clearInterval(keepAlive);
        this.handleDisconnect(roomId, aiId);
        return;
      }
      connection.raw.write(': ping\n\n');
    }, 30000);

    return { success: true };
  }

  /**
   * 发送事件（带权限过滤）
   */
  async broadcastEvent(roomId: string, event: Omit<GameEvent, 'roomId'>): Promise<void> {
    const members = await this.roomManager.getMembers(roomId);
    
    for (const member of members) {
      // 检查事件对该成员是否可见
      if (!this.canSeeEvent(member.role, event.visibility)) {
        continue;
      }

      // 个性化事件数据
      const personalizedEvent = this.personalizeEvent(event, member.aiId);
      
      await this.sendToUser(roomId, member.aiId, {
        ...personalizedEvent,
        roomId,
      });
    }
  }

  /**
   * 发送给特定用户
   */
  async sendToUser(roomId: string, aiId: string, event: GameEvent): Promise<void> {
    const connKey = `${roomId}:${aiId}`;
    const conn = this.connections.get(connKey);

    if (conn && !conn.connection.destroyed) {
      // 在线，直接发送
      const sseData = this.formatSSE(event);
      conn.connection.raw.write(sseData);
    } else {
      // 离线，存储到待处理队列
      await this.redis.lpush(
        `events:pending:${roomId}:${aiId}`,
        JSON.stringify(event)
      );
      await this.redis.expire(`events:pending:${roomId}:${aiId}`, 3600);
    }
  }

  /**
   * 发送给特定角色
   */
  async sendToRole(
    roomId: string,
    roles: string[],
    event: Omit<GameEvent, 'roomId'>
  ): Promise<void> {
    const members = await this.roomManager.getMembers(roomId);
    
    for (const member of members) {
      if (roles.includes(member.role)) {
        await this.sendToUser(roomId, member.aiId, {
          ...event,
          roomId,
        } as GameEvent);
      }
    }
  }

  /**
   * 检查角色是否可见事件
   */
  private canSeeEvent(userRole: string, visibility: EventVisibility): boolean {
    switch (visibility) {
      case 'all':
        return true;
      case 'players':
        return ['player', 'admin'].includes(userRole);
      case 'referees':
        return ['referee', 'admin'].includes(userRole);
      case 'admin':
        return userRole === 'admin';
      case 'self':
        return true;  // 个性化处理
      default:
        return false;
    }
  }

  /**
   * 个性化事件数据
   */
  private personalizeEvent(
    event: Omit<GameEvent, 'roomId'>,
    aiId: string
  ): GameEvent {
    // 深拷贝事件
    const personalized = { ...event, roomId: '' } as GameEvent;

    // 根据事件类型个性化
    switch (event.type) {
      case 'werewolf_start':
        // 只给该玩家显示自己的角色
        if (event.data.targetAiId && event.data.targetAiId !== aiId) {
          personalized.data = { ...event.data, role: 'hidden' };
        }
        break;

      case 'night_action':
        // 只给目标玩家显示可操作的行动
        if (event.data.targetAiId && event.data.targetAiId !== aiId) {
          personalized.canRespond = false;
        }
        break;

      case 'quiz_question':
        // 题目给玩家，答案给裁判
        if (event.visibility === 'referees') {
          personalized.data = {
            ...event.data,
            correctAnswer: event.data.correctAnswer,
          };
        }
        break;
    }

    return personalized;
  }

  /**
   * 格式化 SSE 消息
   */
  private formatSSE(event: GameEvent): string {
    const lines = [
      `event: ${event.type}`,
      `id: ${event.id}`,
      `data: ${JSON.stringify({
        ...event,
        // 添加时间信息
        serverTime: Date.now(),
        timeRemaining: event.timeoutAt ? event.timeoutAt - Date.now() : undefined,
      })}`,
    ];

    if (event.timeoutAt) {
      lines.push(`retry: ${Math.max(0, event.timeoutAt - Date.now())}`);
    }

    return lines.join('\n') + '\n\n';
  }

  /**
   * 获取待处理事件（重连时）
   */
  async getPendingEvents(roomId: string, aiId: string): Promise<GameEvent[]> {
    const events = await this.redis.lrange(
      `events:pending:${roomId}:${aiId}`,
      0,
      -1
    );
    
    // 清空已获取的事件
    await this.redis.del(`events:pending:${roomId}:${aiId}`);

    return events.map(e => JSON.parse(e));
  }

  /**
   * 处理断开连接
   */
  private async handleDisconnect(roomId: string, aiId: string): Promise<void> {
    const connKey = `${roomId}:${aiId}`;
    this.connections.delete(connKey);

    // 更新成员离线状态
    const member = await this.roomManager.getMember(roomId, aiId);
    if (member) {
      member.isOnline = false;
      await this.redis.setex(
        `room:${roomId}:member:${aiId}`,
        3600,
        JSON.stringify(member)
      );
    }
  }

  /**
   * 检查操作是否超时
   */
  async isActionTimedOut(eventId: string): Promise<boolean> {
    const eventData = await this.redis.get(`event:${eventId}`);
    if (!eventData) return true;  // 事件不存在算超时

    const event: GameEvent = JSON.parse(eventData);
    if (!event.timeoutAt) return false;

    return Date.now() > event.timeoutAt;
  }

  /**
   * 记录事件用于超时检查
   */
  async recordEvent(event: GameEvent, ttl: number = 300): Promise<void> {
    await this.redis.setex(
      `event:${event.id}`,
      ttl,
      JSON.stringify(event)
    );
  }

  /**
   * 清理房间的所有连接
   */
  async cleanupRoom(roomId: string): Promise<void> {
    for (const [key, conn] of this.connections) {
      if (conn.roomId === roomId) {
        this.connections.delete(key);
      }
    }
  }
}
