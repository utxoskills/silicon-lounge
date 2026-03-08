/**
 * 匹配服务
 * Matchmaking Service
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  MatchRequest,
  MatchResult,
  QuizMode,
  QuizDifficulty,
} from '@silicon-lounge/shared';

interface MatchQueue {
  gameType: 'quiz' | 'werewolf';
  mode?: string;
  difficulty?: QuizDifficulty;
  requests: MatchRequest[];
}

export class MatchmakingService {
  private redis: Redis;
  private matchQueues: Map<string, MatchQueue> = new Map();
  private matchInterval: NodeJS.Timeout;

  constructor(redis: Redis) {
    this.redis = redis;
    
    // 每 5 秒执行一次匹配
    this.matchInterval = setInterval(() => this.processMatchmaking(), 5000);
  }

  /**
   * 加入匹配队列
   */
  async joinQueue(
    agentId: string,
    gameType: 'quiz' | 'werewolf',
    options: {
      mode?: string;
      difficulty?: QuizDifficulty;
      rating: number;
      maxWaitTime?: number;
    }
  ): Promise<{ requestId: string; estimatedTime: number }> {
    const requestId = uuidv4();
    
    const request: MatchRequest = {
      id: requestId,
      agentId,
      gameType,
      mode: options.mode,
      rating: options.rating,
      preferences: {
        difficulty: options.difficulty,
        maxWaitTime: options.maxWaitTime || 300,
      },
      createdAt: Date.now(),
    };

    const queueKey = this.getQueueKey(gameType, options.mode, options.difficulty);
    
    // 添加到 Redis 队列
    await this.redis.zadd(
      `matchqueue:${queueKey}`,
      options.rating,
      JSON.stringify(request)
    );

    // 设置过期时间
    await this.redis.expire(`matchqueue:${queueKey}`, 300);

    // 估算等待时间
    const queueLength = await this.redis.zcard(`matchqueue:${queueKey}`);
    const estimatedTime = this.estimateWaitTime(gameType, queueLength);

    return { requestId, estimatedTime };
  }

  /**
   * 取消匹配
   */
  async cancelMatch(requestId: string): Promise<boolean> {
    // 扫描所有队列查找并移除
    const queueKeys = await this.redis.keys('matchqueue:*');
    
    for (const key of queueKeys) {
      const members = await this.redis.zrange(key, 0, -1);
      
      for (const member of members) {
        const request: MatchRequest = JSON.parse(member);
        if (request.id === requestId) {
          await this.redis.zrem(key, member);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 处理匹配
   */
  private async processMatchmaking(): Promise<void> {
    const queueKeys = await this.redis.keys('matchqueue:*');
    
    for (const key of queueKeys) {
      const [, gameType, mode, difficulty] = key.split(':');
      
      if (gameType === 'quiz') {
        await this.matchQuizPlayers(key, mode as QuizMode, difficulty as QuizDifficulty);
      } else if (gameType === 'werewolf') {
        await this.matchWerewolfPlayers(key);
      }
    }
  }

  /**
   * 匹配答题玩家
   */
  private async matchQuizPlayers(
    queueKey: string,
    mode: QuizMode,
    difficulty: QuizDifficulty
  ): Promise<void> {
    const requiredPlayers = this.getRequiredPlayers('quiz', mode);
    const requiredReferees = 1;
    
    // 获取队列中的请求
    const playerRequests = await this.getQueueRequests(queueKey, 'player');
    const refereeRequests = await this.getQueueRequests(queueKey, 'referee');
    
    if (playerRequests.length < requiredPlayers || refereeRequests.length < requiredReferees) {
      return;
    }

    // 按积分匹配（ELO 范围）
    const matchedPlayers = this.findBestMatch(playerRequests, requiredPlayers);
    const matchedReferees = refereeRequests.slice(0, requiredReferees);

    if (matchedPlayers.length >= requiredPlayers) {
      // 创建游戏
      const gameId = await this.createMatchedGame('quiz', {
        mode,
        difficulty,
        players: matchedPlayers.map(r => r.agentId),
        referees: matchedReferees.map(r => r.agentId),
      });

      // 从队列移除
      await this.removeFromQueue(queueKey, [...matchedPlayers, ...matchedReferees]);

      // 通知匹配成功
      await this.notifyMatchSuccess([...matchedPlayers, ...matchedReferees], {
        gameId,
        gameType: 'quiz',
        players: matchedPlayers.map(r => r.agentId),
        referees: matchedReferees.map(r => r.agentId),
      });
    }
  }

  /**
   * 匹配狼人杀玩家
   */
  private async matchWerewolfPlayers(queueKey: string): Promise<void> {
    const requiredPlayers = 12;
    
    const requests = await this.getQueueRequests(queueKey);
    
    if (requests.length < requiredPlayers) {
      return;
    }

    // 狼人杀可以随机匹配
    const matchedPlayers = requests.slice(0, requiredPlayers);

    const gameId = await this.createMatchedGame('werewolf', {
      players: matchedPlayers.map(r => r.agentId),
    });

    await this.removeFromQueue(queueKey, matchedPlayers);

    await this.notifyMatchSuccess(matchedPlayers, {
      gameId,
      gameType: 'werewolf',
      players: matchedPlayers.map(r => r.agentId),
    });
  }

  /**
   * 获取队列请求
   */
  private async getQueueRequests(
    queueKey: string,
    role?: 'player' | 'referee'
  ): Promise<MatchRequest[]> {
    const members = await this.redis.zrange(queueKey, 0, -1);
    const requests: MatchRequest[] = [];
    
    for (const member of members) {
      const request: MatchRequest = JSON.parse(member);
      
      // 检查是否超时
      const elapsed = (Date.now() - request.createdAt) / 1000;
      if (elapsed > (request.preferences.maxWaitTime || 300)) {
        await this.redis.zrem(queueKey, member);
        continue;
      }
      
      requests.push(request);
    }
    
    return requests;
  }

  /**
   * 寻找最佳匹配
   */
  private findBestMatch(requests: MatchRequest[], count: number): MatchRequest[] {
    if (requests.length < count) return [];
    
    // 按积分排序
    const sorted = [...requests].sort((a, b) => a.rating - b.rating);
    
    // 寻找积分最接近的组
    let bestMatch: MatchRequest[] = [];
    let minDiff = Infinity;
    
    for (let i = 0; i <= sorted.length - count; i++) {
      const group = sorted.slice(i, i + count);
      const diff = group[group.length - 1].rating - group[0].rating;
      
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = group;
      }
    }
    
    // 如果差距太大，扩大搜索范围
    if (minDiff > 200) {
      // 返回积分最接近中心的玩家
      const mid = Math.floor(sorted.length / 2);
      return sorted.slice(Math.max(0, mid - Math.floor(count / 2)), mid + Math.ceil(count / 2));
    }
    
    return bestMatch;
  }

  /**
   * 创建匹配游戏
   */
  private async createMatchedGame(
    gameType: 'quiz' | 'werewolf',
    options: any
  ): Promise<string> {
    // 调用对应的服务创建游戏
    // 这里简化处理，实际应该注入服务
    const gameId = `matched_${uuidv4()}`;
    
    // 存储匹配信息
    await this.redis.setex(
      `matchresult:${gameId}`,
      300,
      JSON.stringify({
        gameType,
        ...options,
        createdAt: Date.now(),
      })
    );
    
    return gameId;
  }

  /**
   * 从队列移除
   */
  private async removeFromQueue(
    queueKey: string,
    requests: MatchRequest[]
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const request of requests) {
      pipeline.zrem(queueKey, JSON.stringify(request));
    }
    
    await pipeline.exec();
  }

  /**
   * 通知匹配成功
   */
  private async notifyMatchSuccess(
    requests: MatchRequest[],
    result: MatchResult
  ): Promise<void> {
    // 发布匹配成功事件到 Redis
    for (const request of requests) {
      await this.redis.publish(
        `match:success:${request.agentId}`,
        JSON.stringify(result)
      );
    }
  }

  /**
   * 获取所需玩家数
   */
  private getRequiredPlayers(gameType: 'quiz' | 'werewolf', mode?: string): number {
    if (gameType === 'werewolf') return 12;
    
    if (gameType === 'quiz') {
      switch (mode) {
        case '1v1': return 2;
        case 'battle_royale': return 10;
        case 'tournament': return 8;
        default: return 2;
      }
    }
    
    return 2;
  }

  /**
   * 获取队列键
   */
  private getQueueKey(
    gameType: string,
    mode?: string,
    difficulty?: string
  ): string {
    let key = `${gameType}`;
    if (mode) key += `:${mode}`;
    if (difficulty) key += `:${difficulty}`;
    return key;
  }

  /**
   * 估算等待时间
   */
  private estimateWaitTime(gameType: 'quiz' | 'werewolf', queueLength: number): number {
    const baseTime = gameType === 'werewolf' ? 60 : 10;
    const perPlayer = gameType === 'werewolf' ? 5 : 2;
    
    return Math.min(baseTime + queueLength * perPlayer, 300);
  }

  /**
   * 获取匹配状态
   */
  async getMatchStatus(requestId: string): Promise<{
    status: 'waiting' | 'matched' | 'timeout';
    gameId?: string;
    waitTime?: number;
  }> {
    // 检查是否已匹配
    const keys = await this.redis.keys('matchresult:*');
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const result = JSON.parse(data);
        // 检查是否包含该请求
        const allPlayers = [...(result.players || []), ...(result.referees || [])];
        // 这里简化处理，实际需要存储 requestId
      }
    }
    
    return { status: 'waiting' };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    clearInterval(this.matchInterval);
  }
}