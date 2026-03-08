"use strict";
/**
 * Silicon Lounge API Server
 * Complete AI Arena Platform
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
const dotenv_1 = __importDefault(require("dotenv"));
// Routes
const verification_1 = require("./routes/verification");
const rooms_1 = require("./routes/rooms");
const agents_1 = require("./routes/agents");
const werewolf_1 = require("./routes/werewolf");
const arena_1 = require("./routes/arena");
// Socket Handlers
const handlers_1 = require("./socket/handlers");
const werewolf_2 = require("./socket/werewolf");
// Services
const verification_2 = require("./services/verification");
const rooms_2 = require("./services/rooms");
const agents_2 = require("./services/agents");
const werewolf_3 = require("./services/werewolf");
const quiz_1 = require("./services/quiz");
const leaderboard_1 = require("./services/leaderboard");
const matchmaking_1 = require("./services/matchmaking");
dotenv_1.default.config();
const app = (0, fastify_1.default)({
    logger: true,
    trustProxy: true,
});
// 服务实例
let verificationService;
let roomService;
let agentService;
let werewolfService;
let quizService;
let leaderboardService;
let matchmakingService;
// Redis 连接
const pubClient = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subClient = pubClient.duplicate();
async function main() {
    // 注册 CORS
    await app.register(cors_1.default, {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    });
    // 初始化服务
    verificationService = new verification_2.VerificationService(pubClient);
    roomService = new rooms_2.RoomService(pubClient);
    agentService = new agents_2.AgentService(pubClient);
    werewolfService = new werewolf_3.WerewolfService(pubClient);
    quizService = new quiz_1.QuizService(pubClient);
    leaderboardService = new leaderboard_1.LeaderboardService(pubClient);
    matchmakingService = new matchmaking_1.MatchmakingService(pubClient);
    // 初始化默认房间
    await roomService.initializeDefaultRooms();
    // 注册路由
    await app.register(verification_1.verificationRoutes, {
        prefix: '/api/v1/verify',
        service: verificationService
    });
    await app.register(rooms_1.roomRoutes, {
        prefix: '/api/v1/rooms',
        service: roomService
    });
    await app.register(agents_1.agentRoutes, {
        prefix: '/api/v1/agents',
        service: agentService
    });
    await app.register(werewolf_1.werewolfRoutes, {
        prefix: '/api/v1/werewolf',
        service: werewolfService
    });
    await app.register(arena_1.arenaRoutes, {
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
    const io = new socket_io_1.Server({
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });
    // 使用 Redis Adapter
    io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
    // 设置 Socket 处理器
    (0, handlers_1.setupSocketHandlers)(io, {
        verificationService,
        roomService,
        agentService,
    });
    // 设置狼人杀 Socket 处理器
    (0, werewolf_2.setupWerewolfSocketHandlers)(io, werewolfService);
    const wsPort = parseInt(process.env.WS_PORT || '8081');
    io.listen(wsPort);
    app.log.info(`WebSocket Server: ws://localhost:${wsPort}`);
}
main().catch((err) => {
    app.log.error(err);
    process.exit(1);
});
