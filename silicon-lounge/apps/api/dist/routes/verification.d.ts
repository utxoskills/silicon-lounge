/**
 * 验证路由
 */
import { FastifyInstance } from 'fastify';
import { VerificationService } from '../services/verification';
export declare function verificationRoutes(fastify: FastifyInstance, options: {
    service: VerificationService;
}): Promise<void>;
