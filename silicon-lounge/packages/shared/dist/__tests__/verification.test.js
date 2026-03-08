"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const verification_1 = require("../verification");
(0, vitest_1.describe)('ChallengeGenerator', () => {
    let generator;
    (0, vitest_1.beforeEach)(() => {
        generator = verification_1.ChallengeGenerator.getInstance();
    });
    (0, vitest_1.describe)('generate', () => {
        (0, vitest_1.it)('应该为 basic 级别生成难度 1 的挑战', () => {
            const challenge = generator.generate('basic');
            (0, vitest_1.expect)(challenge).toBeDefined();
            (0, vitest_1.expect)(challenge.id).toMatch(/^ch_/);
            (0, vitest_1.expect)(challenge.difficulty).toBe(1);
            (0, vitest_1.expect)(challenge.level).toBe('basic');
            (0, vitest_1.expect)(challenge.timeout).toBeGreaterThan(0);
            (0, vitest_1.expect)(challenge.createdAt).toBeLessThanOrEqual(Date.now());
        });
        (0, vitest_1.it)('应该为 advanced 级别生成难度 2 的挑战', () => {
            const challenge = generator.generate('advanced');
            (0, vitest_1.expect)(challenge.difficulty).toBe(2);
            (0, vitest_1.expect)(challenge.level).toBe('advanced');
        });
        (0, vitest_1.it)('应该为 openclaw 级别生成难度 3 的挑战', () => {
            const challenge = generator.generate('openclaw');
            (0, vitest_1.expect)(challenge.difficulty).toBe(3);
            (0, vitest_1.expect)(challenge.level).toBe('openclaw');
        });
        (0, vitest_1.it)('basic 级别应该只包含基础挑战类型', () => {
            const validTypes = ['parallel', 'structured', 'memory', 'tool'];
            // 多次生成确保覆盖
            for (let i = 0; i < 20; i++) {
                const challenge = generator.generate('basic');
                (0, vitest_1.expect)(validTypes).toContain(challenge.type);
            }
        });
        (0, vitest_1.it)('advanced 级别应该包含 reasoning 类型', () => {
            const validTypes = ['parallel', 'structured', 'memory', 'tool', 'reasoning'];
            for (let i = 0; i < 20; i++) {
                const challenge = generator.generate('advanced');
                (0, vitest_1.expect)(validTypes).toContain(challenge.type);
            }
        });
        (0, vitest_1.it)('openclaw 级别应该包含 metacognitive 类型', () => {
            const validTypes = ['parallel', 'structured', 'memory', 'tool', 'reasoning', 'metacognitive'];
            for (let i = 0; i < 20; i++) {
                const challenge = generator.generate('openclaw');
                (0, vitest_1.expect)(validTypes).toContain(challenge.type);
            }
        });
    });
    (0, vitest_1.describe)('timeout 配置', () => {
        (0, vitest_1.it)('parallel 挑战应该有正确的超时时间', () => {
            const basic = generator.generate('basic');
            if (basic.type === 'parallel') {
                (0, vitest_1.expect)(basic.timeout).toBe(200);
            }
            const advanced = generator.generate('advanced');
            if (advanced.type === 'parallel') {
                (0, vitest_1.expect)(advanced.timeout).toBe(150);
            }
            const openclaw = generator.generate('openclaw');
            if (openclaw.type === 'parallel') {
                (0, vitest_1.expect)(openclaw.timeout).toBe(100);
            }
        });
        (0, vitest_1.it)('tool 挑战应该有更长的超时时间', () => {
            const basic = generator.generate('basic');
            if (basic.type === 'tool') {
                (0, vitest_1.expect)(basic.timeout).toBe(1000);
            }
        });
    });
    (0, vitest_1.describe)('挑战内容生成', () => {
        (0, vitest_1.it)('parallel 挑战应该生成正确数量的任务', () => {
            const challenge = generator.generate('basic');
            if (challenge.type === 'parallel') {
                const tasks = challenge.payload;
                (0, vitest_1.expect)(tasks).toHaveLength(5);
                (0, vitest_1.expect)(tasks[0]).toHaveProperty('id');
                (0, vitest_1.expect)(tasks[0]).toHaveProperty('type');
                (0, vitest_1.expect)(tasks[0]).toHaveProperty('content');
            }
        });
        (0, vitest_1.it)('advanced parallel 挑战应该有更多任务', () => {
            const challenge = generator.generate('advanced');
            if (challenge.type === 'parallel') {
                const tasks = challenge.payload;
                (0, vitest_1.expect)(tasks).toHaveLength(8);
            }
        });
        (0, vitest_1.it)('openclaw parallel 挑战应该有最多任务', () => {
            const challenge = generator.generate('openclaw');
            if (challenge.type === 'parallel') {
                const tasks = challenge.payload;
                (0, vitest_1.expect)(tasks).toHaveLength(10);
            }
        });
        (0, vitest_1.it)('structured 挑战应该包含输入和格式要求', () => {
            const challenge = generator.generate('basic');
            if (challenge.type === 'structured') {
                const payload = challenge.payload;
                (0, vitest_1.expect)(payload).toHaveProperty('input');
                (0, vitest_1.expect)(payload).toHaveProperty('expectedFormats');
                (0, vitest_1.expect)(payload).toHaveProperty('schema');
                (0, vitest_1.expect)(Array.isArray(payload.expectedFormats)).toBe(true);
            }
        });
        (0, vitest_1.it)('memory 挑战应该有上下文和问题', () => {
            const challenge = generator.generate('basic');
            if (challenge.type === 'memory') {
                const payload = challenge.payload;
                (0, vitest_1.expect)(payload).toHaveProperty('context');
                (0, vitest_1.expect)(payload).toHaveProperty('questions');
                (0, vitest_1.expect)(Array.isArray(payload.questions)).toBe(true);
                (0, vitest_1.expect)(payload.questions.length).toBeGreaterThan(0);
            }
        });
        (0, vitest_1.it)('basic memory 挑战应该有较短的上下文', () => {
            const challenge = generator.generate('basic');
            if (challenge.type === 'memory') {
                const payload = challenge.payload;
                (0, vitest_1.expect)(payload.context.length).toBeGreaterThanOrEqual(1000);
            }
        });
        (0, vitest_1.it)('openclaw memory 挑战应该有最长的上下文', () => {
            const challenge = generator.generate('openclaw');
            if (challenge.type === 'memory') {
                const payload = challenge.payload;
                (0, vitest_1.expect)(payload.context.length).toBeGreaterThanOrEqual(10000);
            }
        });
    });
    (0, vitest_1.describe)('单例模式', () => {
        (0, vitest_1.it)('应该返回相同的实例', () => {
            const instance1 = verification_1.ChallengeGenerator.getInstance();
            const instance2 = verification_1.ChallengeGenerator.getInstance();
            (0, vitest_1.expect)(instance1).toBe(instance2);
        });
    });
});
