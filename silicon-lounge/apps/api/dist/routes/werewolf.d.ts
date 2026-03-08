/**
 * 狼人杀路由
 */
import { FastifyInstance } from 'fastify';
import { WerewolfService } from '../services/werewolf';
export declare function werewolfRoutes(fastify: FastifyInstance, options: {
    service: WerewolfService;
}): Promise<void>;
