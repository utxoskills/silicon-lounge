import { describe, it, expect, beforeEach } from 'vitest';
import { challengeGenerator, ChallengeGenerator } from '../verification';
import { VerificationLevel, ChallengeType } from '../types';

describe('ChallengeGenerator', () => {
  let generator: ChallengeGenerator;

  beforeEach(() => {
    generator = ChallengeGenerator.getInstance();
  });

  describe('generate', () => {
    it('应该为 basic 级别生成难度 1 的挑战', () => {
      const challenge = generator.generate('basic');
      
      expect(challenge).toBeDefined();
      expect(challenge.id).toMatch(/^ch_/);
      expect(challenge.difficulty).toBe(1);
      expect(challenge.level).toBe('basic');
      expect(challenge.timeout).toBeGreaterThan(0);
      expect(challenge.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('应该为 advanced 级别生成难度 2 的挑战', () => {
      const challenge = generator.generate('advanced');
      
      expect(challenge.difficulty).toBe(2);
      expect(challenge.level).toBe('advanced');
    });

    it('应该为 openclaw 级别生成难度 3 的挑战', () => {
      const challenge = generator.generate('openclaw');
      
      expect(challenge.difficulty).toBe(3);
      expect(challenge.level).toBe('openclaw');
    });

    it('basic 级别应该只包含基础挑战类型', () => {
      const validTypes: ChallengeType[] = ['parallel', 'structured', 'memory', 'tool'];
      
      // 多次生成确保覆盖
      for (let i = 0; i < 20; i++) {
        const challenge = generator.generate('basic');
        expect(validTypes).toContain(challenge.type);
      }
    });

    it('advanced 级别应该包含 reasoning 类型', () => {
      const validTypes: ChallengeType[] = ['parallel', 'structured', 'memory', 'tool', 'reasoning'];
      
      for (let i = 0; i < 20; i++) {
        const challenge = generator.generate('advanced');
        expect(validTypes).toContain(challenge.type);
      }
    });

    it('openclaw 级别应该包含 metacognitive 类型', () => {
      const validTypes: ChallengeType[] = ['parallel', 'structured', 'memory', 'tool', 'reasoning', 'metacognitive'];
      
      for (let i = 0; i < 20; i++) {
        const challenge = generator.generate('openclaw');
        expect(validTypes).toContain(challenge.type);
      }
    });
  });

  describe('timeout 配置', () => {
    it('parallel 挑战应该有正确的超时时间', () => {
      const basic = generator.generate('basic');
      if (basic.type === 'parallel') {
        expect(basic.timeout).toBe(200);
      }

      const advanced = generator.generate('advanced');
      if (advanced.type === 'parallel') {
        expect(advanced.timeout).toBe(150);
      }

      const openclaw = generator.generate('openclaw');
      if (openclaw.type === 'parallel') {
        expect(openclaw.timeout).toBe(100);
      }
    });

    it('tool 挑战应该有更长的超时时间', () => {
      const basic = generator.generate('basic');
      if (basic.type === 'tool') {
        expect(basic.timeout).toBe(1000);
      }
    });
  });

  describe('挑战内容生成', () => {
    it('parallel 挑战应该生成正确数量的任务', () => {
      const challenge = generator.generate('basic');
      if (challenge.type === 'parallel') {
        const tasks = challenge.payload as any[];
        expect(tasks).toHaveLength(5);
        expect(tasks[0]).toHaveProperty('id');
        expect(tasks[0]).toHaveProperty('type');
        expect(tasks[0]).toHaveProperty('content');
      }
    });

    it('advanced parallel 挑战应该有更多任务', () => {
      const challenge = generator.generate('advanced');
      if (challenge.type === 'parallel') {
        const tasks = challenge.payload as any[];
        expect(tasks).toHaveLength(8);
      }
    });

    it('openclaw parallel 挑战应该有最多任务', () => {
      const challenge = generator.generate('openclaw');
      if (challenge.type === 'parallel') {
        const tasks = challenge.payload as any[];
        expect(tasks).toHaveLength(10);
      }
    });

    it('structured 挑战应该包含输入和格式要求', () => {
      const challenge = generator.generate('basic');
      if (challenge.type === 'structured') {
        const payload = challenge.payload as any;
        expect(payload).toHaveProperty('input');
        expect(payload).toHaveProperty('expectedFormats');
        expect(payload).toHaveProperty('schema');
        expect(Array.isArray(payload.expectedFormats)).toBe(true);
      }
    });

    it('memory 挑战应该有上下文和问题', () => {
      const challenge = generator.generate('basic');
      if (challenge.type === 'memory') {
        const payload = challenge.payload as any;
        expect(payload).toHaveProperty('context');
        expect(payload).toHaveProperty('questions');
        expect(Array.isArray(payload.questions)).toBe(true);
        expect(payload.questions.length).toBeGreaterThan(0);
      }
    });

    it('basic memory 挑战应该有较短的上下文', () => {
      const challenge = generator.generate('basic');
      if (challenge.type === 'memory') {
        const payload = challenge.payload as any;
        expect(payload.context.length).toBeGreaterThanOrEqual(1000);
      }
    });

    it('openclaw memory 挑战应该有最长的上下文', () => {
      const challenge = generator.generate('openclaw');
      if (challenge.type === 'memory') {
        const payload = challenge.payload as any;
        expect(payload.context.length).toBeGreaterThanOrEqual(10000);
      }
    });
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = ChallengeGenerator.getInstance();
      const instance2 = ChallengeGenerator.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});