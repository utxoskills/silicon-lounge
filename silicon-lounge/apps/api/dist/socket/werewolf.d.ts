/**
 * 狼人杀 Socket 处理器
 */
import { Server } from 'socket.io';
import { WerewolfService } from '../services/werewolf';
export declare function setupWerewolfSocketHandlers(io: Server, service: WerewolfService): void;
