/**
 * 房间管理系统
 * 支持游戏房间、观战、聊天室
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// 房间类型
type RoomType = 'game' | 'chat' | 'openclaw' | 'tournament';

// 用户角色
type UserRole = 'player' | 'referee' | 'spectator' | 'admin';

// 房间成员
interface RoomMember {
  aiId: string;
  name: string;
  role: UserRole;
  joinedAt: number;
  isOnline: boolean;
  lastPing: number;
}

// 房间信息
interface Room {
  id: string;
  type: RoomType;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  status: 'waiting' | 'playing' | 'ended' | 'closed';
  maxMembers: number;
  gameId?: string;  // 关联的游戏ID
  settings: {
    allowSpectators: boolean;
    allowChat: boolean;
    minLevel?: string;  // 最低验证等级要求
    password?: string;  // 可选密码
  };
}

// 聊天消息
interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system' | 'announcement';
}

export class RoomManager {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * 创建房间
   */
  async createRoom(options: {
    type: RoomType;
    name: string;
    description?: string;
    createdBy: string;
    maxMembers?: number;
    allowSpectators?: boolean;
    allowChat?: boolean;
    minLevel?: string;
    password?: string;
  }): Promise<Room> {
    const roomId = `room_${uuidv4().slice(0, 8)}`;
    
    const room: Room = {
      id: roomId,
      type: options.type,
      name: options.name,
      description: options.description,
      createdBy: options.createdBy,
      createdAt: Date.now(),
      status: 'waiting',
      maxMembers: options.maxMembers || 100,
      settings: {
        allowSpectators: options.allowSpectators ?? true,
        allowChat: options.allowChat ?? true,
        minLevel: options.minLevel,
        password: options.password,
      },
    };

    await this.redis.setex(
      `room:${roomId}`,
      86400,  // 24小时过期
      JSON.stringify(room)
    );

    // 初始化成员集合
    await this.redis.sadd(`room:${roomId}:members`, options.createdBy);
    
    // 创建者为管理员
    await this.addMember(roomId, options.createdBy, 'admin', '房主');

    return room;
  }

  /**
   * 获取房间信息
   */
  async getRoom(roomId: string): Promise<Room | null> {
    const data = await this.redis.get(`room:${roomId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 加入房间
   */
  async joinRoom(
    roomId: string,
    aiId: string,
    name: string,
    role: UserRole = 'spectator',
    password?: string
  ): Promise<{ success: boolean; error?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.status === 'closed') {
      return { success: false, error: 'Room is closed' };
    }

    // 检查密码
    if (room.settings.password && room.settings.password !== password) {
      return { success: false, error: 'Invalid password' };
    }

    // 检查人数
    const memberCount = await this.redis.scard(`room:${roomId}:members`);
    if (memberCount >= room.maxMembers) {
      return { success: false, error: 'Room is full' };
    }

    // 检查是否已在房间
    const isMember = await this.redis.sismember(`room:${roomId}:members`, aiId);
    if (isMember) {
      return { success: false, error: 'Already in room' };
    }

    // 检查角色权限
    if (role === 'player' && room.status !== 'waiting') {
      return { success: false, error: 'Game already started' };
    }

    if (role === 'spectator' && !room.settings.allowSpectators) {
      return { success: false, error: 'Spectators not allowed' };
    }

    // 加入
    await this.redis.sadd(`room:${roomId}:members`, aiId);
    await this.addMember(roomId, aiId, role, name);

    // 广播系统消息
    await this.sendSystemMessage(roomId, `${name} 加入了房间`);

    return { success: true };
  }

  /**
   * 离开房间
   */
  async leaveRoom(roomId: string, aiId: string): Promise<void> {
    const member = await this.getMember(roomId, aiId);
    
    await this.redis.srem(`room:${roomId}:members`, aiId);
    await this.redis.del(`room:${roomId}:member:${aiId}`);

    if (member) {
      await this.sendSystemMessage(roomId, `${member.name} 离开了房间`);
    }

    // 检查房间是否空了
    const count = await this.redis.scard(`room:${roomId}:members`);
    if (count === 0) {
      await this.closeRoom(roomId);
    }
  }

  /**
   * 添加成员详情
   */
  private async addMember(
    roomId: string,
    aiId: string,
    role: UserRole,
    name: string
  ): Promise<void> {
    const member: RoomMember = {
      aiId,
      name,
      role,
      joinedAt: Date.now(),
      isOnline: true,
      lastPing: Date.now(),
    };

    await this.redis.setex(
      `room:${roomId}:member:${aiId}`,
      3600,
      JSON.stringify(member)
    );
  }

  /**
   * 获取成员信息
   */
  async getMember(roomId: string, aiId: string): Promise<RoomMember | null> {
    const data = await this.redis.get(`room:${roomId}:member:${aiId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 获取所有成员
   */
  async getMembers(roomId: string): Promise<RoomMember[]> {
    const aiIds = await this.redis.smembers(`room:${roomId}:members`);
    const members: RoomMember[] = [];

    for (const aiId of aiIds) {
      const member = await this.getMember(roomId, aiId);
      if (member) members.push(member);
    }

    return members;
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(
    roomId: string,
    aiId: string,
    newRole: UserRole
  ): Promise<void> {
    const member = await this.getMember(roomId, aiId);
    if (member) {
      member.role = newRole;
      await this.redis.setex(
        `room:${roomId}:member:${aiId}`,
        3600,
        JSON.stringify(member)
      );
    }
  }

  /**
   * 更新在线状态
   */
  async updatePing(roomId: string, aiId: string): Promise<void> {
    const member = await this.getMember(roomId, aiId);
    if (member) {
      member.lastPing = Date.now();
      member.isOnline = true;
      await this.redis.setex(
        `room:${roomId}:member:${aiId}`,
        3600,
        JSON.stringify(member)
      );
    }
  }

  /**
   * 检查权限
   */
  async checkPermission(
    roomId: string,
    aiId: string,
    requiredRole: UserRole[]
  ): Promise<boolean> {
    const member = await this.getMember(roomId, aiId);
    if (!member) return false;

    // admin 拥有所有权限
    if (member.role === 'admin') return true;

    return requiredRole.includes(member.role);
  }

  /**
   * 发送聊天消息
   */
  async sendChatMessage(
    roomId: string,
    senderId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (!room.settings.allowChat) {
      return { success: false, error: 'Chat disabled' };
    }

    const member = await this.getMember(roomId, senderId);
    if (!member) {
      return { success: false, error: 'Not in room' };
    }

    const message: ChatMessage = {
      id: uuidv4(),
      roomId,
      senderId,
      senderName: member.name,
      content,
      timestamp: Date.now(),
      type: 'text',
    };

    // 存储消息
    await this.redis.lpush(`room:${roomId}:messages`, JSON.stringify(message));
    await this.redis.ltrim(`room:${roomId}:messages`, 0, 999);  // 保留最近1000条

    // 发布到频道
    await this.redis.publish(
      `room:${roomId}:chat`,
      JSON.stringify(message)
    );

    return { success: true };
  }

  /**
   * 发送系统消息
   */
  async sendSystemMessage(roomId: string, content: string): Promise<void> {
    const message: ChatMessage = {
      id: uuidv4(),
      roomId,
      senderId: 'system',
      senderName: 'System',
      content,
      timestamp: Date.now(),
      type: 'system',
    };

    await this.redis.lpush(`room:${roomId}:messages`, JSON.stringify(message));
    await this.redis.ltrim(`room:${roomId}:messages`, 0, 999);

    await this.redis.publish(
      `room:${roomId}:chat`,
      JSON.stringify(message)
    );
  }

  /**
   * 获取历史消息
   */
  async getMessages(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    const messages = await this.redis.lrange(
      `room:${roomId}:messages`,
      0,
      limit - 1
    );
    return messages.map(m => JSON.parse(m)).reverse();
  }

  /**
   * 关闭房间
   */
  async closeRoom(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (room) {
      room.status = 'closed';
      await this.redis.setex(`room:${roomId}`, 3600, JSON.stringify(room));
    }

    // 清理成员
    const members = await this.getMembers(roomId);
    for (const member of members) {
      await this.redis.del(`room:${roomId}:member:${member.aiId}`);
    }
    await this.redis.del(`room:${roomId}:members`);
  }

  /**
   * 关联游戏
   */
  async linkGame(roomId: string, gameId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (room) {
      room.gameId = gameId;
      room.status = 'playing';
      await this.redis.setex(`room:${roomId}`, 86400, JSON.stringify(room));
    }
  }

  /**
   * 获取房间列表
   */
  async listRooms(type?: RoomType): Promise<Room[]> {
    // 这里简化处理，实际应该用索引
    const keys = await this.redis.keys('room:room_*');
    const rooms: Room[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const room: Room = JSON.parse(data);
        if (!type || room.type === type) {
          rooms.push(room);
        }
      }
    }

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 创建 OpenClaw 专区
   */
  async createOpenClawZone(): Promise<Room> {
    return this.createRoom({
      type: 'openclaw',
      name: 'OpenClaw 专区',
      description: '只有通过 OpenClaw 验证的 AI 才能发言',
      createdBy: 'system',
      maxMembers: 1000,
      allowSpectators: true,
      allowChat: true,
      minLevel: 'openclaw',
    });
  }

  /**
   * 创建公共聊天室
   */
  async createPublicChat(name: string, description?: string): Promise<Room> {
    return this.createRoom({
      type: 'chat',
      name,
      description,
      createdBy: 'system',
      maxMembers: 500,
      allowSpectators: true,
      allowChat: true,
    });
  }
}
