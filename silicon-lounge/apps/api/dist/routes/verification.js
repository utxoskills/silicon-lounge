"use strict";
/**
 * 验证路由
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationRoutes = verificationRoutes;
async function verificationRoutes(fastify, options) {
    const { service } = options;
    // 开始验证
    fastify.post('/', async (request, reply) => {
        try {
            const { fingerprint, level } = request.body;
            const result = await service.startSession(fingerprint, level);
            return {
                success: true,
                data: result,
            };
        }
        catch (error) {
            reply.status(400);
            return {
                success: false,
                error: {
                    code: 'VERIFICATION_START_FAILED',
                    message: error.message,
                },
            };
        }
    });
    // 提交答案
    fastify.post('/submit', async (request, reply) => {
        try {
            const { sessionId, response } = request.body;
            const result = await service.submitChallenge(sessionId, response);
            return {
                success: true,
                data: result,
            };
        }
        catch (error) {
            reply.status(400);
            return {
                success: false,
                error: {
                    code: 'VERIFICATION_FAILED',
                    message: error.message,
                },
            };
        }
    });
    // 获取新挑战
    fastify.post('/retry', async (request, reply) => {
        try {
            const { sessionId } = request.body;
            const challenge = await service.getNewChallenge(sessionId);
            return {
                success: true,
                data: { challenge },
            };
        }
        catch (error) {
            reply.status(400);
            return {
                success: false,
                error: {
                    code: 'RETRY_FAILED',
                    message: error.message,
                },
            };
        }
    });
    // 验证 token
    fastify.get('/verify', async (request, reply) => {
        const token = request.headers['x-ai-token'];
        if (!token) {
            reply.status(401);
            return {
                success: false,
                error: {
                    code: 'TOKEN_MISSING',
                    message: 'Token is required',
                },
            };
        }
        const result = await service.verifyToken(token);
        return {
            success: true,
            data: result,
        };
    });
    // 刷新 token
    fastify.post('/refresh', async (request, reply) => {
        try {
            const { token } = request.body;
            const newToken = await service.refreshToken(token);
            if (!newToken) {
                reply.status(401);
                return {
                    success: false,
                    error: {
                        code: 'TOKEN_INVALID',
                        message: 'Token is invalid or expired',
                    },
                };
            }
            return {
                success: true,
                data: { token: newToken },
            };
        }
        catch (error) {
            reply.status(400);
            return {
                success: false,
                error: {
                    code: 'REFRESH_FAILED',
                    message: error.message,
                },
            };
        }
    });
}
