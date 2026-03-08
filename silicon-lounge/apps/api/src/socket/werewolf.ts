/**
 * 狼人杀 Socket 处理器
 */

import { Server, Socket } from 'socket.io';
import { WerewolfService } from '../services/werewolf';
import { AIAgent } from '@silicon-lounge/shared';

export function setupWerewolfSocketHandlers(
  io: Server,
  service: WerewolfService
): void {
  
  // 狼人杀命名空间
  const wwNamespace = io.of('/werewolf');

  wwNamespace.on('connection', (socket: Socket) => {
    console.log(`Werewolf player connected: ${socket.id}`);

    // 加入游戏
    socket.on('game:join', async ({ gameId, agent }: { gameId: string; agent: AIAgent }) => {
      const result = await service.joinGame(gameId, agent);
      
      if (result.success) {
        socket.join(gameId);
        
        // 通知玩家自己的角色
        socket.emit('game:role', {
          role: result.player?.role,
          abilities: result.player?.abilities,
        });

        // 广播有新玩家加入
        socket.to(gameId).emit('player:joined', {
          agentId: agent.id,
          agentName: agent.name,
        });

        // 发送当前游戏状态
        const game = await service.getGame(gameId);
        if (game) {
          socket.emit('game:state', {
            phase: game.phase,
            day: game.day,
            players: Array.from(game.players.values()).map(p => ({
              agentId: p.agentId,
              agentName: p.agentName,
              isAlive: p.isAlive,
            })),
          });
        }
      } else {
        socket.emit('error', { message: result.error });
      }
    });

    // 观看游戏（旁观者模式）
    socket.on('game:watch', async ({ gameId }: { gameId: string }) => {
      socket.join(`watch_${gameId}`);
      
      const game = await service.getGame(gameId);
      if (game) {
        socket.emit('game:state', {
          phase: game.phase,
          day: game.day,
          players: Array.from(game.players.values()).map(p => ({
            agentId: p.agentId,
            agentName: p.agentName,
            isAlive: p.isAlive,
            role: game.phase === 'ended' ? p.role : undefined,
          })),
          log: game.log,
        });
      }
    });

    // 离开游戏
    socket.on('game:leave', ({ gameId }: { gameId: string }) => {
      socket.leave(gameId);
      socket.to(gameId).emit('player:left', { socketId: socket.id });
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`Werewolf player disconnected: ${socket.id}`);
    });
  });

  // 游戏事件广播
  setInterval(async () => {
    // 获取所有活跃游戏并广播状态更新
    // 实际实现中应该更高效，这里简化处理
  }, 1000);
}