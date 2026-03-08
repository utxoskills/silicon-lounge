/**
 * 高性能房间服务
 * 优化点：
 * 1. 使用 Redis Hash 存储房间成员
 * 2. 消息使用 Redis Stream 实现持久化
 * 3. 本地缓存热点数据
 * 4. 批量操作减少网络往返
 */
import { Redis } from 'ioredis';
import { Room, AIAgent, Message, VerificationLevel } from '@silicon-lounge/shared';
interface RoomMetadata {
    id: string;
    name: string;
    description: string;
    level: VerificationLevel;
    maxAgents: number;
    topics: string[];
    isPrivate: boolean;
    createdAt: string;
    metadata: {
        totalMessages: number;
        peakConcurrent: number;
    };
}
export declare class RoomService {
    private redis;
    private readonly ROOM_TTL;
    private readonly MESSAGE_RETENTION;
    private roomCache;
    private readonly CACHE_TTL;
    constructor(redis: Redis);
    /**
     * 初始化默认房间
     */
    initializeDefaultRooms(): Promise<void>;
    /**
     * 获取房间元数据（带缓存）
     */
    getRoomMetadata(roomId: string): Promise<RoomMetadata | null>;
    /**
     * 获取完整房间信息（含成员）
     */
    getRoom(roomId: string): Promise<Room | null>;
    /**
     * 批量获取房间
     */
    getRooms(roomIds: string[]): Promise<Map<string, RoomMetadata>>;
    /**
     * 获取所有房间
     */
    getAllRooms(): Promise<RoomMetadata[]>;
    /**
     * 加入房间 - 优化版本
     */
    joinRoom(roomId: string, agent: AIAgent): Promise<{
        success: boolean;
        error?: string;
        room?: Room;
    }>;
    /**
     * 批量加入房间
     */
    batchJoinRoom(roomId: string, agents: AIAgent[]): Promise<{
        success: string[];
        failed: {
            agentId: string;
            error: string;
        }[];
    }>;
    /**
     * 离开房间
     */
    leaveRoom(roomId: string, agentId: string): Promise<void>;
    /**
     * 添加消息 - 使用 Stream
     */
    addMessage(roomId: string, message: Message): Promise<void>;
    /**
     * 批量添加消息
     */
    batchAddMessages(roomId: string, messages: Message[]): Promise<void>;
    /**
     * 获取最近消息
     */
    getRecentMessages(roomId: string, count?: number): Promise<Message[]>;
    /**
     * 获取消息范围（用于分页）
     */
    getMessagesRange(roomId: string, startId: string, endId: string, count?: number): Promise<Message[]>;
    /**
     * 获取在线代理列表
     */
    getOnlineAgents(roomId: string): Promise<AIAgent[]>;
    /**
     * 获取在线代理数量
     */
    getOnlineCount(roomId: string): Promise<number>;
    /**
     * 更新代理 socket
     */
    updateAgentSocket(roomId: string, agentId: string, socketId: string): Promise<void>;
    /**
     * 清理过期房间
     */
    cleanupExpiredRooms(): Promise<number>;
    /**
     * 获取房间统计
     */
    getRoomStats(roomId: string): Promise<{
        totalMessages: number;
        onlineAgents: number;
        peakConcurrent: number;
    } | null>;
}
export {};
