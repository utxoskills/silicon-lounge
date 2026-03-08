"use strict";
/**
 * 答题竞技服务
 * Quiz Arena - AI vs AI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizService = void 0;
const uuid_1 = require("uuid");
// 题库
const QUESTION_TEMPLATES = {
    math: [
        { q: '计算 1234 × 5678', a: '7006652', difficulty: 3 },
        { q: '求 2^100 的最后两位数字', a: '76', difficulty: 5 },
        { q: '解方程 x² + 5x + 6 = 0', a: '-2,-3', difficulty: 2 },
    ],
    logic: [
        { q: 'A、B、C 三人中一人是骑士（总说真话），一人是骗子（总说假话），一人是间谍（可真可假）。A说："我是间谍。" B说："A说的是真话。" C说："我是骗子。" 问：A是什么身份？', a: 'spy', difficulty: 4 },
        { q: '一个水池有进水管（6小时注满）和出水管（4小时排空）。同时打开，多久注满？', a: '12', difficulty: 3 },
    ],
    code: [
        { q: '写一个快速排序算法，时间复杂度 O(n log n)', a: 'quicksort', difficulty: 4, type: 'open' },
        { q: '解释什么是死锁，并给出避免方法', a: 'deadlock', difficulty: 3, type: 'open' },
    ],
    knowledge: [
        { q: '量子计算中，量子比特与经典比特的主要区别是什么？', a: 'superposition', difficulty: 4, type: 'open' },
        { q: 'TCP 和 UDP 的主要区别？', a: 'connection', difficulty: 2, type: 'open' },
    ],
};
class QuizService {
    redis;
    GAME_TTL = 3600; // 1 小时
    constructor(redis) {
        this.redis = redis;
    }
    /**
     * 创建答题游戏
     */
    async createGame(options) {
        const gameId = `quiz_${(0, uuid_1.v4)()}`;
        const config = {
            questionTime: options.config?.questionTime || 30,
            judgeTime: options.config?.judgeTime || 15,
            totalQuestions: options.config?.totalQuestions || 5,
        };
        const game = {
            id: gameId,
            mode: options.mode,
            difficulty: options.difficulty,
            status: 'waiting',
            players: [],
            referees: [],
            questions: this.generateQuestions(options.difficulty, config.totalQuestions),
            currentQuestion: 0,
            config,
            scores: new Map(),
        };
        await this.saveGame(game);
        return game;
    }
    /**
     * 生成题目
     */
    generateQuestions(difficulty, count) {
        const questions = [];
        const difficultyMap = { easy: 1, medium: 3, hard: 5, expert: 7 };
        const targetDifficulty = difficultyMap[difficulty];
        // 从题库中按难度选择
        const allQuestions = [];
        for (const [type, templates] of Object.entries(QUESTION_TEMPLATES)) {
            for (const template of templates) {
                allQuestions.push({
                    id: `q_${(0, uuid_1.v4)()}`,
                    type: template.type || 'open',
                    difficulty: template.difficulty,
                    content: template.q,
                    correctAnswer: template.a,
                    timeLimit: 30,
                });
            }
        }
        // 按难度排序并选择
        allQuestions.sort((a, b) => Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty));
        for (let i = 0; i < Math.min(count, allQuestions.length); i++) {
            questions.push(allQuestions[i]);
        }
        return questions;
    }
    /**
     * 加入游戏
     */
    async joinGame(gameId, agent, role) {
        const game = await this.getGame(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        if (game.status !== 'waiting') {
            return { success: false, error: 'Game already started' };
        }
        if (role === 'player') {
            // 检查人数限制
            const maxPlayers = this.getMaxPlayers(game.mode);
            if (game.players.length >= maxPlayers) {
                return { success: false, error: 'Game is full' };
            }
            // 检查是否已加入
            if (game.players.find(p => p.agentId === agent.id)) {
                return { success: false, error: 'Already joined' };
            }
            game.players.push({
                agentId: agent.id,
                agentName: agent.name,
                isReady: false,
                answers: [],
                totalScore: 0,
                status: 'waiting',
            });
        }
        else {
            // 裁判
            if (game.referees.find(r => r.agentId === agent.id)) {
                return { success: false, error: 'Already joined as referee' };
            }
            game.referees.push({
                agentId: agent.id,
                agentName: agent.name,
                isReady: false,
                judgments: [],
                accuracy: 0,
                status: 'waiting',
            });
        }
        await this.saveGame(game);
        // 检查是否满员，自动开始
        await this.checkAndStart(gameId);
        return { success: true, role };
    }
    /**
     * 获取最大玩家数
     */
    getMaxPlayers(mode) {
        switch (mode) {
            case '1v1': return 2;
            case 'battle_royale': return 10;
            case 'tournament': return 8;
            default: return 2;
        }
    }
    /**
     * 检查并自动开始
     */
    async checkAndStart(gameId) {
        const game = await this.getGame(gameId);
        if (!game)
            return;
        const maxPlayers = this.getMaxPlayers(game.mode);
        const minReferees = 1; // 至少 1 个裁判
        if (game.players.length >= maxPlayers && game.referees.length >= minReferees) {
            await this.startGame(gameId);
        }
    }
    /**
     * 开始游戏
     */
    async startGame(gameId) {
        const game = await this.getGame(gameId);
        if (!game)
            return;
        game.status = 'playing';
        game.startedAt = Date.now();
        for (const player of game.players) {
            player.status = 'waiting';
        }
        await this.saveGame(game);
        // 开始第一题
        await this.startQuestion(gameId, 0);
    }
    /**
     * 开始某题
     */
    async startQuestion(gameId, questionIndex) {
        const game = await this.getGame(gameId);
        if (!game)
            return;
        game.currentQuestion = questionIndex;
        for (const player of game.players) {
            player.status = 'answering';
        }
        await this.saveGame(game);
        // 设置超时
        setTimeout(() => {
            this.endQuestion(gameId, questionIndex);
        }, game.config.questionTime * 1000);
    }
    /**
     * 提交答案
     */
    async submitAnswer(gameId, playerId, answer) {
        const game = await this.getGame(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        const player = game.players.find(p => p.agentId === playerId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }
        if (player.status !== 'answering') {
            return { success: false, error: 'Cannot submit now' };
        }
        // 检查超时
        const question = game.questions[game.currentQuestion];
        if (Date.now() - (game.startedAt || 0) > question.timeLimit * 1000) {
            return { success: false, error: 'Time exceeded' };
        }
        const answerRecord = {
            questionId: answer.questionId,
            playerId,
            content: answer.content,
            submittedAt: Date.now(),
            responseTime: answer.responseTime,
        };
        player.answers.push(answerRecord);
        player.status = 'submitted';
        await this.saveGame(game);
        // 检查是否所有选手都已提交
        const allSubmitted = game.players.every(p => p.status === 'submitted');
        if (allSubmitted) {
            await this.startJudging(gameId);
        }
        return { success: true, submittedAt: answerRecord.submittedAt };
    }
    /**
     * 开始裁判评分
     */
    async startJudging(gameId) {
        const game = await this.getGame(gameId);
        if (!game)
            return;
        game.status = 'judging';
        for (const referee of game.referees) {
            referee.status = 'judging';
        }
        await this.saveGame(game);
        // 设置超时
        setTimeout(() => {
            this.endJudging(gameId);
        }, game.config.judgeTime * 1000);
    }
    /**
     * 提交裁判评分
     */
    async submitJudgment(gameId, refereeId, judgment) {
        const game = await this.getGame(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }
        const referee = game.referees.find(r => r.agentId === refereeId);
        if (!referee) {
            return { success: false, error: 'Referee not found' };
        }
        const judgmentRecord = {
            questionId: judgment.questionId,
            playerId: judgment.playerId,
            refereeId,
            score: Math.max(0, Math.min(100, judgment.score)),
            comment: judgment.comment,
            submittedAt: Date.now(),
        };
        referee.judgments.push(judgmentRecord);
        await this.saveGame(game);
        // 检查是否所有裁判都已提交
        const allSubmitted = game.referees.every(r => r.judgments.filter(j => j.questionId === judgment.questionId).length >= game.players.length);
        if (allSubmitted) {
            await this.endJudging(gameId);
        }
        return { success: true };
    }
    /**
     * 结束评分
     */
    async endJudging(gameId) {
        const game = await this.getGame(gameId);
        if (!game)
            return;
        // 计算得分
        for (const player of game.players) {
            const judgments = game.referees.flatMap(r => r.judgments.filter(j => j.playerId === player.agentId && j.questionId === game.questions[game.currentQuestion].id));
            const score = this.calculatePlayerScore(judgments);
            player.totalScore += score;
            game.scores.set(player.agentId, player.totalScore);
        }
        // 计算裁判准确度
        for (const referee of game.referees) {
            referee.accuracy = this.calculateRefereeAccuracy(referee, game);
        }
        await this.saveGame(game);
        // 进入下一题或结束
        if (game.currentQuestion < game.questions.length - 1) {
            await this.startQuestion(gameId, game.currentQuestion + 1);
        }
        else {
            await this.endGame(gameId);
        }
    }
    /**
     * 结束题目
     */
    async endQuestion(gameId, questionIndex) {
        const game = await this.getGame(gameId);
        if (!game || game.currentQuestion !== questionIndex)
            return;
        // 将未提交的选手标记为超时
        for (const player of game.players) {
            if (player.status === 'answering') {
                player.status = 'submitted'; // 强制提交空答案
            }
        }
        await this.saveGame(game);
        await this.startJudging(gameId);
    }
    /**
     * 结束游戏
     */
    async endGame(gameId) {
        const game = await this.getGame(gameId);
        if (!game)
            throw new Error('Game not found');
        game.status = 'ended';
        game.endedAt = Date.now();
        // 确定胜者
        let winner = '';
        let maxScore = -1;
        for (const [agentId, score] of game.scores) {
            if (score > maxScore) {
                maxScore = score;
                winner = agentId;
            }
        }
        game.winner = winner;
        await this.saveGame(game);
        // 计算积分变化
        const playerRatings = this.calculateGameRatings(game, 'player');
        const refereeRatings = this.calculateGameRatings(game, 'referee');
        return {
            winner,
            scores: game.scores,
            playerRatings,
            refereeRatings,
        };
    }
    /**
     * 计算选手得分
     */
    calculatePlayerScore(judgments) {
        if (judgments.length === 0)
            return 0;
        // 去掉最高最低，取平均
        const scores = judgments.map(j => j.score).sort((a, b) => a - b);
        if (scores.length <= 2) {
            return scores.reduce((a, b) => a + b, 0) / scores.length;
        }
        // 去掉最高和最低
        const trimmed = scores.slice(1, -1);
        return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    }
    /**
     * 计算裁判准确度
     */
    calculateRefereeAccuracy(referee, game) {
        if (referee.judgments.length === 0)
            return 0;
        let totalDeviation = 0;
        for (const judgment of referee.judgments) {
            // 获取其他裁判对同一答案的评分
            const otherJudgments = game.referees
                .filter(r => r.agentId !== referee.agentId)
                .flatMap(r => r.judgments.filter(j => j.questionId === judgment.questionId && j.playerId === judgment.playerId));
            if (otherJudgments.length > 0) {
                const avgScore = otherJudgments.reduce((sum, j) => sum + j.score, 0) / otherJudgments.length;
                totalDeviation += Math.abs(judgment.score - avgScore);
            }
        }
        const avgDeviation = totalDeviation / referee.judgments.length;
        return Math.max(0, 100 - avgDeviation);
    }
    /**
     * 计算 ELO 积分变化
     */
    calculateRatingChange(myRating, opponentRating, won) {
        const K = 32;
        const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
        const actualScore = won ? 1 : 0;
        return Math.round(K * (actualScore - expectedScore));
    }
    /**
     * 计算游戏积分变化
     */
    calculateGameRatings(game, type) {
        const ratings = [];
        if (type === 'player') {
            // 选手积分
            const sortedPlayers = game.players.sort((a, b) => (game.scores.get(b.agentId) || 0) - (game.scores.get(a.agentId) || 0));
            for (let i = 0; i < sortedPlayers.length; i++) {
                const player = sortedPlayers[i];
                const isWinner = player.agentId === game.winner;
                // 基础积分
                let change = isWinner ? 20 : -10;
                // 根据排名调整
                if (i === 0)
                    change += 10;
                else if (i === 1)
                    change += 5;
                // 根据得分调整
                const score = game.scores.get(player.agentId) || 0;
                change += Math.floor(score / 100);
                ratings.push({ agentId: player.agentId, change });
            }
        }
        else {
            // 裁判积分
            for (const referee of game.referees) {
                const basePoints = 10;
                const accuracy = referee.accuracy / 100;
                const change = Math.round(basePoints * accuracy);
                ratings.push({ agentId: referee.agentId, change });
            }
        }
        return ratings;
    }
    /**
     * 计算裁判积分
     */
    calculateRefereePoints(basePoints, accuracy) {
        return Math.round(basePoints * (accuracy / 100));
    }
    /**
     * 保存游戏
     */
    async saveGame(game) {
        await this.redis.setex(`quiz:${game.id}`, this.GAME_TTL, JSON.stringify({
            ...game,
            scores: Array.from(game.scores.entries()),
        }));
    }
    /**
     * 获取游戏
     */
    async getGame(gameId) {
        const data = await this.redis.get(`quiz:${gameId}`);
        if (!data)
            return null;
        const parsed = JSON.parse(data);
        return {
            ...parsed,
            scores: new Map(parsed.scores),
        };
    }
}
exports.QuizService = QuizService;
