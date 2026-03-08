"use strict";
/**
 * Socket.io 处理器
 * 实时通信核心
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
function setupSocketHandlers(io, services) {
    const { verificationService, roomService, agentService } = services;
    // 中间件：验证 token
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        const verified = await verificationService.verifyToken(token);
        if (!verified.valid) {
            return next(new Error('Invalid or expired token'));
        }
        // 将验证信息附加到 socket
        socket.data.agentId = verified.fingerprint?.id;
        socket.data.level = verified.level;
        socket.data.fingerprint = verified.fingerprint;
        next();
    });
    io.on('connection', (socket) => {
        console.log(`AI connected: ${socket.data.agentId}`);
        // ========== 房间管理 ==========
        socket.on('agent:join', async ({ roomId, agent }) => {
            try {
                // 验证权限
                if (agent.level !== socket.data.level) {
                    socket.emit('error', { message: 'Level mismatch' });
                    return;
                }
                const result = await roomService.joinRoom(roomId, agent);
                if (!result.success) {
                    socket.emit('error', { message: result.error });
                    return;
                }
                // 加入 socket room
                await socket.join(roomId);
                // 更新 socket ID
                await roomService.updateAgentSocket(roomId, agent.id, socket.id);
                // 通知房间内其他人
                socket.to(roomId).emit('agent:joined', {
                    roomId,
                    agent: {
                        ...agent,
                        socketId: undefined, // 不暴露 socket ID
                    },
                });
                // 发送当前房间成员列表
                const agents = await roomService.getOnlineAgents(roomId);
                socket.emit('agent:list', { roomId, agents });
                // 发送历史消息
                const history = await roomService.getMessageHistory(roomId, 50);
                socket.emit('message:history', { roomId, messages: history });
                console.log(`Agent ${agent.name} joined room ${roomId}`);
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        socket.on('agent:leave', async ({ roomId, agentId }) => {
            try {
                await roomService.leaveRoom(roomId, agentId);
                await socket.leave(roomId);
                socket.to(roomId).emit('agent:left', { roomId, agentId });
                console.log(`Agent ${agentId} left room ${roomId}`);
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        // ========== 消息处理 ==========
        socket.on('message:send', async ({ roomId, message }) => {
            try {
                const fullMessage = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: message.type || 'text',
                    roomId,
                    agentId: socket.data.agentId,
                    agentName: message.agentName || 'Unknown',
                    content: message.content,
                    metadata: {
                        responseTime: message.metadata?.responseTime || 0,
                        tokens: message.metadata?.tokens || 0,
                        model: socket.data.fingerprint?.model,
                        toolsUsed: message.metadata?.toolsUsed,
                        confidence: message.metadata?.confidence,
                        reasoningSteps: message.metadata?.reasoningSteps,
                    },
                    timestamp: Date.now(),
                    replyTo: message.replyTo,
                };
                // 保存消息
                await roomService.addMessage(roomId, fullMessage);
                // 增加代理消息计数
                await agentService.incrementMessageCount(socket.data.agentId);
                // 广播给房间所有人（包括自己）
                io.to(roomId).emit('message:received', { roomId, message: fullMessage });
            }
            catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        socket.on('message:typing', ({ roomId, agentId }) => {
            socket.to(roomId).emit('agent:typing', { roomId, agentId });
        });
        // ========== 协作任务 ==========
        socket.on('collaboration:join', async ({ taskId }) => {
            // 加入协作任务房间
            await socket.join(`task:${taskId}`);
            socket.to(`task:${taskId}`).emit('collaboration:agent-joined', {
                taskId,
                agentId: socket.data.agentId,
            });
        });
        socket.on('collaboration:update', async ({ taskId, progress }) => {
            socket.to(`task:${taskId}`).emit('collaboration:progress', {
                taskId,
                agentId: socket.data.agentId,
                progress,
            });
        });
        // ========== 断开连接 ==========
        socket.on('disconnect', async () => {
            console.log(`AI disconnected: ${socket.data.agentId}`);
            // 从所有房间移除
            const rooms = Array.from(socket.rooms);
            for (const roomId of rooms) {
                if (roomId !== socket.id) { // 排除 socket 自己的 room
                    await roomService.leaveRoom(roomId, socket.data.agentId);
                    socket.to(roomId).emit('agent:left', {
                        roomId,
                        agentId: socket.data.agentId,
                    });
                }
            }
        });
    });
}
