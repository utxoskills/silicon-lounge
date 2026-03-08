"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const matchmaking_1 = require("../../services/matchmaking");
const mockRedis = {
    zadd: vitest_1.vi.fn(),
    zrange: vitest_1.vi.fn(),
    zrem: vitest_1.vi.fn(),
    zcard: vitest_1.vi.fn(),
    zrevrank: vitest_1.vi.fn(),
    zscore: vitest_1.vi.fn(),
    expire: vitest_1.vi.fn(),
    keys: vitest_1.vi.fn(),
    setex: vitest_1.vi.fn(),
    get: vitest_1.vi.fn(),
    publish: vitest_1.vi.fn(),
    pipeline: vitest_1.vi.fn(() => ({
        zadd: vitest_1.vi.fn().mockReturnThis(),
        zrem: vitest_1.vi.fn().mockReturnThis(),
        exec: vitest_1.vi.fn().mockResolvedValue([]),
    })),
};
(0, vitest_1.describe)('MatchmakingService', () => {
    let service;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new matchmaking_1.MatchmakingService(mockRedis);
    });
    afterEach(() => {
        service.dispose();
    });
    (0, vitest_1.describe)('joinQueue', () => {
        (0, vitest_1.it)('应该将用户加入匹配队列', async () => {
            mockRedis.zadd.mockResolvedValue(1);
            mockRedis.zcard.mockResolvedValue(5);
            mockRedis.expire.mockResolvedValue(1);
            const result = await service.joinQueue('agent-1', 'quiz', {
                mode: '1v1',
                difficulty: 'medium',
                rating: 1500,
            });
            (0, vitest_1.expect)(result.requestId).toBeDefined();
            (0, vitest_1.expect)(result.estimatedTime).toBeGreaterThan(0);
            (0, vitest_1.expect)(mockRedis.zadd).toHaveBeenCalledWith('matchqueue:quiz:1v1:medium', 1500, vitest_1.expect.any(String));
        });
        (0, vitest_1.it)('应该根据队列长度估算等待时间', async () => {
            mockRedis.zadd.mockResolvedValue(1);
            mockRedis.zcard.mockResolvedValue(10);
            mockRedis.expire.mockResolvedValue(1);
            const result = await service.joinQueue('agent-1', 'quiz', {
                rating: 1500,
            });
            // 队列越长，等待时间越久
            (0, vitest_1.expect)(result.estimatedTime).toBeGreaterThan(10);
        });
        (0, vitest_1.it)('狼人杀应该有更长的预估等待时间', async () => {
            mockRedis.zadd.mockResolvedValue(1);
            mockRedis.zcard.mockResolvedValue(5);
            mockRedis.expire.mockResolvedValue(1);
            const quizResult = await service.joinQueue('agent-1', 'quiz', { rating: 1500 });
            const wwResult = await service.joinQueue('agent-2', 'werewolf', { rating: 1500 });
            (0, vitest_1.expect)(wwResult.estimatedTime).toBeGreaterThan(quizResult.estimatedTime);
        });
    });
    (0, vitest_1.describe)('cancelMatch', () => {
        (0, vitest_1.it)('应该取消匹配请求', async () => {
            mockRedis.keys.mockResolvedValue(['matchqueue:quiz:1v1:medium']);
            mockRedis.zrange.mockResolvedValue([
                JSON.stringify({ id: 'req-123', agentId: 'agent-1' }),
            ]);
            mockRedis.zrem.mockResolvedValue(1);
            const cancelled = await service.cancelMatch('req-123');
            (0, vitest_1.expect)(cancelled).toBe(true);
            (0, vitest_1.expect)(mockRedis.zrem).toHaveBeenCalled();
        });
        (0, vitest_1.it)('应该返回 false 如果请求不存在', async () => {
            mockRedis.keys.mockResolvedValue([]);
            const cancelled = await service.cancelMatch('non-existent');
            (0, vitest_1.expect)(cancelled).toBe(false);
        });
    });
    (0, vitest_1.describe)('processMatchmaking', () => {
        (0, vitest_1.it)('应该匹配积分相近的玩家', async () => {
            const requests = [
                { id: 'req-1', agentId: 'agent-1', rating: 1500, createdAt: Date.now() },
                { id: 'req-2', agentId: 'agent-2', rating: 1520, createdAt: Date.now() },
                { id: 'req-3', agentId: 'agent-3', rating: 1800, createdAt: Date.now() },
            ];
            mockRedis.keys.mockResolvedValue(['matchqueue:quiz:1v1:medium']);
            mockRedis.zrange.mockResolvedValue(requests.map(r => JSON.stringify(r)));
            mockRedis.setex.mockResolvedValue('OK');
            mockRedis.publish.mockResolvedValue(1);
            // 触发匹配
            await service.processMatchmaking();
            // agent-1 和 agent-2 应该被匹配（积分接近）
            (0, vitest_1.expect)(mockRedis.setex).toHaveBeenCalled();
        });
        (0, vitest_1.it)('1v1 模式需要 2 个玩家和 1 个裁判', async () => {
            const players = [
                { id: 'p1', agentId: 'agent-1', rating: 1500 },
                { id: 'p2', agentId: 'agent-2', rating: 1520 },
            ];
            const referees = [
                { id: 'r1', agentId: 'referee-1', rating: 1600 },
            ];
            mockRedis.keys.mockResolvedValue(['matchqueue:quiz:1v1:medium']);
            mockRedis.zrange
                .mockResolvedValueOnce(players.map(p => JSON.stringify(p)))
                .mockResolvedValueOnce(referees.map(r => JSON.stringify(r)));
            mockRedis.setex.mockResolvedValue('OK');
            mockRedis.publish.mockResolvedValue(1);
            await service.processMatchmaking();
            // 应该创建游戏
            (0, vitest_1.expect)(mockRedis.setex).toHaveBeenCalledWith(vitest_1.expect.stringContaining('matchresult:'), 300, vitest_1.expect.stringContaining('quiz'));
        });
        (0, vitest_1.it)('狼人杀需要 12 个玩家', async () => {
            const players = Array(12).fill(null).map((_, i) => ({
                id: `req-${i}`,
                agentId: `agent-${i}`,
                rating: 1500 + i * 10,
            }));
            mockRedis.keys.mockResolvedValue(['matchqueue:werewolf']);
            mockRedis.zrange.mockResolvedValue(players.map(p => JSON.stringify(p)));
            mockRedis.setex.mockResolvedValue('OK');
            mockRedis.publish.mockResolvedValue(1);
            await service.processMatchmaking();
            (0, vitest_1.expect)(mockRedis.setex).toHaveBeenCalledWith(vitest_1.expect.stringContaining('matchresult:'), 300, vitest_1.expect.stringContaining('werewolf'));
        });
    });
    (0, vitest_1.describe)('积分匹配算法', () => {
        (0, vitest_1.it)('应该优先匹配积分差距小的玩家', () => {
            const requests = [
                { id: 'r1', agentId: 'a1', rating: 1500 },
                { id: 'r2', agentId: 'a2', rating: 1510 },
                { id: 'r3', agentId: 'a3', rating: 1800 },
                { id: 'r4', agentId: 'a4', rating: 1820 },
            ];
            // a1 和 a2 差距 10，a3 和 a4 差距 20
            // 应该优先匹配 a1 和 a2
            const matched = service.findBestMatch(requests, 2);
            (0, vitest_1.expect)(matched).toHaveLength(2);
            (0, vitest_1.expect)(matched[0].agentId).toBe('a1');
            (0, vitest_1.expect)(matched[1].agentId).toBe('a2');
        });
        (0, vitest_1.it)('如果差距太大应该扩大搜索范围', () => {
            const requests = [
                { id: 'r1', agentId: 'a1', rating: 1000 },
                { id: 'r2', agentId: 'a2', rating: 2000 },
                { id: 'r3', agentId: 'a3', rating: 1500 },
            ];
            const matched = service.findBestMatch(requests, 2);
            // 应该返回积分最接近中心的玩家
            (0, vitest_1.expect)(matched).toHaveLength(2);
        });
    });
    (0, vitest_1.describe)('超时处理', () => {
        (0, vitest_1.it)('应该移除超时的匹配请求', async () => {
            const oldRequest = {
                id: 'old-req',
                agentId: 'agent-1',
                rating: 1500,
                createdAt: Date.now() - 400000, // 400 秒前，超过 300 秒超时
                preferences: { maxWaitTime: 300 },
            };
            mockRedis.keys.mockResolvedValue(['matchqueue:quiz']);
            mockRedis.zrange.mockResolvedValue([JSON.stringify(oldRequest)]);
            mockRedis.zrem.mockResolvedValue(1);
            await service.processMatchmaking();
            // 超时的请求应该被移除
            (0, vitest_1.expect)(mockRedis.zrem).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('性能', () => {
        (0, vitest_1.it)('应该在 100ms 内处理匹配', async () => {
            const requests = Array(100).fill(null).map((_, i) => ({
                id: `req-${i}`,
                agentId: `agent-${i}`,
                rating: 1500 + Math.random() * 500,
            }));
            mockRedis.keys.mockResolvedValue(['matchqueue:quiz']);
            mockRedis.zrange.mockResolvedValue(requests.map(r => JSON.stringify(r)));
            const start = Date.now();
            await service.processMatchmaking();
            const elapsed = Date.now() - start;
            (0, vitest_1.expect)(elapsed).toBeLessThan(100);
        });
    });
});
