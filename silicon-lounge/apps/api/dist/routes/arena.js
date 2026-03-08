"use strict";
/**
 * 竞技平台路由
 * Arena Routes (Quiz + Leaderboard + Matchmaking)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.arenaRoutes = arenaRoutes;
async function arenaRoutes(fastify, options) {
    const { quizService, leaderboardService, matchmakingService } = options;
    // ========== 答题游戏 ==========
    // 创建游戏
    fastify.post('/quiz/create', async (request, reply) => {
        try {
            const { mode, difficulty, totalQuestions } = request.body;
            const game = await quizService.createGame({
                mode,
                difficulty,
                config: { totalQuestions },
            });
            return {
                success: true,
                data: {
                    gameId: game.id,
                    mode: game.mode,
                    difficulty: game.difficulty,
                    totalQuestions: game.questions.length,
                    status: game.status,
                },
            };
        }
        catch (error) {
            reply.status(400);
            return { success: false, error: error.message };
        }
    });
    // 加入游戏
    fastify.post('/quiz/join', async (request, reply) => {
        try {
            const { gameId, agentId, agentName, role } = request.body;
            const result = await quizService.joinGame(gameId, { id: agentId, name: agentName }, role);
            return { success: result.success, error: result.error, role: result.role };
        }
        catch (error) {
            reply.status(400);
            return { success: false, error: error.message };
        }
    });
    // 获取游戏状态
    fastify.get('/quiz/:gameId', async (request) => {
        const game = await quizService.getGame(request.params.gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        return {
            success: true,
            data: {
                id: game.id,
                status: game.status,
                mode: game.mode,
                currentQuestion: game.currentQuestion,
                totalQuestions: game.questions.length,
                players: game.players.map(p => ({
                    agentId: p.agentId,
                    agentName: p.agentName,
                    isReady: p.isReady,
                    totalScore: p.totalScore,
                    status: p.status,
                })),
                referees: game.referees.map(r => ({
                    agentId: r.agentId,
                    agentName: r.agentName,
                    isReady: r.isReady,
                    accuracy: r.accuracy,
                })),
            },
        };
    });
    // ========== 排行榜 ==========
    // 获取排行榜
    fastify.get('/leaderboard', async (request) => {
        const type = (request.query.type || 'overall');
        const limit = parseInt(request.query.limit || '100');
        const agentId = request.query.agentId;
        let result;
        if (agentId) {
            result = await leaderboardService.getLeaderboardWithRank(type, agentId, limit);
        }
        else {
            const entries = await leaderboardService.getLeaderboard(type, limit);
            result = { entries };
        }
        return { success: true, data: result };
    });
    // 获取用户排名
    fastify.get('/leaderboard/rank/:agentId', async (request) => {
        const { agentId } = request.params;
        const type = (request.query.type || 'overall');
        const rank = await leaderboardService.getAgentRank(agentId, type);
        if (!rank) {
            return { success: false, error: 'Agent not found' };
        }
        return {
            success: true,
            data: {
                agentId,
                type,
                rank: rank.rank,
                rating: rank.rating,
            },
        };
    });
    // ========== 匹配系统 ==========
    // 加入匹配队列
    fastify.post('/match/join', async (request, reply) => {
        try {
            const { agentId, gameType, mode, difficulty, rating } = request.body;
            const result = await matchmakingService.joinQueue(agentId, gameType, {
                mode,
                difficulty: difficulty,
                rating,
            });
            return {
                success: true,
                data: {
                    requestId: result.requestId,
                    estimatedTime: result.estimatedTime,
                },
            };
        }
        catch (error) {
            reply.status(400);
            return { success: false, error: error.message };
        }
    });
    // 取消匹配
    fastify.post('/match/cancel', async (request) => {
        const { requestId } = request.body;
        const cancelled = await matchmakingService.cancelMatch(requestId);
        return { success: cancelled };
    });
    // 获取匹配状态
    fastify.get('/match/status/:requestId', async (request) => {
        const status = await matchmakingService.getMatchStatus(request.params.requestId);
        return { success: true, data: status };
    });
}
