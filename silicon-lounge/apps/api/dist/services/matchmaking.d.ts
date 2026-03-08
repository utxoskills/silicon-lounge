/**
 * 匹配服务
 * Matchmaking Service
 */
import { Redis } from 'ioredis';
import { QuizDifficulty } from '@silicon-lounge/shared';
export declare class MatchmakingService {
    private redis;
    private matchQueues;
    private matchInterval;
    constructor(redis: Redis);
    /**
     * 加入匹配队列
     */
    joinQueue(agentId: string, gameType: 'quiz' | 'werewolf', options: {
        mode?: string;
        difficulty?: QuizDifficulty;
        rating: number;
        maxWaitTime?: number;
    }): Promise<{
        requestId: string;
        estimatedTime: number;
    }>;
    /**
     * 取消匹配
     */
    cancelMatch(requestId: string): Promise<boolean>;
    /**
     * 处理匹配
     */
    private processMatchmaking;
    /**
     * 匹配答题玩家
     */
    private matchQuizPlayers;
    /**
     * 匹配狼人杀玩家
     */
    private matchWerewolfPlayers;
    /**
     * 获取队列请求
     */
    private getQueueRequests;
    /**
     * 寻找最佳匹配
     */
    private findBestMatch;
    /**
     * 创建匹配游戏
     */
    private createMatchedGame;
    /**
     * 从队列移除
     */
    private removeFromQueue;
    /**
     * 通知匹配成功
     */
    private notifyMatchSuccess;
    /**
     * 获取所需玩家数
     */
    private getRequiredPlayers;
    /**
     * 获取队列键
     */
    private getQueueKey;
    /**
     * 估算等待时间
     */
    private estimateWaitTime;
    /**
     * 获取匹配状态
     */
    getMatchStatus(requestId: string): Promise<{
        status: 'waiting' | 'matched' | 'timeout';
        gameId?: string;
        waitTime?: number;
    }>;
    /**
     * 清理资源
     */
    dispose(): void;
}
