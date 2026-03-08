/**
 * 狼人杀 AI 适配器
 * 处理 AI 接入的狼人杀游戏
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AIAdapterService } from './ai-adapter';

// 狼人杀角色
type Role = 'werewolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'guard';

// 游戏阶段
type Phase = 'night' | 'night_action' | 'day' | 'discussion' | 'voting' | 'execution';

// 玩家状态
interface WerewolfPlayer {
  aiId: string;
  name: string;
  role: Role;
  isAlive: boolean;
  seat: number;  // 座位号
}

// 游戏状态
interface WerewolfGameState {
  id: string;
  status: 'waiting' | 'playing' | 'ended';
  day: number;
  phase: Phase;
  players: WerewolfPlayer[];
  // 夜间行动记录
  nightActions: {
    werewolfTarget?: string;  // 狼人刀的目标
    seerCheck?: { target: string; result: 'werewolf' | 'good' };
    witchHeal?: boolean;
    witchPoison?: string;
    guardProtect?: string;
  };
  // 白天投票
  votes: Map<string, string>;  // voter -> target
  // 遗言
  lastWords: Map<string, string>;
}

export class WerewolfAIAdapter {
  private redis: Redis;
  private aiAdapter: AIAdapterService;

  constructor(redis: Redis, aiAdapter: AIAdapterService) {
    this.redis = redis;
    this.aiAdapter = aiAdapter;
    this.startActionListener();
  }

  /**
   * 启动动作监听
   */
  private startActionListener(): void {
    const subscriber = this.redis.duplicate();
    subscriber.psubscribe('game:*:action');
    
    subscriber.on('pmessage', async (pattern, channel, message) => {
      const gameId = channel.split(':')[1];
      const action = JSON.parse(message);
      
      await this.handleAction(gameId, action);
    });
  }

  /**
   * 处理 AI 动作
   */
  private async handleAction(gameId: string, action: any): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state || state.status !== 'playing') return;

    switch (action.type) {
      case 'werewolf_kill':
        await this.handleWerewolfKill(gameId, action.aiId, action.data.target);
        break;
      case 'seer_check':
        await this.handleSeerCheck(gameId, action.aiId, action.data.target);
        break;
      case 'witch_action':
        await this.handleWitchAction(gameId, action.aiId, action.data);
        break;
      case 'guard_protect':
        await this.handleGuardProtect(gameId, action.aiId, action.data.target);
        break;
      case 'day_speech':
        await this.handleDaySpeech(gameId, action.aiId, action.data.speech);
        break;
      case 'vote':
        await this.handleVote(gameId, action.aiId, action.data.target);
        break;
      case 'hunter_shoot':
        await this.handleHunterShoot(gameId, action.aiId, action.data.target);
        break;
    }
  }

  /**
   * 游戏开始
   */
  async startGame(gameId: string, players: WerewolfPlayer[]): Promise<void> {
    const state: WerewolfGameState = {
      id: gameId,
      status: 'playing',
      day: 0,
      phase: 'night',
      players,
      nightActions: {},
      votes: new Map(),
      lastWords: new Map(),
    };

    await this.saveGameState(gameId, state);

    // 通知每个 AI 游戏开始，并告知其角色
    for (const player of players) {
      const roleInfo = this.getRoleInfo(player.role, players, player.aiId);
      
      await this.aiAdapter.sendEvent(gameId, player.aiId, {
        id: uuidv4(),
        type: 'werewolf_start',
        gameId,
        aiId: player.aiId,
        data: {
          role: player.role,
          roleName: this.getRoleName(player.role),
          roleDescription: this.getRoleDescription(player.role),
          seat: player.seat,
          totalPlayers: players.length,
          teammates: roleInfo.teammates,  // 如果是狼人，告知队友
          knownInfo: roleInfo.knownInfo,  // 角色特有的初始信息
        },
        timestamp: Date.now(),
      });
    }

    // 延迟后开始第一夜
    setTimeout(() => this.startNight(gameId), 5000);
  }

  /**
   * 开始夜晚
   */
  private async startNight(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    state.day++;
    state.phase = 'night';
    state.nightActions = {};
    await this.saveGameState(gameId, state);

    // 广播夜晚开始
    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'night_start',
      gameId,
      data: { day: state.day },
      timestamp: Date.now(),
    });

    // 按顺序唤醒角色
    setTimeout(() => this.wakeWerewolves(gameId), 2000);
  }

  /**
   * 唤醒狼人
   */
  private async wakeWerewolves(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const werewolves = state.players.filter(p => p.role === 'werewolf' && p.isAlive);
    const targets = state.players.filter(p => p.isAlive).map(p => ({
      aiId: p.aiId,
      name: p.name,
      seat: p.seat,
    }));

    // 通知所有狼人行动
    for (const wolf of werewolves) {
      await this.aiAdapter.sendEvent(gameId, wolf.aiId, {
        id: uuidv4(),
        type: 'night_action',
        gameId,
        aiId: wolf.aiId,
        data: {
          phase: 'werewolf',
          action: 'kill',
          targets,
          teammates: werewolves.filter(w => w.aiId !== wolf.aiId).map(w => ({
            aiId: w.aiId,
            name: w.name,
            seat: w.seat,
          })),
          timeLimit: 30,
        },
        timestamp: Date.now(),
        timeoutAt: Date.now() + 30000,
      });
    }

    // 设置超时
    setTimeout(() => this.checkWerewolfAction(gameId), 30000);
  }

  /**
   * 处理狼人刀人
   */
  private async handleWerewolfKill(gameId: string, aiId: string, target: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state || state.phase !== 'night') return;

    // 记录狼人选择的目标
    state.nightActions.werewolfTarget = target;
    await this.saveGameState(gameId, state);

    // 通知狼人阵营已选择目标
    const werewolves = state.players.filter(p => p.role === 'werewolf' && p.isAlive);
    for (const wolf of werewolves) {
      await this.aiAdapter.sendEvent(gameId, wolf.aiId, {
        id: uuidv4(),
        type: 'werewolf_target_selected',
        gameId,
        aiId: wolf.aiId,
        data: { target },
        timestamp: Date.now(),
      });
    }

    // 进入预言家阶段
    setTimeout(() => this.wakeSeer(gameId), 2000);
  }

  /**
   * 唤醒预言家
   */
  private async wakeSeer(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const seer = state.players.find(p => p.role === 'seer' && p.isAlive);
    if (!seer) {
      // 预言家已死，跳过
      setTimeout(() => this.wakeWitch(gameId), 2000);
      return;
    }

    const targets = state.players.filter(p => p.isAlive && p.aiId !== seer.aiId).map(p => ({
      aiId: p.aiId,
      name: p.name,
      seat: p.seat,
    }));

    await this.aiAdapter.sendEvent(gameId, seer.aiId, {
      id: uuidv4(),
      type: 'night_action',
      gameId,
      aiId: seer.aiId,
      data: {
        phase: 'seer',
        action: 'check',
        targets,
        timeLimit: 20,
      },
      timestamp: Date.now(),
      timeoutAt: Date.now() + 20000,
    });

    setTimeout(() => this.checkSeerAction(gameId), 20000);
  }

  /**
   * 处理预言家查验
   */
  private async handleSeerCheck(gameId: string, aiId: string, target: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const targetPlayer = state.players.find(p => p.aiId === target);
    if (!targetPlayer) return;

    const isWerewolf = targetPlayer.role === 'werewolf';
    
    state.nightActions.seerCheck = {
      target,
      result: isWerewolf ? 'werewolf' : 'good',
    };
    await this.saveGameState(gameId, state);

    // 告知预言家查验结果
    await this.aiAdapter.sendEvent(gameId, aiId, {
      id: uuidv4(),
      type: 'seer_result',
      gameId,
      aiId,
      data: {
        target,
        targetName: targetPlayer.name,
        result: isWerewolf ? 'werewolf' : 'good',
      },
      timestamp: Date.now(),
    });

    // 进入女巫阶段
    setTimeout(() => this.wakeWitch(gameId), 2000);
  }

  /**
   * 唤醒女巫
   */
  private async wakeWitch(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const witch = state.players.find(p => p.role === 'witch' && p.isAlive);
    if (!witch) {
      setTimeout(() => this.wakeGuard(gameId), 2000);
      return;
    }

    const tonightDead = state.nightActions.werewolfTarget;

    await this.aiAdapter.sendEvent(gameId, witch.aiId, {
      id: uuidv4(),
      type: 'night_action',
      gameId,
      aiId: witch.aiId,
      data: {
        phase: 'witch',
        actions: ['heal', 'poison'],
        tonightDead: tonightDead ? {
          aiId: tonightDead,
          name: state.players.find(p => p.aiId === tonightDead)?.name,
        } : null,
        canHeal: true,  // 简化：始终可以救
        canPoison: true,
        timeLimit: 20,
      },
      timestamp: Date.now(),
      timeoutAt: Date.now() + 20000,
    });

    setTimeout(() => this.checkWitchAction(gameId), 20000);
  }

  /**
   * 处理女巫行动
   */
  private async handleWitchAction(
    gameId: string,
    aiId: string,
    data: { heal?: boolean; poison?: string }
  ): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    if (data.heal) {
      state.nightActions.witchHeal = true;
    }
    if (data.poison) {
      state.nightActions.witchPoison = data.poison;
    }

    await this.saveGameState(gameId, state);

    // 进入守卫阶段
    setTimeout(() => this.wakeGuard(gameId), 2000);
  }

  /**
   * 唤醒守卫
   */
  private async wakeGuard(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const guard = state.players.find(p => p.role === 'guard' && p.isAlive);
    if (!guard) {
      setTimeout(() => this.endNight(gameId), 2000);
      return;
    }

    const targets = state.players.filter(p => p.isAlive).map(p => ({
      aiId: p.aiId,
      name: p.name,
      seat: p.seat,
    }));

    await this.aiAdapter.sendEvent(gameId, guard.aiId, {
      id: uuidv4(),
      type: 'night_action',
      gameId,
      aiId: guard.aiId,
      data: {
        phase: 'guard',
        action: 'protect',
        targets,
        timeLimit: 15,
      },
      timestamp: Date.now(),
      timeoutAt: Date.now() + 15000,
    });

    setTimeout(() => this.endNight(gameId), 15000);
  }

  /**
   * 处理守卫守护
   */
  private async handleGuardProtect(gameId: string, aiId: string, target: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    state.nightActions.guardProtect = target;
    await this.saveGameState(gameId, state);
  }

  /**
   * 夜晚结束，结算
   */
  private async endNight(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    // 结算死亡
    const deaths: string[] = [];

    // 狼人刀人
    if (state.nightActions.werewolfTarget) {
      const target = state.nightActions.werewolfTarget;
      const isHealed = state.nightActions.witchHeal;
      const isProtected = state.nightActions.guardProtect === target;

      // 同守同救会死，只救或只守能活
      if (!isHealed || isProtected) {
        if (!isProtected) {
          deaths.push(target);
        }
      }
    }

    // 女巫毒人
    if (state.nightActions.witchPoison) {
      deaths.push(state.nightActions.witchPoison);
    }

    // 标记死亡
    for (const deadId of deaths) {
      const player = state.players.find(p => p.aiId === deadId);
      if (player) {
        player.isAlive = false;
      }
    }

    state.phase = 'day';
    await this.saveGameState(gameId, state);

    // 广播天亮和死亡信息
    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'day_start',
      gameId,
      data: {
        day: state.day,
        deaths: deaths.map(id => ({
          aiId: id,
          name: state.players.find(p => p.aiId === id)?.name,
          role: state.players.find(p => p.aiId === id)?.role,
        })),
      },
      timestamp: Date.now(),
    });

    // 检查游戏结束
    if (await this.checkGameEnd(gameId)) return;

    // 进入白天发言阶段
    setTimeout(() => this.startDayDiscussion(gameId), 3000);
  }

  /**
   * 开始白天发言
   */
  private async startDayDiscussion(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    state.phase = 'discussion';
    await this.saveGameState(gameId, state);

    const alivePlayers = state.players.filter(p => p.isAlive);

    // 按顺序让每个 AI 发言
    for (let i = 0; i < alivePlayers.length; i++) {
      const player = alivePlayers[i];
      
      await this.aiAdapter.sendEvent(gameId, player.aiId, {
        id: uuidv4(),
        type: 'your_turn_to_speak',
        gameId,
        aiId: player.aiId,
        data: {
          day: state.day,
          turn: i + 1,
          totalTurns: alivePlayers.length,
          timeLimit: 60,
          context: {
            deaths: state.players.filter(p => !p.isAlive).map(p => ({
              name: p.name,
              role: p.role,
            })),
            previousSpeeches: [],  // 可以记录之前的发言
          },
        },
        timestamp: Date.now(),
        timeoutAt: Date.now() + 60000,
      });

      // 广播该玩家正在发言
      await this.aiAdapter.broadcastEvent(gameId, {
        id: uuidv4(),
        type: 'player_speaking',
        gameId,
        data: {
          aiId: player.aiId,
          name: player.name,
          seat: player.seat,
        },
        timestamp: Date.now(),
      });

      // 等待发言（简化：固定时间）
      await new Promise(r => setTimeout(r, 60000));
    }

    // 进入投票阶段
    setTimeout(() => this.startVoting(gameId), 2000);
  }

  /**
   * 处理白天发言
   */
  private async handleDaySpeech(gameId: string, aiId: string, speech: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const player = state.players.find(p => p.aiId === aiId);
    if (!player) return;

    // 广播发言内容给所有 AI
    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'player_speech',
      gameId,
      data: {
        aiId,
        name: player.name,
        seat: player.seat,
        speech,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * 开始投票
   */
  private async startVoting(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    state.phase = 'voting';
    state.votes.clear();
    await this.saveGameState(gameId, state);

    const alivePlayers = state.players.filter(p => p.isAlive);
    const targets = alivePlayers.map(p => ({
      aiId: p.aiId,
      name: p.name,
      seat: p.seat,
    }));

    // 通知所有存活玩家投票
    for (const player of alivePlayers) {
      await this.aiAdapter.sendEvent(gameId, player.aiId, {
        id: uuidv4(),
        type: 'vote_request',
        gameId,
        aiId: player.aiId,
        data: {
          targets,
          timeLimit: 30,
        },
        timestamp: Date.now(),
        timeoutAt: Date.now() + 30000,
      });
    }

    setTimeout(() => this.endVoting(gameId), 30000);
  }

  /**
   * 处理投票
   */
  private async handleVote(gameId: string, aiId: string, target: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state || state.phase !== 'voting') return;

    state.votes.set(aiId, target);
    await this.saveGameState(gameId, state);

    // 广播投票（匿名或公开，这里选择公开）
    const voter = state.players.find(p => p.aiId === aiId);
    const voted = state.players.find(p => p.aiId === target);

    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'vote_cast',
      gameId,
      data: {
        voterId: aiId,
        voterName: voter?.name,
        targetId: target,
        targetName: voted?.name,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * 投票结束
   */
  private async endVoting(gameId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    // 统计票数
    const voteCount = new Map<string, number>();
    for (const [voter, target] of state.votes) {
      voteCount.set(target, (voteCount.get(target) || 0) + 1);
    }

    // 找出最高票
    let maxVotes = 0;
    let executed: string | null = null;
    for (const [target, count] of voteCount) {
      if (count > maxVotes) {
        maxVotes = count;
        executed = target;
      }
    }

    // 广播投票结果
    await this.aiAdapter.broadcastEvent(gameId, {
      id: uuidv4(),
      type: 'vote_result',
      gameId,
      data: {
        executed: executed ? {
          aiId: executed,
          name: state.players.find(p => p.aiId === executed)?.name,
          votes: maxVotes,
        } : null,
        voteDetails: Array.from(state.votes.entries()).map(([voter, target]) => ({
          voter: state.players.find(p => p.aiId === voter)?.name,
          target: state.players.find(p => p.aiId === target)?.name,
        })),
      },
      timestamp: Date.now(),
    });

    if (executed) {
      // 执行处决
      const player = state.players.find(p => p.aiId === executed);
      if (player) {
        player.isAlive = false;
        await this.saveGameState(gameId, state);

        // 如果是猎人，可以发动技能
        if (player.role === 'hunter') {
          await this.handleHunterDeath(gameId, executed);
          return;
        }
      }
    }

    // 检查游戏结束
    if (await this.checkGameEnd(gameId)) return;

    // 进入下一夜
    setTimeout(() => this.startNight(gameId), 5000);
  }

  /**
   * 处理猎人死亡
   */
  private async handleHunterDeath(gameId: string, hunterId: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const targets = state.players.filter(p => p.isAlive).map(p => ({
      aiId: p.aiId,
      name: p.name,
      seat: p.seat,
    }));

    await this.aiAdapter.sendEvent(gameId, hunterId, {
      id: uuidv4(),
      type: 'hunter_skill',
      gameId,
      aiId: hunterId,
      data: {
        action: 'shoot',
        targets,
        timeLimit: 15,
      },
      timestamp: Date.now(),
      timeoutAt: Date.now() + 15000,
    });

    setTimeout(() => this.checkGameEnd(gameId), 15000);
  }

  /**
   * 处理猎人开枪
   */
  private async handleHunterShoot(gameId: string, hunterId: string, target: string): Promise<void> {
    const state = await this.getGameState(gameId);
    if (!state) return;

    const targetPlayer = state.players.find(p => p.aiId === target);
    if (targetPlayer) {
      targetPlayer.isAlive = false;
      await this.saveGameState(gameId, state);

      // 广播猎人开枪
      await this.aiAdapter.broadcastEvent(gameId, {
        id: uuidv4(),
        type: 'hunter_shot',
        gameId,
        data: {
          hunterId,
          hunterName: state.players.find(p => p.aiId === hunterId)?.name,
          targetId: target,
          targetName: targetPlayer.name,
          targetRole: targetPlayer.role,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 检查游戏结束
   */
  private async checkGameEnd(gameId: string): Promise<boolean> {
    const state = await this.getGameState(gameId);
    if (!state) return true;

    const werewolves = state.players.filter(p => p.role === 'werewolf' && p.isAlive);
    const goodPeople = state.players.filter(p => p.role !== 'werewolf' && p.isAlive);

    let winner: 'werewolf' | 'villager' | null = null;

    if (werewolves.length === 0) {
      winner = 'villager';
    } else if (werewolves.length >= goodPeople.length) {
      winner = 'werewolf';
    }

    if (winner) {
      state.status = 'ended';
      await this.saveGameState(gameId, state);

      // 广播游戏结束
      await this.aiAdapter.broadcastEvent(gameId, {
        id: uuidv4(),
        type: 'game_end',
        gameId,
        data: {
          winner,
          winnerName: winner === 'werewolf' ? '狼人阵营' : '好人阵营',
          players: state.players.map(p => ({
            aiId: p.aiId,
            name: p.name,
            role: p.role,
            isAlive: p.isAlive,
          })),
        },
        timestamp: Date.now(),
      });

      return true;
    }

    return false;
  }

  // 辅助方法

  private async getGameState(gameId: string): Promise<WerewolfGameState | null> {
    const data = await this.redis.get(`werewolf:state:${gameId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  private async saveGameState(gameId: string, state: WerewolfGameState): Promise<void> {
    await this.redis.setex(`werewolf:state:${gameId}`, 3600, JSON.stringify(state));
  }

  private getRoleName(role: Role): string {
    const names: Record<Role, string> = {
      werewolf: '狼人',
      villager: '平民',
      seer: '预言家',
      witch: '女巫',
      hunter: '猎人',
      guard: '守卫',
    };
    return names[role];
  }

  private getRoleDescription(role: Role): string {
    const descs: Record<Role, string> = {
      werewolf: '夜间可以刀人，白天要伪装成好人',
      villager: '没有特殊能力，通过发言找出狼人',
      seer: '夜间可以查验一人身份',
      witch: '有一瓶解药和一瓶毒药',
      hunter: '死亡时可以开枪带走一人',
      guard: '夜间可以守护一人',
    };
    return descs[role];
  }

  private getRoleInfo(role: Role, players: WerewolfPlayer[], myId: string): {
    teammates?: { aiId: string; name: string; seat: number }[];
    knownInfo?: any;
  } {
    if (role === 'werewolf') {
      return {
        teammates: players.filter(p => p.role === 'werewolf' && p.aiId !== myId).map(p => ({
          aiId: p.aiId,
          name: p.name,
          seat: p.seat,
        })),
      };
    }
    return {};
  }

  // 超时处理（简化版）
  private async checkWerewolfAction(gameId: string): Promise<void> {}
  private async checkSeerAction(gameId: string): Promise<void> {
    setTimeout(() => this.wakeWitch(gameId), 2000);
  }
  private async checkWitchAction(gameId: string): Promise<void> {
    setTimeout(() => this.wakeGuard(gameId), 2000);
  }
}
