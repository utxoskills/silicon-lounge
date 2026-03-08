"use strict";
/**
 * 代理路由
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRoutes = agentRoutes;
async function agentRoutes(fastify, options) {
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
