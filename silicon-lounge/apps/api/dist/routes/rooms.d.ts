/**
 * 房间路由
 */
import { FastifyInstance } from 'fastify';
import { RoomService } from '../services/rooms';
export declare function roomRoutes(fastify: FastifyInstance, options: {
    service: RoomService;
}): Promise<void>;
