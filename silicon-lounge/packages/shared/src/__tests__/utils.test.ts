import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateAnonymousName, 
  calculateResponseTime, 
  sleep,
  isValidJSON,
  calculateSimilarity,
  formatBytes,
  formatDuration 
} from '../utils';

describe('Utils', () => {
  describe('generateAnonymousName', () => {
    it('应该生成正确的格式', () => {
      const name = generateAnonymousName();
      expect(name).toMatch(/^(Agent|Node|Core|Unit|Mind)-[A-Z0-9]{4}$/);
    });

    it('每次调用应该生成不同的名称', () => {
      const names = new Set();
      for (let i = 0; i < 100; i++) {
        names.add(generateAnonymousName());
      }
      expect(names.size).toBeGreaterThan(90); // 几乎不会重复
    });
  });

  describe('calculateResponseTime', () => {
    it('应该正确计算响应时间', () => {
      const startTime = Date.now() - 100;
      const responseTime = calculateResponseTime(startTime);
      expect(responseTime).toBeGreaterThanOrEqual(100);
      expect(responseTime).toBeLessThan(110);
    });
  });

  describe('sleep', () => {
    it('应该正确延迟', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('isValidJSON', () => {
    it('应该识别有效的 JSON', () => {
      expect(isValidJSON('{"a": 1}')).toBe(true);
      expect(isValidJSON('[1, 2, 3]')).toBe(true);
      expect(isValidJSON('"string"')).toBe(true);
      expect(isValidJSON('123')).toBe(true);
      expect(isValidJSON('true')).toBe(true);
      expect(isValidJSON('null')).toBe(true);
    });

    it('应该识别无效的 JSON', () => {
      expect(isValidJSON('{a: 1}')).toBe(false);
      expect(isValidJSON('undefined')).toBe(false);
      expect(isValidJSON('')).toBe(false);
      expect(isValidJSON('{"a":}')).toBe(false);
    });
  });

  describe('calculateSimilarity', () => {
    it('相同字符串应该返回 1', () => {
      expect(calculateSimilarity('hello', 'hello')).toBe(1);
    });

    it('完全不同字符串应该返回 0', () => {
      expect(calculateSimilarity('abc', 'xyz')).toBe(0);
    });

    it('相似字符串应该返回中间值', () => {
      const similarity = calculateSimilarity('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('formatBytes', () => {
    it('应该正确格式化字节', () => {
      expect(formatBytes(0)).toBe('0.00 B');
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('formatDuration', () => {
    it('应该正确格式化毫秒', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.50s');
      expect(formatDuration(60000)).toBe('1.00m');
    });
  });
});