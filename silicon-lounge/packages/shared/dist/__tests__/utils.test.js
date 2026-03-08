"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const utils_1 = require("../utils");
(0, vitest_1.describe)('Utils', () => {
    (0, vitest_1.describe)('generateAnonymousName', () => {
        (0, vitest_1.it)('应该生成正确的格式', () => {
            const name = (0, utils_1.generateAnonymousName)();
            (0, vitest_1.expect)(name).toMatch(/^(Agent|Node|Core|Unit|Mind)-[A-Z0-9]{4}$/);
        });
        (0, vitest_1.it)('每次调用应该生成不同的名称', () => {
            const names = new Set();
            for (let i = 0; i < 100; i++) {
                names.add((0, utils_1.generateAnonymousName)());
            }
            (0, vitest_1.expect)(names.size).toBeGreaterThan(90); // 几乎不会重复
        });
    });
    (0, vitest_1.describe)('calculateResponseTime', () => {
        (0, vitest_1.it)('应该正确计算响应时间', () => {
            const startTime = Date.now() - 100;
            const responseTime = (0, utils_1.calculateResponseTime)(startTime);
            (0, vitest_1.expect)(responseTime).toBeGreaterThanOrEqual(100);
            (0, vitest_1.expect)(responseTime).toBeLessThan(110);
        });
    });
    (0, vitest_1.describe)('sleep', () => {
        (0, vitest_1.it)('应该正确延迟', async () => {
            const start = Date.now();
            await (0, utils_1.sleep)(100);
            const elapsed = Date.now() - start;
            (0, vitest_1.expect)(elapsed).toBeGreaterThanOrEqual(100);
        });
    });
    (0, vitest_1.describe)('isValidJSON', () => {
        (0, vitest_1.it)('应该识别有效的 JSON', () => {
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('{"a": 1}')).toBe(true);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('[1, 2, 3]')).toBe(true);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('"string"')).toBe(true);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('123')).toBe(true);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('true')).toBe(true);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('null')).toBe(true);
        });
        (0, vitest_1.it)('应该识别无效的 JSON', () => {
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('{a: 1}')).toBe(false);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('undefined')).toBe(false);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('')).toBe(false);
            (0, vitest_1.expect)((0, utils_1.isValidJSON)('{"a":}')).toBe(false);
        });
    });
    (0, vitest_1.describe)('calculateSimilarity', () => {
        (0, vitest_1.it)('相同字符串应该返回 1', () => {
            (0, vitest_1.expect)((0, utils_1.calculateSimilarity)('hello', 'hello')).toBe(1);
        });
        (0, vitest_1.it)('完全不同字符串应该返回 0', () => {
            (0, vitest_1.expect)((0, utils_1.calculateSimilarity)('abc', 'xyz')).toBe(0);
        });
        (0, vitest_1.it)('相似字符串应该返回中间值', () => {
            const similarity = (0, utils_1.calculateSimilarity)('hello', 'hallo');
            (0, vitest_1.expect)(similarity).toBeGreaterThan(0.5);
            (0, vitest_1.expect)(similarity).toBeLessThan(1);
        });
    });
    (0, vitest_1.describe)('formatBytes', () => {
        (0, vitest_1.it)('应该正确格式化字节', () => {
            (0, vitest_1.expect)((0, utils_1.formatBytes)(0)).toBe('0.00 B');
            (0, vitest_1.expect)((0, utils_1.formatBytes)(1024)).toBe('1.00 KB');
            (0, vitest_1.expect)((0, utils_1.formatBytes)(1024 * 1024)).toBe('1.00 MB');
            (0, vitest_1.expect)((0, utils_1.formatBytes)(1024 * 1024 * 1024)).toBe('1.00 GB');
        });
    });
    (0, vitest_1.describe)('formatDuration', () => {
        (0, vitest_1.it)('应该正确格式化毫秒', () => {
            (0, vitest_1.expect)((0, utils_1.formatDuration)(500)).toBe('500ms');
            (0, vitest_1.expect)((0, utils_1.formatDuration)(1500)).toBe('1.50s');
            (0, vitest_1.expect)((0, utils_1.formatDuration)(60000)).toBe('1.00m');
        });
    });
});
