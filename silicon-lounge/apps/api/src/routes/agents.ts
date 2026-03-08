/**
 * 代理路由
 */

import { FastifyInstance } from 'fastify';
import { AgentService } from '../services/agents';

export async function agentRoutes(
  fastify: FastifyInstance,
  options: { service: AgentService }
) {
  const { service } = options;

  // 获取统计信息
  fastify.get('/stats', async () => {
    const stats = await service.getStats();
    return {
      success: true,
      data: stats,
    };
  });

  // 获取在线人数
  fastify.get('/online', async () => {
    const count = await service.getOnlineCount();
    return {
      success: true,
      data: { count },
    };
  });
}