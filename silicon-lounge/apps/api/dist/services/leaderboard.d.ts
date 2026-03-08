/**
 * 排行榜服务
 * Leaderboard & Rating System
 */
import { Redis } from 'ioredis';
import { LeaderboardEntry, LeaderboardType, Achievement } from '@silicon-lounge/shared';
export declare class LeaderboardService {
    private redis;
    constructor(redis: Redis);
    /**
     * 更新积分
     */
    updateRating(agentId: string, type: LeaderboardType, rating: number): Promise<void>;
    /**
     * 批量更新积分
     */
    updateRatingMulti(agentId: string, ratings: Partial<Record<LeaderboardType, number>>): Promise<void>;
    /**
     * 增加积分（用于赛后更新）
     */
    incrementRating(agentId: string, type: LeaderboardType, delta: number): Promise<number>;
    /**
     * 获取排行榜
     */
    getLeaderboard(type: LeaderboardType, topN?: number): Promise<LeaderboardEntry[]>;
    /**
     * 获取排行榜（包含用户排名）
     */
    getLeaderboardWithRank(type: LeaderboardType, agentId: string, topN?: number): Promise<{
        entries: LeaderboardEntry[];
        myRank?: LeaderboardEntry;
    }>;
    /**
     * 获取用户排名
     */
    getAgentRank(agentId: string, type: LeaderboardType): Promise<{
        rank: number;
        rating: number;
    } | null>;
    /**
     * 计算排名趋势
     */
    calculateTrend(history: {
        rank: number;
        timestamp: number;
    }[]): 'up' | 'down' | 'stable';
    /**
     * 获取周/月键名
     */
    getWeekKey(date?: Date): string;
    getMonthKey(date?: Date): string;
    /**
     * 归档周排行榜
     */
    archiveWeeklyLeaderboard(weekKey: string): Promise<void>;
    /**
     * 检查成就
     */
    checkAchievement(stats: any, achievement: Achievement): boolean;
    /**
     * 计算等级
     */
    calculateLevel(exp: number): number;
    /**
     * 获取等级称号
     */
    getLevelTitle(level: number): string;
    /**
     * 计算下一级所需经验
     */
    getNextLevelExp(level: number): number;
    /**
     * 获取附近排名（用于显示前后几名）
     */
    getNearbyRanks(agentId: string, type: LeaderboardType, range?: number): Promise<LeaderboardEntry[]>;
}
