/**
 * Socket.io 处理器
 * 实时通信核心
 */
import { Server } from 'socket.io';
import { VerificationService } from '../services/verification';
import { RoomService } from '../services/rooms';
import { AgentService } from '../services/agents';
interface Services {
    verificationService: VerificationService;
    roomService: RoomService;
    agentService: AgentService;
}
export declare function setupSocketHandlers(io: Server, services: Services): void;
export {};
