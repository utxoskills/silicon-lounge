"use strict";
/**
 * 排行榜服务
 * Leaderboard & Rating System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardService = void 0;
class LeaderboardService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    /**
     * 更新积分
     */
    async updateRating(agentId, type, rating) {
        await this.redis.zadd(`leaderboard:${type}`, rating, agentId);
    }
    /**
     * 批量更新积分
     */
    async updateRatingMulti(agentId, ratings) {
        const pipeline = this.redis.pipeline();
        for (const [type, rating] of Object.entries(ratings)) {
            if (rating !== undefined) {
                pipeline.zadd(`leaderboard:${type}`, rating, agentId);
            }
        }
        await pipeline.exec();
    }
    /**
     * 增加积分（用于赛后更新）
     */
    async incrementRating(agentId, type, delta) {
        return this.redis.zincrby(`leaderboard:${type}`, delta, agentId);
    }
    /**
     * 获取排行榜
     */
    async getLeaderboard(type, topN = 100) {
        const results = await this.redis.zrevrange(`leaderboard:${type}`, 0, topN - 1, 'WITHSCORES');
        const entries = [];
        for (let i = 0; i < results.length; i += 2) {
            const agentId = results[i];
            const rating = parseInt(results[i + 1], 10);
            entries.push({
                rank: Math.floor(i / 2) + 1,
                agentId,
                agentName: '', // 需要额外查询
                rating,
                level: this.calculateLevel(rating),
                title: this.getLevelTitle(this.calculateLevel(rating)),
                wins: 0,
                winRate: 0,
                trend: 'stable',
                change: 0,
            });
        }
        return entries;
    }
    /**
     * 获取排行榜（包含用户排名）
     */
    async getLeaderboardWithRank(type, agentId, topN = 100) {
        const [entries, myRank, myScore] = await Promise.all([
            this.getLeaderboard(type, topN),
            this.redis.zrevrank(`leaderboard:${type}`, agentId),
            this.redis.zscore(`leaderboard:${type}`, agentId),
        ]);
        let myRankEntry;
        if (myRank !== null && myScore !== null) {
            myRankEntry = {
                rank: myRank + 1,
                agentId,
                agentName: '',
                rating: parseInt(myScore, 10),
                level: this.calculateLevel(parseInt(myScore, 10)),
                title: this.getLevelTitle(this.calculateLevel(parseInt(myScore, 10))),
                wins: 0,
                winRate: 0,
                trend: 'stable',
                change: 0,
            };
        }
        return { entries, myRank: myRankEntry };
    }
    /**
     * 获取用户排名
     */
    async getAgentRank(agentId, type) {
        const [rank, score] = await Promise.all([
            this.redis.zrevrank(`leaderboard:${type}`, agentId),
            this.redis.zscore(`leaderboard:${type}`, agentId),
        ]);
        if (rank === null || score === null)
            return null;
        return {
            rank: rank + 1,
            rating: parseInt(score, 10),
        };
    }
    /**
     * 计算排名趋势
     */
    calculateTrend(history) {
        if (history.length < 2)
            return 'stable';
        // 取最近 5 条记录
        const recent = history.slice(-5);
        const oldRank = recent[0].rank;
        const newRank = recent[recent.length - 1].rank;
        if (newRank < oldRank)
            return 'up'; // 排名上升（数字变小）
        if (newRank > oldRank)
            return 'down'; // 排名下降
        return 'stable';
    }
    /**
     * 获取周/月键名
     */
    getWeekKey(date = new Date()) {
        const year = date.getFullYear();
        const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / 604800000);
        return `${year}-W${week.toString().padStart(2, '0')}`;
    }
    getMonthKey(date = new Date()) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    /**
     * 归档周排行榜
     */
    async archiveWeeklyLeaderboard(weekKey) {
        const entries = await this.redis.zrevrange(`leaderboard:weekly:${weekKey}`, 0, 99, 'WITHSCORES');
        // 保存到历史记录
        await this.redis.setex(`leaderboard:archive:weekly:${weekKey}`, 2592000, // 30 天
        JSON.stringify(entries));
    }
    /**
     * 检查成就
     */
    checkAchievement(stats, achievement) {
        switch (achievement.condition.type) {
            case 'games_played':
                return stats.gamesPlayed >= achievement.condition.value;
            case 'wins':
                return stats.wins >= achievement.condition.value;
            case 'rating':
                return stats.rating >= achievement.condition.value;
            case 'streak':
                return stats.winStreak >= achievement.condition.value;
            case 'special':
                // 特殊条件，由外部判断
                return false;
            default:
                return false;
        }
    }
    /**
     * 计算等级
     */
    calculateLevel(exp) {
        // 经验值公式：level = sqrt(exp / 100)
        return Math.floor(Math.sqrt(exp / 100)) + 1;
    }
    /**
     * 获取等级称号
     */
    getLevelTitle(level) {
        const titles = [
            { min: 1, title: '新手' },
            { min: 5, title: '学徒' },
            { min: 10, title: '熟手' },
            { min: 20, title: '专家' },
            { min: 30, title: '大师' },
            { min: 50, title: '宗师' },
            { min: 80, title: '传说' },
            { min: 100, title: '神话' },
        ];
        for (let i = titles.length - 1; i >= 0; i--) {
            if (level >= titles[i].min) {
                return titles[i].title;
            }
        }
        return '新手';
    }
    /**
     * 计算下一级所需经验
     */
    getNextLevelExp(level) {
        return Math.pow(level, 2) * 100;
    }
    /**
     * 获取附近排名（用于显示前后几名）
     */
    async getNearbyRanks(agentId, type, range = 2) {
        const rank = await this.redis.zrevrank(`leaderboard:${type}`, agentId);
        if (rank === null)
            return [];
        const start = Math.max(0, rank - range);
        const end = rank + range;
        const results = await this.redis.zrevrange(`leaderboard:${type}`, start, end, 'WITHSCORES');
        const entries = [];
        for (let i = 0; i < results.length; i += 2) {
            entries.push({
                rank: start + Math.floor(i / 2) + 1,
                agentId: results[i],
                agentName: '',
                rating: parseInt(results[i + 1], 10),
                level: 0,
                title: '',
                wins: 0,
                winRate: 0,
                trend: 'stable',
                change: 0,
            });
        }
        return entries;
    }
}
exports.LeaderboardService = LeaderboardService;
