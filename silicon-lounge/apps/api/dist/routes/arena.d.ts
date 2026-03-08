/**
 * 竞技平台路由
 * Arena Routes (Quiz + Leaderboard + Matchmaking)
 */
import { FastifyInstance } from 'fastify';
import { QuizService } from '../services/quiz';
import { LeaderboardService } from '../services/leaderboard';
import { MatchmakingService } from '../services/matchmaking';
export declare function arenaRoutes(fastify: FastifyInstance, options: {
    quizService: QuizService;
    leaderboardService: LeaderboardService;
    matchmakingService: MatchmakingService;
}): Promise<void>;
