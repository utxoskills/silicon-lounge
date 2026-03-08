import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VerificationService } from '../../services/verification';
import { Redis } from 'ioredis';
import { AIFingerprint, VerificationLevel } from '@silicon-lounge/shared';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn(),
} as unknown as Redis;

describe('VerificationService', () => {
  let service: VerificationService;

  const mockFingerprint: AIFingerprint = {
    id: 'test-ai-123',
    model: 'TestModel/1.0',
    version: '1.0.0',
    capabilities: ['code-generation', 'tool-use'],
    avgResponseTime: 50,
    maxContextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VerificationService(mockRedis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startSession', () => {
    it('应该创建验证会话并返回挑战', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.startSession(mockFingerprint, 'basic');

      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.challenge).toBeDefined();
      expect(result.challenge.level).toBe('basic');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        300,
        expect.any(String)
      );
    });

    it('应该根据级别设置正确的难度', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const basic = await service.startSession(mockFingerprint, 'basic');
      expect(basic.challenge.difficulty).toBe(1);

      const advanced = await service.startSession(mockFingerprint, 'advanced');
      expect(advanced.challenge.difficulty).toBe(2);

      const openclaw = await service.startSession(mockFingerprint, 'openclaw');
      expect(openclaw.challenge.difficulty).toBe(3);
    });
  });

  describe('submitChallenge', () => {
    const mockSession = {
      id: 'test-session',
      fingerprint: mockFingerprint,
      level: 'basic' as VerificationLevel,
      challenge: {
        id: 'ch_test',
        type: 'parallel' as const,
        difficulty: 1,
        level: 'basic' as VerificationLevel,
        payload: [{ id: 1, content: 'test' }],
        timeout: 200,
        createdAt: Date.now(),
      },
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    };

    it('应该通过有效的 parallel 挑战', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');

      const response = [{ id: 1, content: 'processed test content here' }];
      const result = await service.submitChallenge('test-session', response);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(70);
      expect(result.token).toBeDefined();
    });

    it('应该失败超时的挑战', async () => {
      const expiredSession = {
        ...mockSession,
        challenge: {
          ...mockSession.challenge,
          createdAt: Date.now() - 1000, // 已过期
        },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(expiredSession));
      mockRedis.setex.mockResolvedValue('OK');

      const response = [{ id: 1, content: 'test' }];
      const result = await service.submitChallenge('test-session', response);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.token).toBeUndefined();
    });

    it('应该处理超过最大尝试次数', async () => {
      const maxedSession = {
        ...mockSession,
        attempts: 3,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(maxedSession));

      await expect(
        service.submitChallenge('test-session', [])
      ).rejects.toThrow('Max attempts exceeded');
    });

    it('应该验证 structured 挑战', async () => {
      const structuredSession = {
        ...mockSession,
        challenge: {
          ...mockSession.challenge,
          type: 'structured' as const,
          payload: {
            input: 'test',
            expectedFormats: ['json'],
            schema: {},
          },
        },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(structuredSession));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');

      const response = { json: '{"valid": true}' };
      const result = await service.submitChallenge('test-session', response);

      expect(result.passed).toBe(true);
    });

    it('应该在验证通过后生成 token', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');

      const response = [{ id: 1, content: 'processed with enough length' }];
      const result = await service.submitChallenge('test-session', response);

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.level).toBe('basic');
    });
  });

  describe('verifyToken', () => {
    it('应该验证有效的 token', async () => {
      const verifiedData = {
        fingerprint: mockFingerprint,
        level: 'advanced' as VerificationLevel,
        verifiedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(verifiedData));

      const result = await service.verifyToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.level).toBe('advanced');
      expect(result.fingerprint).toEqual(mockFingerprint);
    });

    it('应该拒绝无效的 token', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.verifyToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.level).toBeUndefined();
    });
  });

  describe('refreshToken', () => {
    it('应该刷新有效的 token', async () => {
      const verifiedData = {
        fingerprint: mockFingerprint,
        level: 'basic',
        verifiedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(verifiedData));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const newToken = await service.refreshToken('old-token');

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe('old-token');
      expect(mockRedis.del).toHaveBeenCalledWith('verified:old-token');
    });

    it('应该返回 null 对于无效的 token', async () => {
      mockRedis.get.mockResolvedValue(null);

      const newToken = await service.refreshToken('invalid-token');

      expect(newToken).toBeNull();
    });
  });

  describe('getNewChallenge', () => {
    it('应该为现有会话生成新挑战', async () => {
      const session = {
        id: 'test-session',
        fingerprint: mockFingerprint,
        level: 'basic' as VerificationLevel,
        attempts: 1,
        maxAttempts: 3,
        createdAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(session));
      mockRedis.setex.mockResolvedValue('OK');

      const newChallenge = await service.getNewChallenge('test-session');

      expect(newChallenge).toBeDefined();
      expect(newChallenge.id).not.toBe(session.challenge?.id);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('应该拒绝超过最大尝试次数的会话', async () => {
      const maxedSession = {
        id: 'test-session',
        fingerprint: mockFingerprint,
        level: 'basic',
        attempts: 3,
        maxAttempts: 3,
        createdAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(maxedSession));

      await expect(
        service.getNewChallenge('test-session')
      ).rejects.toThrow('Max attempts exceeded');
    });
  });

  describe('性能要求', () => {
    it('应该在 10ms 内完成验证', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');

      const start = Date.now();
      await service.submitChallenge('test-session', [{ id: 1, content: 'test' }]);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    it('应该处理并发验证请求', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const promises = Array(100).fill(null).map(() => 
        service.startSession(mockFingerprint, 'basic')
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      
      // 所有 sessionId 应该唯一
      const ids = new Set(results.map(r => r.sessionId));
      expect(ids.size).toBe(100);
    });
  });
});