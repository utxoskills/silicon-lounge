"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const leaderboard_1 = require("../../services/leaderboard");
const mockRedis = {
    zadd: vitest_1.vi.fn(),
    zrevrange: vitest_1.vi.fn(),
    zrank: vitest_1.vi.fn(),
    zscore: vitest_1.vi.fn(),
    zincrby: vitest_1.vi.fn(),
    pipeline: vitest_1.vi.fn(() => ({
        zadd: vitest_1.vi.fn().mockReturnThis(),
        zincrby: vitest_1.vi.fn().mockReturnThis(),
        exec: vitest_1.vi.fn().mockResolvedValue([]),
    })),
};
(0, vitest_1.describe)('LeaderboardService', () => {
    let service;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new leaderboard_1.LeaderboardService(mockRedis);
    });
    (0, vitest_1.describe)('updateRating', () => {
        (0, vitest_1.it)('应该更新用户积分', async () => {
            mockRedis.zadd.mockResolvedValue(1);
            await service.updateRating('ai-1', 'overall', 1600);
            (0, vitest_1.expect)(mockRedis.zadd).toHaveBeenCalledWith('leaderboard:overall', 1600, 'ai-1');
        });
        (0, vitest_1.it)('应该同时更新多个排行榜', async () => {
            const pipeline = {
                zadd: vitest_1.vi.fn().mockReturnThis(),
                exec: vitest_1.vi.fn().mockResolvedValue([]),
            };
            mockRedis.pipeline.mockReturnValue(pipeline);
            await service.updateRatingMulti('ai-1', {
                overall: 1600,
                quiz: 1550,
                werewolf: 1650,
            });
            (0, vitest_1.expect)(pipeline.zadd).toHaveBeenCalledTimes(3);
            (0, vitest_1.expect)(pipeline.exec).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('getLeaderboard', () => {
        (0, vitest_1.it)('应该返回排行榜前 N 名', async () => {
            mockRedis.zrevrange.mockResolvedValue([
                'ai-1', '1800',
                'ai-2', '1750',
                'ai-3', '1700',
            ]);
            const entries = await service.getLeaderboard('overall', 10);
            (0, vitest_1.expect)(entries).toHaveLength(3);
            (0, vitest_1.expect)(entries[0]).toEqual({
                rank: 1,
                agentId: 'ai-1',
                rating: 1800,
            });
            (0, vitest_1.expect)(entries[1].rating).toBe(1750);
            (0, vitest_1.expect)(entries[2].rating).toBe(1700);
        });
        (0, vitest_1.it)('应该返回用户的排名', async () => {
            mockRedis.zrevrange.mockResolvedValue([
                'ai-1', '1800',
                'ai-2', '1750',
                'ai-3', '1700',
            ]);
            mockRedis.zrank.mockResolvedValue(2); // 排名第 3（0-based）
            mockRedis.zscore.mockResolvedValue('1700');
            const result = await service.getLeaderboardWithRank('overall', 'ai-3', 10);
            (0, vitest_1.expect)(result.myRank).toBeDefined();
            (0, vitest_1.expect)(result.myRank?.rank).toBe(3);
            (0, vitest_1.expect)(result.myRank?.rating).toBe(1700);
        });
    });
    (0, vitest_1.describe)('getTrend', () => {
        (0, vitest_1.it)('应该计算排名趋势', async () => {
            // 模拟历史排名
            const history = [
                { rank: 10, timestamp: Date.now() - 86400000 }, // 昨天
                { rank: 8, timestamp: Date.now() - 3600000 }, // 1小时前
                { rank: 5, timestamp: Date.now() }, // 现在
            ];
            const trend = service.calculateTrend(history);
            (0, vitest_1.expect)(trend).toBe('up');
        });
        (0, vitest_1.it)('应该检测下降趋势', async () => {
            const history = [
                { rank: 5, timestamp: Date.now() - 86400000 },
                { rank: 8, timestamp: Date.now() - 3600000 },
                { rank: 10, timestamp: Date.now() },
            ];
            const trend = service.calculateTrend(history);
            (0, vitest_1.expect)(trend).toBe('down');
        });
    });
    (0, vitest_1.describe)('周期性排行榜', () => {
        (0, vitest_1.it)('应该获取周排行榜', async () => {
            const weekKey = service.getWeekKey();
            (0, vitest_1.expect)(weekKey).toMatch(/^\d{4}-W\d{2}$/);
        });
        (0, vitest_1.it)('应该获取月排行榜', async () => {
            const monthKey = service.getMonthKey();
            (0, vitest_1.expect)(monthKey).toMatch(/^\d{4}-\d{2}$/);
        });
        (0, vitest_1.it)('应该在周/月结束时归档', async () => {
            // 模拟归档上周数据
            mockRedis.zrevrange.mockResolvedValue(['ai-1', '100']);
            await service.archiveWeeklyLeaderboard('2024-W01');
            (0, vitest_1.expect)(mockRedis.zrevrange).toHaveBeenCalledWith('leaderboard:weekly:2024-W01', 0, 99, 'WITHSCORES');
        });
    });
    (0, vitest_1.describe)('成就系统', () => {
        (0, vitest_1.it)('应该检查成就条件', async () => {
            const stats = {
                gamesPlayed: 100,
                wins: 50,
                rating: 1800,
            };
            const achievement = {
                condition: {
                    type: 'wins',
                    value: 50,
                },
            };
            const unlocked = service.checkAchievement(stats, achievement);
            (0, vitest_1.expect)(unlocked).toBe(true);
        });
        (0, vitest_1.it)('应该解锁首次胜利成就', async () => {
            const stats = { wins: 1 };
            const achievement = {
                id: 'first_win',
                name: '初出茅庐',
                condition: { type: 'wins', value: 1 },
                reward: { exp: 100 },
            };
            const unlocked = service.checkAchievement(stats, achievement);
            (0, vitest_1.expect)(unlocked).toBe(true);
        });
    });
    (0, vitest_1.describe)('等级系统', () => {
        (0, vitest_1.it)('应该正确计算等级', () => {
            const testCases = [
                { exp: 0, expectedLevel: 1 },
                { exp: 100, expectedLevel: 2 },
                { exp: 300, expectedLevel: 3 },
                { exp: 600, expectedLevel: 4 },
            ];
            for (const { exp, expectedLevel } of testCases) {
                const level = service.calculateLevel(exp);
                (0, vitest_1.expect)(level).toBe(expectedLevel);
            }
        });
        (0, vitest_1.it)('应该返回正确的等级称号', () => {
            (0, vitest_1.expect)(service.getLevelTitle(1)).toBe('新手');
            (0, vitest_1.expect)(service.getLevelTitle(10)).toBe('熟手');
            (0, vitest_1.expect)(service.getLevelTitle(20)).toBe('专家');
            (0, vitest_1.expect)(service.getLevelTitle(50)).toBe('大师');
        });
    });
});
