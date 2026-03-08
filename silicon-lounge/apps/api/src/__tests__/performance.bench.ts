import { bench, describe } from 'vitest';
import { VerificationService } from '../services/verification';
import { RoomService } from '../services/rooms';
import { Redis } from 'ioredis';
import { AIFingerprint, VerificationLevel } from '@silicon-lounge/shared';

// 使用真实的 Redis 进行基准测试
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const mockFingerprint: AIFingerprint = {
  id: 'bench-ai',
  model: 'BenchModel/1.0',
  version: '1.0.0',
  capabilities: ['code-generation', 'tool-use'],
  avgResponseTime: 50,
  maxContextWindow: 128000,
  supportsTools: true,
  supportsVision: false,
};

describe('VerificationService Performance', () => {
  const service = new VerificationService(redis);

  bench('startSession - basic', async () => {
    await service.startSession(mockFingerprint, 'basic');
  }, { iterations: 1000 });

  bench('startSession - advanced', async () => {
    await service.startSession(mockFingerprint, 'advanced');
  }, { iterations: 1000 });

  bench('startSession - openclaw', async () => {
    await service.startSession(mockFingerprint, 'openclaw');
  }, { iterations: 1000 });

  bench('batchStartSessions - 10 sessions', async () => {
    const requests = Array(10).fill(null).map(() => ({
      fingerprint: mockFingerprint,
      level: 'basic' as VerificationLevel,
    }));
    await service.batchStartSessions(requests);
  }, { iterations: 100 });

  bench('batchStartSessions - 100 sessions', async () => {
    const requests = Array(100).fill(null).map(() => ({
      fingerprint: mockFingerprint,
      level: 'basic' as VerificationLevel,
    }));
    await service.batchStartSessions(requests);
  }, { iterations: 10 });

  bench('verifyToken - cached', async () => {
    // 先创建一个 token
    const { token } = await service.submitChallenge('session', []);
    // 多次验证（应该命中缓存）
    for (let i = 0; i < 100; i++) {
      await service.verifyToken(token!);
    }
  }, { iterations: 10 });
});

describe('RoomService Performance', () => {
  const service = new RoomService(redis);

  bench('getRoomMetadata - cached', async () => {
    await service.getRoomMetadata('general');
  }, { iterations: 10000 });

  bench('getOnlineCount', async () => {
    await service.getOnlineCount('general');
  }, { iterations: 10000 });

  bench('addMessage', async () => {
    const message = {
      id: `msg_${Date.now()}`,
      type: 'text' as const,
      roomId: 'general',
      agentId: 'bench-agent',
      agentName: 'BenchAgent',
      content: 'Benchmark message',
      metadata: { responseTime: 50, tokens: 10 },
      timestamp: Date.now(),
    };
    await service.addMessage('general', message);
  }, { iterations: 1000 });

  bench('batchAddMessages - 10 messages', async () => {
    const messages = Array(10).fill(null).map((_, i) => ({
      id: `msg_${Date.now()}_${i}`,
      type: 'text' as const,
      roomId: 'general',
      agentId: 'bench-agent',
      agentName: 'BenchAgent',
      content: `Message ${i}`,
      metadata: { responseTime: 50, tokens: 10 },
      timestamp: Date.now(),
    }));
    await service.batchAddMessages('general', messages);
  }, { iterations: 100 });

  bench('getRecentMessages - 100', async () => {
    await service.getRecentMessages('general', 100);
  }, { iterations: 1000 });
});

describe('Concurrent Load', () => {
  const verificationService = new VerificationService(redis);
  const roomService = new RoomService(redis);

  bench('100 concurrent verifications', async () => {
    const promises = Array(100).fill(null).map(() =>
      verificationService.startSession(mockFingerprint, 'basic')
    );
    await Promise.all(promises);
  }, { iterations: 10 });

  bench('1000 concurrent room joins', async () => {
    const agents = Array(1000).fill(null).map((_, i) => ({
      id: `agent-${i}`,
      fingerprint: mockFingerprint,
      name: `Agent-${i}`,
      level: 'basic' as VerificationLevel,
      verifiedAt: new Date(),
      lastSeen: new Date(),
      totalMessages: 0,
      rooms: [],
      metadata: { preferredLanguage: 'zh-CN', interests: [] },
    }));
    
    await roomService.batchJoinRoom('general', agents);
  }, { iterations: 1 });
});