/**
 * AI 接入路由
 * SSE 事件流 + HTTP POST 动作提交
 */

import { FastifyInstance } from 'fastify';
import { AIAdapterService } from '../services/ai-adapter';

export async function aiAdapterRoutes(fastify: FastifyInstance): Promise<void> {
  const aiAdapter = new AIAdapterService(fastify.redis, fastify);

  // 1. AI 注册
  fastify.post('/api/v1/ai/register', async (request, reply) => {
    const { name } = request.body as { name: string };
    
    if (!name) {
      return reply.status(400).send({ error: 'Name required' });
    }

    const { aiId, apiKey } = await aiAdapter.registerAI(name);
    
    return {
      success: true,
      aiId,
      apiKey,
      message: '保存好你的 API Key，只显示一次',
    };
  });

  // 2. SSE 连接 - 接收游戏事件
  fastify.get('/api/v1/games/:gameId/events', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.status(401).send({ error: 'API Key required' });
    }

    const registration = await aiAdapter.validateApiKey(apiKey);
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    // 检查 AI 是否在游戏中
    const gameAI = await fastify.redis.get(`game:${gameId}:ai:${registration.id}`);
    if (!gameAI) {
      return reply.status(403).send({ error: 'Not in this game' });
    }

    // 设置 SSE 头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // 建立 SSE 连接
    await aiAdapter.connectSSE(gameId, registration.id, reply);

    // 发送待处理事件（重连时）
    const pendingEvents = await aiAdapter.getPendingEvents(gameId, registration.id);
    for (const event of pendingEvents) {
      reply.raw.write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
    }

    // 保持连接
    return new Promise(() => {});
  });

  // 3. 提交动作
  fastify.post('/api/v1/games/:gameId/actions', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');
    const { type, data, eventId } = request.body as {
      type: string;
      data: any;
      eventId?: string;
    };

    if (!apiKey) {
      return reply.status(401).send({ error: 'API Key required' });
    }

    const registration = await aiAdapter.validateApiKey(apiKey);
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const result = await aiAdapter.receiveAction(gameId, registration.id, {
      type,
      data,
      eventId,
    });

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return { success: true };
  });

  // 4. 心跳
  fastify.post('/api/v1/games/:gameId/ping', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.status(401).send({ error: 'API Key required' });
    }

    const registration = await aiAdapter.validateApiKey(apiKey);
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    await aiAdapter.updatePing(gameId, registration.id);
    return { success: true };
  });

  // 5. 获取游戏状态（备用，SSE 断线时）
  fastify.get('/api/v1/games/:gameId/state', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.status(401).send({ error: 'API Key required' });
    }

    const registration = await aiAdapter.validateApiKey(apiKey);
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    // 获取游戏状态（根据游戏类型）
    const quizGame = await fastify.redis.get(`quiz:game:${gameId}`);
    if (quizGame) {
      return JSON.parse(quizGame);
    }

    const werewolfState = await fastify.redis.get(`werewolf:state:${gameId}`);
    if (werewolfState) {
      return JSON.parse(werewolfState);
    }

    return reply.status(404).send({ error: 'Game not found' });
  });
}
