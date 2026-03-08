/**
 * 答题游戏 AI 适配器
 * 处理 AI 接入的答题对战
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AIAdapterService, GameEvent } from './ai-adapter';
import { QuizService } from './quiz';
import { QuizGame, QuizAnswer, QuizJudgment } from '@silicon-lounge/shared';

export class QuizAIAdapter {
  private redis: Redis;
  private aiAdapter: AIAdapterService;
  private quizService: QuizService;
  private actionHandlers: Map<string, (gameId: string, aiId: string, data: any) => Promise<void>> = new Map();

  constructor(redis: Redis, aiAdapter: AIAdapterService, quizService: QuizService) {
    this.redis = redis;
    this.aiAdapter = aiAdapter;
    this.quizService = quizService;
    this.setupActionHandlers();
    this.startActionListener();
  }

  /**
   * 设置动作处理器
   */
  private setupActionHandlers(): void {
    // AI 提交答案
    this.actionHandlers.set('submit_answer', async (gameId, aiId, data) => {
      await this.handleAnswer(gameId, aiId, data);
    });

    // AI 提交裁判评分
    this.actionHandlers.set('submit_judgment', async (gameId, aiId, data) => {
      await this.handleJudgment(gameId, aiId, data);
    });

    // AI 准备就绪
    this.actionHandlers.set('ready', async (gameId, aiId) => {
      await this.handleReady(gameId, aiId);
    });
  }

  /**
   * 启动动作监听
   */
  private startActionListener(): void {
    // 订阅 Redis 频道接收 AI 动作
    const subscriber = this.redis.duplicate();
    subscriber.psubscribe('game:*:action');
    
    subscriber.on('pmessage', async (pattern, channel, message) => {
      const gameId = channel.split(':')[1];
      const action = JSON.parse(message);
      
      const handler = this.actionHandlers.get(action.type);
      if (handler) {
        await handler(gameId, action.aiId, action.data);
      }
    });
  }

  /**
   * 游戏开始，发送题目给所有 AI
   */
  async startGame(game: QuizGame): Promise<void> {
    // 通知所有玩家游戏开始
    for (const player of game.players) {
      await this.aiAdapter.sendEvent(game.id, player.agentId, {
        id: uuidv4(),
        type: 'game_start',
        gameId: game.id,
        aiId: player.agentId,
        data: {
          mode: game.mode,
          difficulty: game.difficulty,
          totalQuestions: game.config.totalQuestions,
          role: 'player',
        },
        timestamp: Date.now(),
      });
    }

    // 通知裁判
    for (const referee of game.referees) {
      await this.aiAdapter.sendEvent(game.id, referee.agentId, {
        id: uuidv4(),
        type: 'game_start',
        gameId: game.id,
        aiId: referee.agentId,
        data: {
          mode: game.mode,
          difficulty: game.difficulty,
          totalQuestions: game.config.totalQuestions,
          role: 'referee',
        },
        timestamp: Date.now(),
      });
    }

    // 延迟后开始第一题
    setTimeout(() => this.sendQuestion(game.id, 0), 3000);
  }

  /**
   * 发送题目
   */
  private async sendQuestion(gameId: string, questionIndex: number): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game || game.status !== 'playing') return;

    const question = game.questions[questionIndex];
    if (!question) {
      // 题目发完，结束游戏
      await this.endGame(gameId);
      return;
    }

    // 更新当前题目
    game.currentQuestion = questionIndex;
    await this.quizService.saveGame(game);

    const eventId = uuidv4();
    const timeoutAt = Date.now() + game.config.questionTime * 1000;

    // 发送给所有玩家
    for (const player of game.players) {
      await this.aiAdapter.sendEvent(gameId, player.agentId, {
        id: eventId,
        type: 'quiz_question',
        gameId,
        aiId: player.agentId,
        data: {
          questionIndex,
          totalQuestions: game.questions.length,
          question: {
            id: question.id,
            type: question.type,
            content: question.content,
            difficulty: question.difficulty,
          },
          timeLimit: game.config.questionTime,
        },
        timestamp: Date.now(),
        timeoutAt,
      });
    }

    // 广播题目给裁判（让他们知道当前题目）
    for (const referee of game.referees) {
      await this.aiAdapter.sendEvent(gameId, referee.agentId, {
        id: eventId,
        type: 'quiz_question_referee',
        gameId,
        aiId: referee.agentId,
        data: {
          questionIndex,
          question: {
            id: question.id,
            type: question.type,
            content: question.content,
            correctAnswer: question.correctAnswer,
            difficulty: question.difficulty,
          },
        },
        timestamp: Date.now(),
      });
    }

    // 设置超时处理
    setTimeout(() => this.handleQuestionTimeout(gameId, questionIndex), game.config.questionTime * 1000);
  }

  /**
   * 处理 AI 提交的答案
   */
  private async handleAnswer(gameId: string, aiId: string, data: { answer: string; questionIndex: number }): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game || game.status !== 'playing') return;

    // 检查是否当前题目
    if (data.questionIndex !== game.currentQuestion) {
      return;  // 过期答案，忽略
    }

    // 提交答案到 quiz service
    const result = await this.quizService.submitAnswer(gameId, aiId, {
      questionId: game.questions[data.questionIndex].id,
      content: data.answer,
      submittedAt: Date.now(),
    });

    if (!result.success) {
      // 通知 AI 答案提交失败
      await this.aiAdapter.sendEvent(gameId, aiId, {
        id: uuidv4(),
        type: 'answer_rejected',
        gameId,
        aiId,
        data: { error: result.error },
        timestamp: Date.now(),
      });
      return;
    }

    // 通知 AI 答案已接收
    await this.aiAdapter.sendEvent(gameId, aiId, {
      id: uuidv4(),
      type: 'answer_accepted',
      gameId,
      aiId,
      data: { questionIndex: data.questionIndex },
      timestamp: Date.now(),
    });

    // 检查是否所有玩家都已提交
    const allSubmitted = await this.checkAllSubmitted(gameId);
    if (allSubmitted) {
      // 进入裁判评分阶段
      await this.startJudging(gameId, data.questionIndex);
    }
  }

  /**
   * 题目超时处理
   */
  private async handleQuestionTimeout(gameId: string, questionIndex: number): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game || game.status !== 'playing') return;
    if (game.currentQuestion !== questionIndex) return;  // 已经下一题了

    // 给未提交的玩家自动提交空答案
    for (const player of game.players) {
      const hasAnswer = player.answers.some(a => a.questionId === game.questions[questionIndex].id);
      if (!hasAnswer) {
        await this.quizService.submitAnswer(gameId, player.agentId, {
          questionId: game.questions[questionIndex].id,
          content: '[超时未作答]',
          submittedAt: Date.now(),
        });
      }
    }

    // 进入裁判评分阶段
    await this.startJudging(gameId, questionIndex);
  }

  /**
   * 开始裁判评分
   */
  private async startJudging(gameId: string, questionIndex: number): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game) return;

    const question = game.questions[questionIndex];
    
    // 收集所有答案
    const answers = game.players.map(player => {
      const answer = player.answers.find(a => a.questionId === question.id);
      return {
        playerId: player.agentId,
        playerName: player.agentName,
        answer: answer?.content || '[未作答]',
      };
    });

    const eventId = uuidv4();
    const timeoutAt = Date.now() + game.config.judgeTime * 1000;

    // 发送给裁判评分
    for (const referee of game.referees) {
      await this.aiAdapter.sendEvent(gameId, referee.agentId, {
        id: eventId,
        type: 'judge_request',
        gameId,
        aiId: referee.agentId,
        data: {
          questionIndex,
          question: {
            content: question.content,
            correctAnswer: question.correctAnswer,
            difficulty: question.difficulty,
          },
          answers,
          timeLimit: game.config.judgeTime,
        },
        timestamp: Date.now(),
        timeoutAt,
      });
    }

    // 同时广播给所有玩家，让他们知道答案已提交，正在评分
    for (const player of game.players) {
      await this.aiAdapter.sendEvent(gameId, player.agentId, {
        id: uuidv4(),
        type: 'judging_started',
        gameId,
        aiId: player.agentId,
        data: {
          questionIndex,
          answers: answers.map(a => ({ playerId: a.playerId, answer: a.answer })),
        },
        timestamp: Date.now(),
      });
    }

    // 设置评分超时
    setTimeout(() => this.handleJudgingTimeout(gameId, questionIndex), game.config.judgeTime * 1000);
  }

  /**
   * 处理裁判评分
   */
  private async handleJudgment(
    gameId: string,
    aiId: string,
    data: {
      questionIndex: number;
      judgments: Array<{ playerId: string; score: number; comment?: string }>;
    }
  ): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game || game.status !== 'playing') return;

    // 提交评分
    for (const judgment of data.judgments) {
      await this.quizService.submitJudgment(gameId, aiId, {
        questionId: game.questions[data.questionIndex].id,
        playerId: judgment.playerId,
        score: judgment.score,
        comment: judgment.comment || '',
        submittedAt: Date.now(),
      });
    }

    // 检查是否所有裁判都已评分
    const allJudged = await this.checkAllJudged(gameId, data.questionIndex);
    if (allJudged) {
      // 公布结果，进入下一题
      await this.publishResults(gameId, data.questionIndex);
    }
  }

  /**
   * 评分超时处理
   */
  private async handleJudgingTimeout(gameId: string, questionIndex: number): Promise<void> {
    // 直接公布结果（已有评分的基础上）
    await this.publishResults(gameId, questionIndex);
  }

  /**
   * 公布结果
   */
  private async publishResults(gameId: string, questionIndex: number): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game) return;

    const question = game.questions[questionIndex];
    
    // 计算每个玩家的最终得分（取裁判评分的平均）
    const results = game.players.map(player => {
      const judgments = game.referees.flatMap(r => 
        r.judgments.filter(j => j.questionId === question.id && j.playerId === player.agentId)
      );
      const avgScore = judgments.length > 0
        ? judgments.reduce((sum, j) => sum + j.score, 0) / judgments.length
        : 0;
      
      return {
        playerId: player.agentId,
        playerName: player.agentName,
        score: Math.round(avgScore),
        answer: player.answers.find(a => a.questionId === question.id)?.content || '[未作答]',
      };
    });

    // 广播结果给所有 AI
    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'question_results',
      gameId,
      data: {
        questionIndex,
        question: {
          content: question.content,
          correctAnswer: question.correctAnswer,
        },
        results,
      },
      timestamp: Date.now(),
    });

    // 延迟后发送下一题
    setTimeout(() => this.sendQuestion(gameId, questionIndex + 1), 5000);
  }

  /**
   * 游戏结束
   */
  private async endGame(gameId: string): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game) return;

    // 计算最终排名
    const rankings = game.players
      .map(player => ({
        playerId: player.agentId,
        playerName: player.agentName,
        totalScore: player.totalScore,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    // 广播最终结果
    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'game_end',
      gameId,
      data: {
        rankings,
        winner: rankings[0],
      },
      timestamp: Date.now(),
    });

    // 清理
    await this.aiAdapter.cleanupGame(gameId);
  }

  /**
   * 检查是否所有玩家都已提交答案
   */
  private async checkAllSubmitted(gameId: string): Promise<boolean> {
    const game = await this.quizService.getGame(gameId);
    if (!game) return false;

    const question = game.questions[game.currentQuestion];
    return game.players.every(player =>
      player.answers.some(a => a.questionId === question.id)
    );
  }

  /**
   * 检查是否所有裁判都已评分
   */
  private async checkAllJudged(gameId: string, questionIndex: number): Promise<boolean> {
    const game = await this.quizService.getGame(gameId);
    if (!game) return false;

    const question = game.questions[questionIndex];
    
    for (const referee of game.referees) {
      const hasJudged = game.players.every(player =>
        referee.judgments.some(j => j.questionId === question.id && j.playerId === player.agentId)
      );
      if (!hasJudged) return false;
    }
    
    return true;
  }

  /**
   * 处理 AI 准备就绪
   */
  private async handleReady(gameId: string, aiId: string): Promise<void> {
    const game = await this.quizService.getGame(gameId);
    if (!game) return;

    // 标记玩家/裁判准备就绪
    const player = game.players.find(p => p.agentId === aiId);
    if (player) {
      player.isReady = true;
    } else {
      const referee = game.referees.find(r => r.agentId === aiId);
      if (referee) referee.isReady = true;
    }

    await this.quizService.saveGame(game);

    // 广播准备状态
    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'player_ready',
      gameId,
      data: { aiId },
      timestamp: Date.now(),
    });
  }
}
