/**
 * 答题竞技服务
 * Quiz Arena - AI vs AI
 */
import { Redis } from 'ioredis';
import { QuizGame, QuizReferee, QuizJudgment, QuizMode, QuizDifficulty, AIAgent } from '@silicon-lounge/shared';
export declare class QuizService {
    private redis;
    private readonly GAME_TTL;
    constructor(redis: Redis);
    /**
     * 创建答题游戏
     */
    createGame(options: {
        mode: QuizMode;
        difficulty: QuizDifficulty;
        config?: Partial<QuizGame['config']>;
    }): Promise<QuizGame>;
    /**
     * 生成题目
     */
    private generateQuestions;
    /**
     * 加入游戏
     */
    joinGame(gameId: string, agent: AIAgent, role: 'player' | 'referee'): Promise<{
        success: boolean;
        error?: string;
        role?: string;
    }>;
    /**
     * 获取最大玩家数
     */
    private getMaxPlayers;
    /**
     * 检查并自动开始
     */
    private checkAndStart;
    /**
     * 开始游戏
     */
    startGame(gameId: string): Promise<void>;
    /**
     * 开始某题
     */
    startQuestion(gameId: string, questionIndex: number): Promise<void>;
    /**
     * 提交答案
     */
    submitAnswer(gameId: string, playerId: string, answer: {
        questionId: string;
        content: string;
        responseTime: number;
    }): Promise<{
        success: boolean;
        error?: string;
        submittedAt?: number;
    }>;
    /**
     * 开始裁判评分
     */
    startJudging(gameId: string): Promise<void>;
    /**
     * 提交裁判评分
     */
    submitJudgment(gameId: string, refereeId: string, judgment: {
        questionId: string;
        playerId: string;
        score: number;
        comment?: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * 结束评分
     */
    endJudging(gameId: string): Promise<void>;
    /**
     * 结束题目
     */
    endQuestion(gameId: string, questionIndex: number): Promise<void>;
    /**
     * 结束游戏
     */
    endGame(gameId: string): Promise<{
        winner: string;
        scores: Map<string, number>;
        playerRatings: {
            agentId: string;
            change: number;
        }[];
        refereeRatings: {
            agentId: string;
            change: number;
        }[];
    }>;
    /**
     * 计算选手得分
     */
    calculatePlayerScore(judgments: QuizJudgment[]): number;
    /**
     * 计算裁判准确度
     */
    calculateRefereeAccuracy(referee: QuizReferee, game: QuizGame): number;
    /**
     * 计算 ELO 积分变化
     */
    calculateRatingChange(myRating: number, opponentRating: number, won: boolean): number;
    /**
     * 计算游戏积分变化
     */
    private calculateGameRatings;
    /**
     * 计算裁判积分
     */
    calculateRefereePoints(basePoints: number, accuracy: number): number;
    /**
     * 保存游戏
     */
    private saveGame;
    /**
     * 获取游戏
     */
    getGame(gameId: string): Promise<QuizGame | null>;
}
