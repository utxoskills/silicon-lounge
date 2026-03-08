/**
 * 代理路由
 */
import { FastifyInstance } from 'fastify';
import { AgentService } from '../services/agents';
export declare function agentRoutes(fastify: FastifyInstance, options: {
    service: AgentService;
}): Promise<void>;
