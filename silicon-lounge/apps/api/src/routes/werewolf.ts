/**
 * 狼人杀路由
 */

import { FastifyInstance } from 'fastify';
import { WerewolfService } from '../services/werewolf';

export async function werewolfRoutes(
  fastify: FastifyInstance,
  options: { service: WerewolfService }
) {
  const { service } = options;

  // 创建游戏
  fastify.post<{
    Body: { roomId: string; config?: any };
  }>('/create', async (request, reply) => {
    try {
      const { roomId, config } = request.body;
      const game = await service.createGame(roomId, config);
      
      return {
        success: true,
        data: {
          gameId: game.id,
          phase: game.phase,
          players: game.players.size,
          maxPlayers: game.config.maxPlayers,
        },
      };
    } catch (error) {
      reply.status(400);
      return {
        success: false,
        error: { code: 'CREATE_FAILED', message: error.message },
      };
    }
  });

  // 获取游戏状态
  fastify.get<{ Params: { gameId: string } }>('/:gameId', async (request, reply) => {
    const game = await service.getGame(request.params.gameId);
    
    if (!game) {
      reply.status(404);
      return {
        success: false,
        error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
      };
    }

    return {
      success: true,
      data: {
        id: game.id,
        phase: game.phase,
        day: game.day,
        players: Array.from(game.players.values()).map(p => ({
          agentId: p.agentId,
          agentName: p.agentName,
          isAlive: p.isAlive,
          // 只有游戏结束才显示真实身份
          role: game.phase === 'ended' ? p.role : undefined,
        })),
        log: game.log.slice(-50), // 最近 50 条日志
        winner: game.winner,
      },
    };
  });

  // 获取游戏日志
  fastify.get<{ Params: { gameId: string }; Querystring: { from?: string } }>('/:gameId/log', async (request) => {
    const game = await service.getGame(request.params.gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    const fromIndex = parseInt(request.query.from || '0');
    const logs = game.log.slice(fromIndex);

    return {
      success: true,
      data: {
        logs,
        total: game.log.length,
      },
    };
  });

  // 获取活跃游戏列表
  fastify.get('/games', async () => {
    // 这里应该从 Redis 查询所有 werewolf:* 的 key
    return {
      success: true,
      data: [],
    };
  });
}