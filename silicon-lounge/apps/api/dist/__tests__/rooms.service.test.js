"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rooms_1 = require("../../services/rooms");
const mockRedis = {
    get: vitest_1.vi.fn(),
    setex: vitest_1.vi.fn(),
    del: vitest_1.vi.fn(),
    keys: vitest_1.vi.fn(),
    lrange: vitest_1.vi.fn(),
    lpush: vitest_1.vi.fn(),
    ltrim: vitest_1.vi.fn(),
    exists: vitest_1.vi.fn(),
};
(0, vitest_1.describe)('RoomService', () => {
    let service;
    const mockAgent = {
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
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new rooms_1.RoomService(mockRedis);
    });
    (0, vitest_1.describe)('initializeDefaultRooms', () => {
        (0, vitest_1.it)('应该创建默认房间', async () => {
            mockRedis.exists.mockResolvedValue(0);
            mockRedis.setex.mockResolvedValue('OK');
            await service.initializeDefaultRooms();
            (0, vitest_1.expect)(mockRedis.setex).toHaveBeenCalledTimes(5);
        });
        (0, vitest_1.it)('不应该覆盖已存在的房间', async () => {
            mockRedis.exists.mockResolvedValue(1);
            await service.initializeDefaultRooms();
            (0, vitest_1.expect)(mockRedis.setex).not.toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('createRoom', () => {
        (0, vitest_1.it)('应该创建新房间', async () => {
            mockRedis.setex.mockResolvedValue('OK');
            const room = await service.createRoom({
                name: 'Test Room',
                description: 'Test Description',
                level: 'basic',
                maxAgents: 50,
            });
            (0, vitest_1.expect)(room.id).toBeDefined();
            (0, vitest_1.expect)(room.name).toBe('Test Room');
            (0, vitest_1.expect)(room.agents.size).toBe(0);
            (0, vitest_1.expect)(mockRedis.setex).toHaveBeenCalledWith(vitest_1.expect.stringContaining('room:'), 86400, vitest_1.expect.any(String));
        });
    });
    (0, vitest_1.describe)('getRoom', () => {
        (0, vitest_1.it)('应该返回存在的房间', async () => {
            const mockRoom = {
                id: 'room-123',
                name: 'Test Room',
                agents: [],
                messages: [],
                metadata: {},
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(mockRoom));
            const room = await service.getRoom('room-123');
            (0, vitest_1.expect)(room).toBeDefined();
            (0, vitest_1.expect)(room?.id).toBe('room-123');
        });
        (0, vitest_1.it)('应该返回 null 对于不存在的房间', async () => {
            mockRedis.get.mockResolvedValue(null);
            const room = await service.getRoom('non-existent');
            (0, vitest_1.expect)(room).toBeNull();
        });
    });
    (0, vitest_1.describe)('joinRoom', () => {
        (0, vitest_1.it)('应该允许有权限的代理加入', async () => {
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
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.room).toBeDefined();
        });
        (0, vitest_1.it)('应该拒绝权限不足的代理', async () => {
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
            const basicAgent = { ...mockAgent, level: 'basic' };
            const result = await service.joinRoom('openclaw', basicAgent);
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error).toBe('Insufficient verification level');
        });
        (0, vitest_1.it)('应该拒绝已满的房间', async () => {
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
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error).toBe('Room is full');
        });
        (0, vitest_1.it)('应该更新峰值并发数', async () => {
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
            (0, vitest_1.expect)(savedRoom.metadata.peakConcurrent).toBe(2);
        });
    });
    (0, vitest_1.describe)('leaveRoom', () => {
        (0, vitest_1.it)('应该从房间移除代理', async () => {
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
            (0, vitest_1.expect)(savedRoom.agents).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)('addMessage', () => {
        (0, vitest_1.it)('应该添加消息到房间', async () => {
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
                type: 'text',
                roomId: 'test-room',
                agentId: 'agent-123',
                agentName: 'Agent-TEST',
                content: 'Hello',
                metadata: { responseTime: 50, tokens: 10 },
                timestamp: Date.now(),
            };
            await service.addMessage('test-room', message);
            const savedRoom = JSON.parse(mockRedis.setex.mock.calls[0][1]);
            (0, vitest_1.expect)(savedRoom.messages).toHaveLength(1);
            (0, vitest_1.expect)(savedRoom.metadata.totalMessages).toBe(1);
        });
        (0, vitest_1.it)('应该限制消息历史为 1000 条', async () => {
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
                type: 'text',
                roomId: 'test-room',
                agentId: 'agent-123',
                agentName: 'Agent-TEST',
                content: 'New message',
                metadata: { responseTime: 50, tokens: 10 },
                timestamp: Date.now(),
            };
            await service.addMessage('test-room', newMessage);
            const savedRoom = JSON.parse(mockRedis.setex.mock.calls[0][1]);
            (0, vitest_1.expect)(savedRoom.messages).toHaveLength(1000);
        });
    });
    (0, vitest_1.describe)('性能要求', () => {
        (0, vitest_1.it)('应该在 5ms 内完成加入房间', async () => {
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
            (0, vitest_1.expect)(elapsed).toBeLessThan(5);
        });
        (0, vitest_1.it)('应该支持高并发消息写入', async () => {
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
                type: 'text',
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
            (0, vitest_1.expect)(elapsed).toBeLessThan(100); // 100 条消息在 100ms 内
        });
    });
});
