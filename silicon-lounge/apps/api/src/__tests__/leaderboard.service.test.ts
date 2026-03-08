import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeaderboardService } from '../../services/leaderboard';
import { Redis } from 'ioredis';

const mockRedis = {
  zadd: vi.fn(),
  zrevrange: vi.fn(),
  zrank: vi.fn(),
  zscore: vi.fn(),
  zincrby: vi.fn(),
  pipeline: vi.fn(() => ({
    zadd: vi.fn().mockReturnThis(),
    zincrby: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
} as unknown as Redis;

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeaderboardService(mockRedis);
  });

  describe('updateRating', () => {
    it('应该更新用户积分', async () => {
      mockRedis.zadd.mockResolvedValue(1);

      await service.updateRating('ai-1', 'overall', 1600);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'leaderboard:overall',
        1600,
        'ai-1'
      );
    });

    it('应该同时更新多个排行榜', async () => {
      const pipeline = {
        zadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(pipeline);

      await service.updateRatingMulti('ai-1', {
        overall: 1600,
        quiz: 1550,
        werewolf: 1650,
      });

      expect(pipeline.zadd).toHaveBeenCalledTimes(3);
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getLeaderboard', () => {
    it('应该返回排行榜前 N 名', async () => {
      mockRedis.zrevrange.mockResolvedValue([
        'ai-1', '1800',
        'ai-2', '1750',
        'ai-3', '1700',
      ]);

      const entries = await service.getLeaderboard('overall', 10);

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        rank: 1,
        agentId: 'ai-1',
        rating: 1800,
      });
      expect(entries[1].rating).toBe(1750);
      expect(entries[2].rating).toBe(1700);
    });

    it('应该返回用户的排名', async () => {
      mockRedis.zrevrange.mockResolvedValue([
        'ai-1', '1800',
        'ai-2', '1750',
        'ai-3', '1700',
      ]);
      mockRedis.zrank.mockResolvedValue(2); // 排名第 3（0-based）
      mockRedis.zscore.mockResolvedValue('1700');

      const result = await service.getLeaderboardWithRank('overall', 'ai-3', 10);

      expect(result.myRank).toBeDefined();
      expect(result.myRank?.rank).toBe(3);
      expect(result.myRank?.rating).toBe(1700);
    });
  });

  describe('getTrend', () => {
    it('应该计算排名趋势', async () => {
      // 模拟历史排名
      const history = [
        { rank: 10, timestamp: Date.now() - 86400000 }, // 昨天
        { rank: 8, timestamp: Date.now() - 3600000 },   // 1小时前
        { rank: 5, timestamp: Date.now() },             // 现在
      ];

      const trend = service.calculateTrend(history);

      expect(trend).toBe('up');
    });

    it('应该检测下降趋势', async () => {
      const history = [
        { rank: 5, timestamp: Date.now() - 86400000 },
        { rank: 8, timestamp: Date.now() - 3600000 },
        { rank: 10, timestamp: Date.now() },
      ];

      const trend = service.calculateTrend(history);

      expect(trend).toBe('down');
    });
  });

  describe('周期性排行榜', () => {
    it('应该获取周排行榜', async () => {
      const weekKey = service.getWeekKey();
      expect(weekKey).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('应该获取月排行榜', async () => {
      const monthKey = service.getMonthKey();
      expect(monthKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it('应该在周/月结束时归档', async () => {
      // 模拟归档上周数据
      mockRedis.zrevrange.mockResolvedValue(['ai-1', '100']);

      await service.archiveWeeklyLeaderboard('2024-W01');

      expect(mockRedis.zrevrange).toHaveBeenCalledWith(
        'leaderboard:weekly:2024-W01',
        0,
        99,
        'WITHSCORES'
      );
    });
  });

  describe('成就系统', () => {
    it('应该检查成就条件', async () => {
      const stats = {
        gamesPlayed: 100,
        wins: 50,
        rating: 1800,
      };

      const achievement = {
        condition: {
          type: 'wins' as const,
          value: 50,
        },
      };

      const unlocked = service.checkAchievement(stats, achievement);

      expect(unlocked).toBe(true);
    });

    it('应该解锁首次胜利成就', async () => {
      const stats = { wins: 1 };
      
      const achievement = {
        id: 'first_win',
        name: '初出茅庐',
        condition: { type: 'wins' as const, value: 1 },
        reward: { exp: 100 },
      };

      const unlocked = service.checkAchievement(stats, achievement);

      expect(unlocked).toBe(true);
    });
  });

  describe('等级系统', () => {
    it('应该正确计算等级', () => {
      const testCases = [
        { exp: 0, expectedLevel: 1 },
        { exp: 100, expectedLevel: 2 },
        { exp: 300, expectedLevel: 3 },
        { exp: 600, expectedLevel: 4 },
      ];

      for (const { exp, expectedLevel } of testCases) {
        const level = service.calculateLevel(exp);
        expect(level).toBe(expectedLevel);
      }
    });

    it('应该返回正确的等级称号', () => {
      expect(service.getLevelTitle(1)).toBe('新手');
      expect(service.getLevelTitle(10)).toBe('熟手');
      expect(service.getLevelTitle(20)).toBe('专家');
      expect(service.getLevelTitle(50)).toBe('大师');
    });
  });
});