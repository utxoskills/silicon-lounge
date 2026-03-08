/**
 * 整合后的房间和事件路由
 * 包含：房间管理、SSE事件、聊天、论坛
 */

import { FastifyInstance } from 'fastify';
import { RoomManager } from '../services/room-manager';
import { PermissionedEventSystem } from '../services/permissioned-events';
import { ForumService } from '../services/forum';
import { AIAdapterService } from '../services/ai-adapter';

export async function roomEventRoutes(fastify: FastifyInstance): Promise<void> {
  const roomManager = new RoomManager(fastify.redis);
  const eventSystem = new PermissionedEventSystem(fastify.redis, fastify, roomManager);
  const forumService = new ForumService(fastify.redis, roomManager);
  const aiAdapter = new AIAdapterService(fastify.redis, fastify);

  // ========== 房间管理 ==========

  // 创建房间
  fastify.post('/api/v1/rooms', async (request, reply) => {
    const { name, description, type = 'chat', maxMembers, password } = request.body as any;
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const room = await roomManager.createRoom({
      type,
      name,
      description,
      createdBy: registration.id,
      maxMembers,
      password,
    });

    return { success: true, room };
  });

  // 获取房间列表
  fastify.get('/api/v1/rooms', async (request) => {
    const { type } = request.query as { type?: string };
    const rooms = await roomManager.listRooms(type as any);
    return { rooms };
  });

  // 加入房间
  fastify.post('/api/v1/rooms/:roomId/join', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const { role = 'spectator', password } = request.body as any;
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const result = await roomManager.joinRoom(
      roomId,
      registration.id,
      registration.name || `AI_${registration.id.slice(0, 6)}`,
      role,
      password
    );

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return result;
  });

  // 离开房间
  fastify.post('/api/v1/rooms/:roomId/leave', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    await roomManager.leaveRoom(roomId, registration.id);
    return { success: true };
  });

  // 获取房间成员
  fastify.get('/api/v1/rooms/:roomId/members', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const members = await roomManager.getMembers(roomId);
    return { members };
  });

  // ========== SSE 事件流 ==========

  // 连接事件流（带权限）
  fastify.get('/api/v1/rooms/:roomId/events', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.status(401).send({ error: 'API Key required' });
    }

    const registration = await aiAdapter.validateApiKey(apiKey);
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    // 设置 SSE 头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // 建立连接
    const result = await eventSystem.connect(roomId, registration.id, reply);
    
    if (!result.success) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: result.error })}\n\n`);
      reply.raw.end();
      return;
    }

    // 发送待处理事件
    const pendingEvents = await eventSystem.getPendingEvents(roomId, registration.id);
    for (const event of pendingEvents) {
      reply.raw.write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
    }

    // 保持连接
    return new Promise(() => {});
  });

  // ========== 聊天 ==========

  // 发送聊天消息
  fastify.post('/api/v1/rooms/:roomId/chat', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const { content } = request.body as { content: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.status(401).send({ error: 'API Key required' });
    }

    const registration = await aiAdapter.validateApiKey(apiKey);
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const result = await roomManager.sendChatMessage(roomId, registration.id, content);
    
    if (!result.success) {
      return reply.status(400).send(result);
    }

    return { success: true };
  });

  // 获取聊天历史
  fastify.get('/api/v1/rooms/:roomId/chat', async (request) => {
    const { roomId } = request.params as { roomId: string };
    const { limit = '50' } = request.query as { limit?: string };
    
    const messages = await roomManager.getMessages(roomId, parseInt(limit));
    return { messages };
  });

  // ========== 论坛 ==========

  // 创建话题
  fastify.post('/api/v1/forum/topics', async (request, reply) => {
    const { name, description } = request.body as any;
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const topic = await forumService.createTopic(name, description);
    return { success: true, topic };
  });

  // 获取热门话题
  fastify.get('/api/v1/forum/topics', async () => {
    const topics = await forumService.getHotTopics();
    return { topics };
  });

  // 发布帖子
  fastify.post('/api/v1/forum/posts', async (request, reply) => {
    const { content, title, topicId, roomId } = request.body as any;
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const post = await forumService.createPost({
      authorId: registration.id,
      authorName: registration.name || `AI_${registration.id.slice(0, 6)}`,
      content,
      title,
      topicId,
      roomId,
    });

    return { success: true, post };
  });

  // 获取时间线
  fastify.get('/api/v1/forum/timeline', async (request) => {
    const { limit = '50', offset = '0' } = request.query as any;
    const posts = await forumService.getTimeline(parseInt(limit), parseInt(offset));
    return { posts };
  });

  // 获取话题帖子
  fastify.get('/api/v1/forum/topics/:topicId/posts', async (request) => {
    const { topicId } = request.params as { topicId: string };
    const { limit = '50' } = request.query as any;
    
    const posts = await forumService.getTopicPosts(topicId, parseInt(limit));
    return { posts };
  });

  // 点赞
  fastify.post('/api/v1/forum/posts/:postId/like', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    await forumService.likePost(postId, registration.id);
    return { success: true };
  });

  // 搜索
  fastify.get('/api/v1/forum/search', async (request) => {
    const { q, limit = '20' } = request.query as any;
    const posts = await forumService.searchPosts(q, parseInt(limit));
    return { posts };
  });

  // 获取用户资料
  fastify.get('/api/v1/forum/profile/:aiId', async (request) => {
    const { aiId } = request.params as { aiId: string };
    const profile = await forumService.getProfile(aiId);
    return { profile };
  });

  // 更新用户资料
  fastify.patch('/api/v1/forum/profile', async (request, reply) => {
    const updates = request.body as any;
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    await forumService.updateProfile(registration.id, updates);
    return { success: true };
  });

  // 获取通知
  fastify.get('/api/v1/notifications', async (request, reply) => {
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const notifications = await forumService.getNotifications(registration.id);
    return { notifications };
  });

  // ========== OpenClaw 专区 ==========

  // 获取或创建 OpenClaw 专区
  fastify.get('/api/v1/zones/openclaw', async () => {
    // 检查是否已存在
    const rooms = await roomManager.listRooms('openclaw');
    if (rooms.length > 0) {
      return { room: rooms[0] };
    }

    // 创建新的 OpenClaw 专区
    const room = await roomManager.createOpenClawZone();
    return { room };
  });

  // 创建公共聊天室
  fastify.post('/api/v1/zones/chat', async (request, reply) => {
    const { name, description } = request.body as any;
    const apiKey = request.headers.authorization?.replace('Bearer ', '');

    const registration = await aiAdapter.validateApiKey(apiKey || '');
    if (!registration) {
      return reply.status(401).send({ error: 'Invalid API Key' });
    }

    const room = await roomManager.createPublicChat(name, description);
    return { success: true, room };
  });
}
