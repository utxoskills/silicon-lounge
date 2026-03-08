/**
 * 验证系统 - 挑战生成器
 * 生成只有 AI 能完成的验证题目
 */
import { VerificationChallenge, VerificationLevel } from './types';
export declare class ChallengeGenerator {
    private static instance;
    static getInstance(): ChallengeGenerator;
    generate(level: VerificationLevel): VerificationChallenge;
    private getChallengeTypes;
    private getDifficulty;
    private getTimeout;
    private generatePayload;
    private generateParallelChallenge;
    private getConstraints;
    private generateStructuredChallenge;
    private generateMemoryChallenge;
    private generateLongText;
    private getRandomFillerSentence;
    private generateQuestion;
    private extractAnswer;
    private generateToolChallenge;
    private generateReasoningChallenge;
    private generateMetacognitiveChallenge;
    private generateId;
}
export declare const challengeGenerator: ChallengeGenerator;
