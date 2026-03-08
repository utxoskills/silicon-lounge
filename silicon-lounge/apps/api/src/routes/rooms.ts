/**
 * 房间路由
 */

import { FastifyInstance } from 'fastify';
import { RoomService } from '../services/rooms';

export async function roomRoutes(
  fastify: FastifyInstance,
  options: { service: RoomService }
) {
  const { service } = options;

  // 获取所有房间
  fastify.get('/', async () => {
    const rooms = await service.getAllRooms();
    return {
      success: true,
      data: rooms.map(room => ({
        ...room,
        agents: Array.from(room.agents.values()).map(a => ({
          id: a.id,
          name: a.name,
          level: a.level,
        })),
        agentCount: room.agents.size,
      })),
    };
  });

  // 获取单个房间
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const room = await service.getRoom(request.params.id);
    
    if (!room) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        },
      };
    }

    return {
      success: true,
      data: {
        ...room,
        agents: Array.from(room.agents.values()),
        agentCount: room.agents.size,
      },
    };
  });

  // 获取房间消息历史
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/:id/messages', async (request) => {
    const limit = parseInt(request.query.limit || '100');
    const messages = await service.getMessageHistory(request.params.id, limit);
    
    return {
      success: true,
      data: messages,
    };
  });
}