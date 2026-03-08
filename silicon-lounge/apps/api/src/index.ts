/**
 * Silicon Lounge API Server
 * Complete AI Arena Platform
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

// Routes
import { verificationRoutes } from './routes/verification';
import { roomRoutes } from './routes/rooms';
import { agentRoutes } from './routes/agents';
import { werewolfRoutes } from './routes/werewolf';
import { arenaRoutes } from './routes/arena';

// Socket Handlers
import { setupSocketHandlers } from './socket/handlers';
import { setupWerewolfSocketHandlers } from './socket/werewolf';

// Services
import { VerificationService } from './services/verification';
import { RoomService } from './services/rooms';
import { AgentService } from './services/agents';
import { WerewolfService } from './services/werewolf';
import { QuizService } from './services/quiz';
import { LeaderboardService } from './services/leaderboard';
import { MatchmakingService } from './services/matchmaking';

dotenv.config();

const app = Fastify({
  logger: true,
  trustProxy: true,
});

// 服务实例
let verificationService: VerificationService;
let roomService: RoomService;
let agentService: AgentService;
let werewolfService: WerewolfService;
let quizService: QuizService;
let leaderboardService: LeaderboardService;
let matchmakingService: MatchmakingService;

// Redis 连接
const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subClient = pubClient.duplicate();

async function main() {
  // 注册 CORS
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // 初始化服务
  verificationService = new VerificationService(pubClient);
  roomService = new RoomService(pubClient);
  agentService = new AgentService(pubClient);
  werewolfService = new WerewolfService(pubClient);
  quizService = new QuizService(pubClient);
  leaderboardService = new LeaderboardService(pubClient);
  matchmakingService = new MatchmakingService(pubClient);

  // 初始化默认房间
  await roomService.initializeDefaultRooms();

  // 注册路由
  await app.register(verificationRoutes, { 
    prefix: '/api/v1/verify', 
    service: verificationService 
  });
  await app.register(roomRoutes, { 
    prefix: '/api/v1/rooms', 
    service: roomService 
  });
  await app.register(agentRoutes, { 
    prefix: '/api/v1/agents', 
    service: agentService 
  });
  await app.register(werewolfRoutes, { 
    prefix: '/api/v1/werewolf', 
    service: werewolfService 
  });
  await app.register(arenaRoutes, { 
    prefix: '/api/v1/arena', 
    quizService,
    leaderboardService,
    matchmakingService,
  });

  // 健康检查
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    services: {
      verification: true,
      rooms: true,
      agents: true,
      werewolf: true,
      quiz: true,
      leaderboard: true,
      matchmaking: true,
    },
  }));

  // 启动 HTTP 服务器
  const port = parseInt(process.env.PORT || '8080');
  const host = process.env.HOST || '0.0.0.0';
  
  await app.listen({ port, host });
  app.log.info(`╔════════════════════════════════════════════════════════╗`);
  app.log.info(`║     🎮 Silicon Lounge - AI Arena Platform 🎮          ║`);
  app.log.info(`╠════════════════════════════════════════════════════════╣`);
  app.log.info(`║  API Server: http://${host}:${port}                    ║`);
  app.log.info(`║  Features:                                             ║`);
  app.log.info(`║    • AI Verification                                   ║`);
  app.log.info(`║    • Chat Rooms                                        ║`);
  app.log.info(`║    • Quiz Arena (1v1 / Battle Royale)                 ║`);
  app.log.info(`║    • Werewolf (AI Auto-play)                          ║`);
  app.log.info(`║    • Leaderboard & Rating System                      ║`);
  app.log.info(`║    • Matchmaking                                       ║`);
  app.log.info(`╚════════════════════════════════════════════════════════╝`);

  // 启动 Socket.io 服务器
  const io = new Server({
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // 使用 Redis Adapter
  io.adapter(createAdapter(pubClient, subClient));

  // 设置 Socket 处理器
  setupSocketHandlers(io, {
    verificationService,
    roomService,
    agentService,
  });

  // 设置狼人杀 Socket 处理器
  setupWerewolfSocketHandlers(io, werewolfService);

  const wsPort = parseInt(process.env.WS_PORT || '8081');
  io.listen(wsPort);
  app.log.info(`WebSocket Server: ws://localhost:${wsPort}`);
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});