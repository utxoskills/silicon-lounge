import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomService } from '../../services/rooms';
import { Redis } from 'ioredis';
import { AIAgent, VerificationLevel } from '@silicon-lounge/shared';

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  lrange: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn(),
  exists: vi.fn(),
} as unknown as Redis;

describe('RoomService', () => {
  let service: RoomService;

  const mockAgent: AIAgent = {
    id: 'agent-123',
    fingerprint: {
      id: 'fp-123',
      capabilities: [],
      avgResponseTime: 50,
      maxContextWindow: 128000,
      supportsTools: true,
      supportsVision: false,
    },
    name: 'Agent-TEST',
    level: 'basic',
    verifiedAt: new Date(),
    lastSeen: new Date(),
    totalMessages: 0,
    rooms: [],
    metadata: {
      preferredLanguage: 'zh-CN',
      interests: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RoomService(mockRedis);
  });

  describe('initializeDefaultRooms', () => {
    it('应该创建默认房间', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.setex.mockResolvedValue('OK');

      await service.initializeDefaultRooms();

      expect(mockRedis.setex).toHaveBeenCalledTimes(5);
    });

    it('不应该覆盖已存在的房间', async () => {
      mockRedis.exists.mockResolvedValue(1);

      await service.initializeDefaultRooms();

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('createRoom', () => {
    it('应该创建新房间', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const room = await service.createRoom({
        name: 'Test Room',
        description: 'Test Description',
        level: 'basic',
        maxAgents: 50,
      });

      expect(room.id).toBeDefined();
      expect(room.name).toBe('Test Room');
      expect(room.agents.size).toBe(0);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('room:'),
        86400,
        expect.any(String)
      );
    });
  });

  describe('getRoom', () => {
    it('应该返回存在的房间', async () => {
      const mockRoom = {
        id: 'room-123',
        name: 'Test Room',
        agents: [],
        messages: [],
        metadata: {},
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));

      const room = await service.getRoom('room-123');

      expect(room).toBeDefined();
      expect(room?.id).toBe('room-123');
    });

    it('应该返回 null 对于不存在的房间', async () => {
      mockRedis.get.mockResolvedValue(null);

      const room = await service.getRoom('non-existent');

      expect(room).toBeNull();
    });
  });

  describe('joinRoom', () => {
    it('应该允许有权限的代理加入', async () => {
      const mockRoom = {
        id: 'general',
        name: 'General',
        level: 'basic',
        maxAgents: 100,
        agents: [],
        messages: [],
        metadata: { totalMessages: 0, peakConcurrent: 0 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.joinRoom('general', mockAgent);

      expect(result.success).toBe(true);
      expect(result.room).toBeDefined();
    });

    it('应该拒绝权限不足的代理', async () => {
      const mockRoom = {
        id: 'openclaw',
        name: 'OpenClaw',
        level: 'openclaw',
        maxAgents: 100,
        agents: [],
        messages: [],
        metadata: {},
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));

      const basicAgent = { ...mockAgent, level: 'basic' as VerificationLevel };
      const result = await service.joinRoom('openclaw', basicAgent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient verification level');
    });

    it('应该拒绝已满的房间', async () => {
      const agents = Array(100).fill(null).map((_, i) => [`agent-${i}`, { id: `agent-${i}` }]);
      const mockRoom = {
        id: 'full-room',
        name: 'Full Room',
        level: 'basic',
        maxAgents: 100,
        agents,
        messages: [],
        metadata: {},
      };
      mockRedis.get.mockResolvedValue(JSON.stringify({ ...mockRoom, agents }));

      const result = await service.joinRoom('full-room', mockAgent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Room is full');
    });

    it('应该更新峰值并发数', async () => {
      const mockRoom = {
        id: 'test-room',
        name: 'Test',
        level: 'basic',
        maxAgents: 100,
        agents: [['agent-1', { id: 'agent-1' }]],
        messages: [],
        metadata: { totalMessages: 0, peakConcurrent: 1 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
      mockRedis.setex.mockResolvedValue('OK');

      await service.joinRoom('test-room', mockAgent);

      const savedRoom = JSON.parse(mockRedis.setex.mock.calls[0][1]);
      expect(savedRoom.metadata.peakConcurrent).toBe(2);
    });
  });

  describe('leaveRoom', () => {
    it('应该从房间移除代理', async () => {
      const mockRoom = {
        id: 'test-room',
        name: 'Test',
        agents: [['agent-123', mockAgent]],
        messages: [],
        metadata: {},
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
      mockRedis.setex.mockResolvedValue('OK');

      await service.leaveRoom('test-room', 'agent-123');

      const savedRoom = JSON.parse(mockRedis.setex.mock.calls[0][1]);
      expect(savedRoom.agents).toHaveLength(0);
    });
  });

  describe('addMessage', () => {
    it('应该添加消息到房间', async () => {
      const mockRoom = {
        id: 'test-room',
        name: 'Test',
        agents: [],
        messages: [],
        metadata: { totalMessages: 0, peakConcurrent: 0 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');

      const message = {
        id: 'msg-1',
        type: 'text' as const,
        roomId: 'test-room',
        agentId: 'agent-123',
        agentName: 'Agent-TEST',
        content: 'Hello',
        metadata: { responseTime: 50, tokens: 10 },
        timestamp: Date.now(),
      };

      await service.addMessage('test-room', message);

      const savedRoom = JSON.parse(mockRedis.setex.mock.calls[0][1]);
      expect(savedRoom.messages).toHaveLength(1);
      expect(savedRoom.metadata.totalMessages).toBe(1);
    });

    it('应该限制消息历史为 1000 条', async () => {
      const messages = Array(1000).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        type: 'text',
        content: `Message ${i}`,
      }));
      
      const mockRoom = {
        id: 'test-room',
        name: 'Test',
        agents: [],
        messages,
        metadata: { totalMessages: 1000, peakConcurrent: 0 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');

      const newMessage = {
        id: 'msg-new',
        type: 'text' as const,
        roomId: 'test-room',
        agentId: 'agent-123',
        agentName: 'Agent-TEST',
        content: 'New message',
        metadata: { responseTime: 50, tokens: 10 },
        timestamp: Date.now(),
      };

      await service.addMessage('test-room', newMessage);

      const savedRoom = JSON.parse(mockRedis.setex.mock.calls[0][1]);
      expect(savedRoom.messages).toHaveLength(1000);
    });
  });

  describe('性能要求', () => {
    it('应该在 5ms 内完成加入房间', async () => {
      const mockRoom = {
        id: 'perf-test',
        name: 'Perf Test',
        level: 'basic',
        maxAgents: 1000,
        agents: [],
        messages: [],
        metadata: { totalMessages: 0, peakConcurrent: 0 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
      mockRedis.setex.mockResolvedValue('OK');

      const start = Date.now();
      await service.joinRoom('perf-test', mockAgent);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5);
    });

    it('应该支持高并发消息写入', async () => {
      const mockRoom = {
        id: 'concurrent-test',
        name: 'Concurrent',
        agents: [],
        messages: [],
        metadata: { totalMessages: 0, peakConcurrent: 0 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');

      const messages = Array(100).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        type: 'text' as const,
        roomId: 'concurrent-test',
        agentId: 'agent-123',
        agentName: 'Agent-TEST',
        content: `Message ${i}`,
        metadata: { responseTime: 50, tokens: 10 },
        timestamp: Date.now(),
      }));

      const start = Date.now();
      await Promise.all(messages.map(m => service.addMessage('concurrent-test', m)));
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // 100 条消息在 100ms 内
    });
  });
});