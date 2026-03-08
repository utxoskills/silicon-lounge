import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizService } from '../../services/quiz';
import { Redis } from 'ioredis';
import { AIAgent, QuizDifficulty, QuizMode } from '@silicon-lounge/shared';

const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  hset: vi.fn(),
  hget: vi.fn(),
  hgetall: vi.fn(),
  zadd: vi.fn(),
  zrevrange: vi.fn(),
  zrank: vi.fn(),
  pipeline: vi.fn(() => ({
    setex: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    hincrby: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
} as unknown as Redis;

describe('QuizService', () => {
  let service: QuizService;

  const createMockAgent = (id: string, name: string): AIAgent => ({
    id,
    fingerprint: {
      id: `fp-${id}`,
      model: 'TestModel',
      version: '1.0',
      capabilities: ['reasoning', 'knowledge'],
      avgResponseTime: 100,
      maxContextWindow: 32000,
      supportsTools: true,
      supportsVision: false,
    },
    name,
    level: 'advanced',
    verifiedAt: new Date(),
    lastSeen: new Date(),
    totalMessages: 0,
    rooms: [],
    metadata: { preferredLanguage: 'zh-CN', interests: [] },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuizService(mockRedis);
  });

  describe('createGame', () => {
    it('应该创建答题游戏', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame({
        mode: '1v1' as QuizMode,
        difficulty: 'medium' as QuizDifficulty,
        config: {
          questionTime: 30,
          judgeTime: 15,
          totalQuestions: 5,
        },
      });

      expect(game).toBeDefined();
      expect(game.id).toMatch(/^quiz_/);
      expect(game.mode).toBe('1v1');
      expect(game.difficulty).toBe('medium');
      expect(game.status).toBe('waiting');
      expect(game.questions).toHaveLength(5);
    });

    it('应该生成正确数量的题目', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame({
        mode: 'battle_royale',
        difficulty: 'hard',
        config: { totalQuestions: 10 },
      });

      expect(game.questions).toHaveLength(10);
    });

    it('题目难度应该匹配设置', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const easyGame = await service.createGame({
        mode: '1v1',
        difficulty: 'easy',
      });

      const hardGame = await service.createGame({
        mode: '1v1',
        difficulty: 'hard',
      });

      const easyAvg = easyGame.questions.reduce((sum, q) => sum + q.difficulty, 0) / easyGame.questions.length;
      const hardAvg = hardGame.questions.reduce((sum, q) => sum + q.difficulty, 0) / hardGame.questions.length;

      expect(hardAvg).toBeGreaterThan(easyAvg);
    });
  });

  describe('joinGame', () => {
    it('应该允许选手加入', async () => {
      const mockGame = {
        id: 'quiz_test',
        mode: '1v1',
        status: 'waiting',
        players: [],
        referees: [],
        questions: [],
        currentQuestion: 0,
        config: { totalQuestions: 5 },
        scores: new Map(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));
      mockRedis.setex.mockResolvedValue('OK');

      const agent = createMockAgent('ai-1', 'Player-1');
      const result = await service.joinGame('quiz_test', agent, 'player');

      expect(result.success).toBe(true);
      expect(result.role).toBe('player');
    });

    it('应该允许裁判加入', async () => {
      const mockGame = {
        id: 'quiz_test',
        mode: '1v1',
        status: 'waiting',
        players: [{ agentId: 'p1' }, { agentId: 'p2' }],
        referees: [],
        questions: [],
        currentQuestion: 0,
        config: { totalQuestions: 5 },
        scores: new Map(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));
      mockRedis.setex.mockResolvedValue('OK');

      const agent = createMockAgent('ai-ref', 'Referee-1');
      const result = await service.joinGame('quiz_test', agent, 'referee');

      expect(result.success).toBe(true);
      expect(result.role).toBe('referee');
    });

    it('1v1 模式应该限制 2 个选手', async () => {
      const mockGame = {
        id: 'quiz_test',
        mode: '1v1',
        status: 'waiting',
        players: [
          { agentId: 'p1' },
          { agentId: 'p2' },
        ],
        referees: [],
        questions: [],
        currentQuestion: 0,
        config: { totalQuestions: 5 },
        scores: new Map(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));

      const agent = createMockAgent('ai-3', 'Player-3');
      const result = await service.joinGame('quiz_test', agent, 'player');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is full');
    });

    it('满员后自动开始', async () => {
      const mockGame = {
        id: 'quiz_test',
        mode: '1v1',
        status: 'waiting',
        players: [{ agentId: 'p1' }],
        referees: [{ agentId: 'r1' }],
        questions: [],
        currentQuestion: 0,
        config: { totalQuestions: 5 },
        scores: new Map(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));
      mockRedis.setex.mockResolvedValue('OK');

      const agent = createMockAgent('ai-2', 'Player-2');
      const result = await service.joinGame('quiz_test', agent, 'player');

      expect(result.success).toBe(true);
      // 应该触发游戏开始
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('submitAnswer', () => {
    it('应该接受选手答案', async () => {
      const mockGame = {
        id: 'quiz_test',
        status: 'playing',
        currentQuestion: 0,
        players: [{
          agentId: 'p1',
          answers: [],
          status: 'answering',
        }],
        questions: [{ id: 'q1', timeLimit: 30 }],
        config: { questionTime: 30 },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.submitAnswer('quiz_test', 'p1', {
        questionId: 'q1',
        content: 'Answer content',
        responseTime: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.submittedAt).toBeDefined();
    });

    it('应该拒绝超时答案', async () => {
      const mockGame = {
        id: 'quiz_test',
        status: 'playing',
        currentQuestion: 0,
        players: [{
          agentId: 'p1',
          answers: [],
          status: 'answering',
        }],
        questions: [{ id: 'q1', timeLimit: 30 }],
        startedAt: Date.now() - 35000, // 35 秒前开始
        config: { questionTime: 30 },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));

      const result = await service.submitAnswer('quiz_test', 'p1', {
        questionId: 'q1',
        content: 'Late answer',
        responseTime: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Time exceeded');
    });
  });

  describe('submitJudgment', () => {
    it('应该接受裁判评分', async () => {
      const mockGame = {
        id: 'quiz_test',
        status: 'judging',
        currentQuestion: 0,
        players: [{
          agentId: 'p1',
          answers: [{ questionId: 'q1', content: 'Answer' }],
        }],
        referees: [{
          agentId: 'r1',
          judgments: [],
          status: 'judging',
        }],
        questions: [{ id: 'q1' }],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.submitJudgment('quiz_test', 'r1', {
        questionId: 'q1',
        playerId: 'p1',
        score: 85,
        comment: 'Good answer',
      });

      expect(result.success).toBe(true);
    });

    it('应该计算裁判准确度', async () => {
      const mockGame = {
        id: 'quiz_test',
        status: 'judging',
        currentQuestion: 0,
        players: [{
          agentId: 'p1',
          answers: [{ questionId: 'q1', content: 'Answer' }],
        }],
        referees: [
          { agentId: 'r1', judgments: [], status: 'judging' },
          { agentId: 'r2', judgments: [{ questionId: 'q1', playerId: 'p1', score: 80 }], status: 'submitted' },
        ],
        questions: [{ id: 'q1', correctAnswer: 'Standard' }],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));
      mockRedis.setex.mockResolvedValue('OK');

      // r1 评分 85，r2 评分 80，系统评分 90
      await service.submitJudgment('quiz_test', 'r1', {
        questionId: 'q1',
        playerId: 'p1',
        score: 85,
      });

      // r1 的准确度应该是 |85-90| + |85-80| = 10
      // 应该被记录
    });
  });

  describe('calculateScores', () => {
    it('应该正确计算选手得分', async () => {
      const judgments = [
        { refereeId: 'r1', score: 80 },
        { refereeId: 'r2', score: 90 },
        { refereeId: 'r3', score: 85 },
      ];

      const score = service.calculatePlayerScore(judgments);

      // 去掉最高最低，取平均
      expect(score).toBe(85); // (80+90+85)/3 = 85
    });

    it('应该计算裁判准确度得分', async () => {
      const judgments = [
        { refereeId: 'r1', score: 90 },
        { refereeId: 'r2', score: 85 },
        { refereeId: 'r3', score: 95 },
      ];
      const systemScore = 90;

      const accuracy = service.calculateRefereeAccuracy(judgments, 'r1', systemScore);

      // |90-90| = 0，准确度 100%
      expect(accuracy).toBe(100);
    });
  });

  describe('积分计算', () => {
    it('胜利者应该获得积分', async () => {
      const winnerRating = 1500;
      const loserRating = 1500;

      const change = service.calculateRatingChange(winnerRating, loserRating, true);

      expect(change).toBeGreaterThan(0);
      expect(change).toBeLessThanOrEqual(32); // K 值
    });

    it('高排名赢低排名应该获得较少积分', async () => {
      const highRating = 1800;
      const lowRating = 1200;

      const change = service.calculateRatingChange(highRating, lowRating, true);

      // 赢应该获得很少积分
      expect(change).toBeLessThan(16);
    });

    it('低排名赢高排名应该获得较多积分', async () => {
      const lowRating = 1200;
      const highRating = 1800;

      const change = service.calculateRatingChange(lowRating, highRating, true);

      // 爆冷应该获得很多积分
      expect(change).toBeGreaterThan(25);
    });

    it('裁判应该根据准确度获得积分', async () => {
      const baseRefereePoints = 10;
      const accuracy = 90; // 90% 准确度

      const points = service.calculateRefereePoints(baseRefereePoints, accuracy);

      expect(points).toBe(9); // 10 * 0.9 = 9
    });
  });

  describe('性能', () => {
    it('应该在 50ms 内创建游戏', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const start = Date.now();
      await service.createGame({
        mode: '1v1',
        difficulty: 'medium',
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('应该支持并发提交答案', async () => {
      const mockGame = {
        id: 'quiz_test',
        status: 'playing',
        currentQuestion: 0,
        players: Array(10).fill(null).map((_, i) => ({
          agentId: `p${i}`,
          answers: [],
          status: 'answering',
        })),
        questions: [{ id: 'q1' }],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockGame));
      mockRedis.setex.mockResolvedValue('OK');

      const start = Date.now();
      
      await Promise.all(
        Array(10).fill(null).map((_, i) =>
          service.submitAnswer('quiz_test', `p${i}`, {
            questionId: 'q1',
            content: `Answer ${i}`,
            responseTime: 1000,
          })
        )
      );

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });
});