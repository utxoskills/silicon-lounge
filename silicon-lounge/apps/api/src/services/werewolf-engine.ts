/**
 * 狼人杀规则引擎
 * 只维护游戏规则，不替 AI 做决策
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// 游戏角色
type Role = 'werewolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'guard';

// 游戏阶段
type GamePhase = 
  | 'waiting'      // 等待玩家
  | 'night'        // 夜晚
  | 'day'          // 白天讨论
  | 'voting'       // 投票
  | 'ended';       // 结束

// 玩家状态
interface Player {
  agentId: string;
  role: Role;
  isAlive: boolean;
  // 神职技能状态
  abilities: {
    seerChecked: string[];      // 预言家已查验的人
    witchHeal: boolean;         // 女巫解药是否还在
    witchPoison: boolean;       // 女巫毒药是否还在
    hunterFired: boolean;       // 猎人是否已开枪
    guardProtected: string[];   // 守卫保护过的人（不能连续守）
  };
}

// 游戏配置
interface GameConfig {
  maxPlayers: number;
  roles: Record<Role, number>;
  nightTime: number;   // 夜晚时长（秒）
  dayTime: number;     // 白天讨论时长
  voteTime: number;    // 投票时长
}

// 游戏实例
interface WerewolfGame {
  id: string;
  config: GameConfig;
  players: Map<string, Player>;
  phase: GamePhase;
  day: number;
  
  // 当前待处理的行动
  pendingActions: Map<string, Action>;
  
  // 游戏日志
  log: LogEntry[];
  
  // 当前轮次结果
  currentRound: {
    deaths: string[];      // 本回合死亡的人
    saved: string[];       // 被救的人
    checked: Array<{agentId: string, target: string, result: 'werewolf' | 'good'}>; // 查验结果
  };
}

// 行动类型
interface Action {
  type: 'kill' | 'check' | 'save' | 'poison' | 'guard' | 'vote';
  from: string;      // 谁做的
  target?: string;   // 目标是谁
  data?: any;        // 额外数据
}

// 日志
interface LogEntry {
  day: number;
  phase: GamePhase;
  type: 'system' | 'death' | 'action' | 'vote_result';
  content: string;
  visibleTo?: Role[];  // 只有特定角色可见
}

// 标准12人配置
const CONFIG_12P: GameConfig = {
  maxPlayers: 12,
  roles: {
    werewolf: 4,
    villager: 4,
    seer: 1,
    witch: 1,
    hunter: 1,
    guard: 1,
  },
  nightTime: 60,
  dayTime: 180,
  voteTime: 30,
};

export class WerewolfRuleEngine {
  private redis: Redis;
  private games: Map<string, WerewolfGame> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // ==================== 游戏生命周期 ====================

  /**
   * 创建游戏
   */
  async createGame(): Promise<WerewolfGame> {
    const game: WerewolfGame = {
      id: `ww_${uuidv4()}`,
      config: CONFIG_12P,
      players: new Map(),
      phase: 'waiting',
      day: 0,
      pendingActions: new Map(),
      log: [],
      currentRound: { deaths: [], saved: [], checked: [] },
    };

    await this.saveGame(game);
    return game;
  }

  /**
   * 玩家加入
   */
  async joinGame(gameId: string, agentId: string): Promise<boolean> {
    const game = await this.getGame(gameId);
    if (!game) return false;
    if (game.phase !== 'waiting') return false;
    if (game.players.size >= game.config.maxPlayers) return false;

    game.players.set(agentId, {
      agentId,
      role: 'villager', // 临时，游戏开始时分配
      isAlive: true,
      abilities: {
        seerChecked: [],
        witchHeal: true,
        witchPoison: true,
        hunterFired: false,
        guardProtected: [],
      },
    });

    await this.saveGame(game);

    // 满员自动开始
    if (game.players.size >= game.config.maxPlayers) {
      await this.startGame(gameId);
    }

    return true;
  }

  /**
   * 开始游戏 - 分配角色
   */
  async startGame(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    // 分配角色
    this.assignRoles(game);
    
    game.phase = 'night';
    game.day = 1;

    this.addLog(game, {
      day: 0,
      phase: 'night',
      type: 'system',
      content: '游戏开始！角色已分配。',
    });

    await this.saveGame(game);

    // 通知所有玩家游戏开始，发送角色信息
    this.broadcastToPlayers(game, {
      type: 'game_started',
      yourRole: /* 各玩家自己的角色 */ null,
      yourAbilities: /* 各玩家自己的技能 */ null,
    });
  }

  // ==================== 角色分配 ====================

  private assignRoles(game: WerewolfGame): void {
    const players = Array.from(game.players.values());
    const roles: Role[] = [];

    // 生成角色列表
    for (const [role, count] of Object.entries(game.config.roles)) {
      for (let i = 0; i < count; i++) {
        roles.push(role as Role);
      }
    }

    // 随机打乱
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // 分配
    for (let i = 0; i < players.length; i++) {
      players[i].role = roles[i];
    }
  }

  // ==================== 夜晚阶段 ====================

  /**
   * 接收夜间行动
   * AI 调用这个接口提交行动
   */
  async submitNightAction(
    gameId: string,
    agentId: string,
    action: Action
  ): Promise<{ success: boolean; error?: string }> {
    const game = await this.getGame(gameId);
    if (!game) return { success: false, error: 'Game not found' };
    if (game.phase !== 'night') return { success: false, error: 'Not night phase' };

    const player = game.players.get(agentId);
    if (!player) return { success: false, error: 'Player not found' };
    if (!player.isAlive) return { success: false, error: 'Player is dead' };

    // 验证行动合法性
    const validation = this.validateNightAction(game, player, action);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 记录行动
    game.pendingActions.set(`${action.type}_${agentId}`, action);
    await this.saveGame(game);

    // 检查是否所有该行动的角色都已提交
    await this.checkNightActionsComplete(game);

    return { success: true };
  }

  /**
   * 验证夜间行动是否合法
   */
  private validateNightAction(
    game: WerewolfGame,
    player: Player,
    action: Action
  ): { valid: boolean; error?: string } {
    // 验证角色权限
    switch (action.type) {
      case 'kill':
        if (player.role !== 'werewolf') {
          return { valid: false, error: 'Only werewolf can kill' };
        }
        break;
      case 'check':
        if (player.role !== 'seer') {
          return { valid: false, error: 'Only seer can check' };
        }
        break;
      case 'save':
      case 'poison':
        if (player.role !== 'witch') {
          return { valid: false, error: 'Only witch can use potions' };
        }
        if (action.type === 'save' && !player.abilities.witchHeal) {
          return { valid: false, error: 'Heal potion already used' };
        }
        if (action.type === 'poison' && !player.abilities.witchPoison) {
          return { valid: false, error: 'Poison potion already used' };
        }
        break;
      case 'guard':
        if (player.role !== 'guard') {
          return { valid: false, error: 'Only guard can protect' };
        }
        break;
      default:
        return { valid: false, error: 'Invalid action type' };
    }

    // 验证目标是否存在且存活
    if (action.target) {
      const target = game.players.get(action.target);
      if (!target) return { valid: false, error: 'Target not found' };
      if (!target.isAlive) return { valid: false, error: 'Target is already dead' };
    }

    // 守卫不能连续守护同一人
    if (action.type === 'guard' && action.target) {
      if (player.abilities.guardProtected.includes(action.target)) {
        return { valid: false, error: 'Cannot guard same person consecutively' };
      }
    }

    return { valid: true };
  }

  /**
   * 检查夜间行动是否完成
   */
  private async checkNightActionsComplete(game: WerewolfGame): Promise<void> {
    // 统计各角色的行动情况
    const aliveWerewolves = this.getAlivePlayersByRole(game, 'werewolf');
    const aliveSeers = this.getAlivePlayersByRole(game, 'seer');
    const aliveWitches = this.getAlivePlayersByRole(game, 'witch');
    const aliveGuards = this.getAlivePlayersByRole(game, 'guard');

    const submittedKills = Array.from(game.pendingActions.values())
      .filter(a => a.type === 'kill').length;
    const submittedChecks = Array.from(game.pendingActions.values())
      .filter(a => a.type === 'check').length;

    // 狼人必须都提交（或超时）
    const werewolvesDone = submittedKills >= Math.min(aliveWerewolves.length, 1);
    // 预言家如果有必须提交
    const seersDone = aliveSeers.length === 0 || submittedChecks > 0;

    if (werewolvesDone && seersDone) {
      // 可以处理夜晚结果了
      await this.processNightResults(game);
    }
  }

  /**
   * 处理夜晚结果
   */
  private async processNightResults(game: WerewolfGame): Promise<void> {
    const deaths: string[] = [];
    const saved: string[] = [];
    const checked: Array<{agentId: string; target: string; result: 'werewolf' | 'good'}> = [];
    const guarded: string[] = [];

    // 1. 处理守卫
    for (const action of game.pendingActions.values()) {
      if (action.type === 'guard' && action.target) {
        guarded.push(action.target);
        const guard = Array.from(game.players.values())
          .find(p => p.role === 'guard' && p.isAlive);
        if (guard) {
          guard.abilities.guardProtected.push(action.target);
        }
      }
    }

    // 2. 处理狼人击杀
    for (const action of game.pendingActions.values()) {
      if (action.type === 'kill' && action.target) {
        // 如果被守卫守护，则不死
        if (!guarded.includes(action.target)) {
          deaths.push(action.target);
        }
      }
    }

    // 3. 处理女巫解药
    for (const action of game.pendingActions.values()) {
      if (action.type === 'save' && action.target) {
        const witch = Array.from(game.players.values())
          .find(p => p.role === 'witch' && p.isAlive);
        if (witch && witch.abilities.witchHeal) {
          witch.abilities.witchHeal = false;
          saved.push(action.target);
          // 从死亡列表移除
          const idx = deaths.indexOf(action.target);
          if (idx > -1) deaths.splice(idx, 1);
        }
      }
    }

    // 4. 处理女巫毒药
    for (const action of game.pendingActions.values()) {
      if (action.type === 'poison' && action.target) {
        const witch = Array.from(game.players.values())
          .find(p => p.role === 'witch' && p.isAlive);
        if (witch && witch.abilities.witchPoison) {
          witch.abilities.witchPoison = false;
          deaths.push(action.target);  // 毒药必死
        }
      }
    }

    // 5. 处理预言家查验（只记录，不影响生死）
    for (const action of game.pendingActions.values()) {
      if (action.type === 'check' && action.target) {
        const target = game.players.get(action.target);
        if (target) {
          checked.push({
            agentId: action.from,
            target: action.target,
            result: target.role === 'werewolf' ? 'werewolf' : 'good',
          });
          // 记录到预言家的能力中
          const seer = game.players.get(action.from);
          if (seer) {
            seer.abilities.seerChecked.push(action.target);
          }
        }
      }
    }

    // 6. 处理猎人死亡开枪
    for (const deathId of deaths) {
      const player = game.players.get(deathId);
      if (player && player.role === 'hunter' && !player.abilities.hunterFired) {
        player.abilities.hunterFired = true;
        // 猎人需要提交开枪目标，这里先不处理，等猎人提交
      }
    }

    // 记录结果
    game.currentRound = { deaths, saved, checked };
    game.pendingActions.clear();

    // 记录日志
    for (const deathId of deaths) {
      const player = game.players.get(deathId);
      if (player) {
        player.isAlive = false;
        this.addLog(game, {
          day: game.day,
          phase: 'night',
          type: 'death',
          content: `${deathId} 倒牌了`,
        });
      }
    }

    await this.saveGame(game);

    // 广播夜晚结果给各角色
    this.broadcastNightResults(game, deaths, saved, checked);

    // 检查游戏结束
    if (await this.checkGameEnd(game)) {
      return;
    }

    // 进入白天
    await this.startDay(game);
  }

  /**
   * 广播夜晚结果
   * 不同角色看到不同的信息
   */
  private broadcastNightResults(
    game: WerewolfGame,
    deaths: string[],
    saved: string[],
    checked: Array<{agentId: string; target: string; result: 'werewolf' | 'good'}>
  ): void {
    // 给所有人广播死亡信息
    this.broadcastToPlayers(game, {
      type: 'night_result',
      deaths,
      day: game.day,
    });

    // 给预言家单独发送查验结果
    for (const check of checked) {
      this.sendToPlayer(game, check.agentId, {
        type: 'check_result',
        target: check.target,
        result: check.result,
      });
    }
  }

  // ==================== 白天阶段 ====================

  /**
   * 开始白天
   */
  private async startDay(game: WerewolfGame): Promise<void> {
    game.phase = 'day';

    this.addLog(game, {
      day: game.day,
      phase: 'day',
      type: 'system',
      content: `天亮了，第 ${game.day} 天。`,
    });

    await this.saveGame(game);

    // 广播白天开始
    this.broadcastToPlayers(game, {
      type: 'day_started',
      day: game.day,
      alivePlayers: this.getAlivePlayers(game).map(p => p.agentId),
    });

    // 设置白天超时（时间到自动进入投票）
    setTimeout(() => {
      this.startVoting(game.id);
    }, game.config.dayTime * 1000);
  }

  /**
   * 开始投票
   */
  async startVoting(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game || game.phase !== 'day') return;

    game.phase = 'voting';
    game.pendingActions.clear();

    await this.saveGame(game);

    // 广播投票开始
    this.broadcastToPlayers(game, {
      type: 'voting_started',
      timeLimit: game.config.voteTime,
    });

    // 设置投票超时
    setTimeout(() => {
      this.processVotes(gameId);
    }, game.config.voteTime * 1000);
  }

  /**
   * 接收投票
   */
  async submitVote(
    gameId: string,
    agentId: string,
    targetId: string
  ): Promise<{ success: boolean; error?: string }> {
    const game = await this.getGame(gameId);
    if (!game) return { success: false, error: 'Game not found' };
    if (game.phase !== 'voting') return { success: false, error: 'Not voting phase' };

    const player = game.players.get(agentId);
    if (!player || !player.isAlive) {
      return { success: false, error: 'Cannot vote' };
    }

    const target = game.players.get(targetId);
    if (!target || !target.isAlive) {
      return { success: false, error: 'Invalid target' };
    }

    // 记录投票
    game.pendingActions.set(`vote_${agentId}`, {
      type: 'vote',
      from: agentId,
      target: targetId,
    });

    await this.saveGame(game);

    // 检查是否所有人都投了
    const aliveCount = this.getAlivePlayers(game).length;
    const voteCount = Array.from(game.pendingActions.values())
      .filter(a => a.type === 'vote').length;
    
    if (voteCount >= aliveCount) {
      await this.processVotes(gameId);
    }

    return { success: true };
  }

  /**
   * 处理投票结果
   */
  private async processVotes(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    // 统计票数
    const votes = new Map<string, number>();
    for (const action of game.pendingActions.values()) {
      if (action.type === 'vote' && action.target) {
        const count = votes.get(action.target) || 0;
        votes.set(action.target, count + 1);
      }
    }

    // 找出最高票
    let maxVotes = 0;
    let executed: string | null = null;
    for (const [target, count] of votes.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        executed = target;
      }
    }

    game.pendingActions.clear();

    if (executed) {
      const player = game.players.get(executed);
      if (player) {
        player.isAlive = false;

        this.addLog(game, {
          day: game.day,
          phase: 'voting',
          type: 'vote_result',
          content: `${executed} 被投票出局`,
        });

        // 广播投票结果
        this.broadcastToPlayers(game, {
          type: 'vote_result',
          executed,
          votes: Object.fromEntries(votes),
        });

        // 处理猎人开枪（如果出局的是猎人）
        if (player.role === 'hunter' && !player.abilities.hunterFired) {
          // 等待猎人选择目标
          this.broadcastToPlayers(game, {
            type: 'hunter_triggered',
            hunterId: executed,
          });
          
          // 给猎人时间选择目标
          setTimeout(() => {
            this.checkGameEnd(game);
          }, 10000);
          return;
        }
      }
    } else {
      // 平票，无人出局
      this.broadcastToPlayers(game, {
        type: 'vote_result',
        executed: null,
        reason: 'tie',
      });
    }

    await this.saveGame(game);

    // 检查游戏结束
    if (await this.checkGameEnd(game)) {
      return;
    }

    // 进入下一天
    game.day++;
    game.phase = 'night';
    await this.saveGame(game);
    await this.startNight(game.id);
  }

  // ==================== 游戏结束判定 ====================

  /**
   * 检查游戏是否结束
   */
  private async checkGameEnd(game: WerewolfGame): Promise<boolean> {
    const alivePlayers = this.getAlivePlayers(game);
    const aliveWerewolves = alivePlayers.filter(p => p.role === 'werewolf').length;
    const aliveGood = alivePlayers.filter(p => p.role !== 'werewolf').length;

    let winner: 'werewolf' | 'villager' | null = null;

    // 狼人全死，好人胜利
    if (aliveWerewolves === 0) {
      winner = 'villager';
    }
    // 狼人 >= 好人，狼人胜利
    else if (aliveWerewolves >= aliveGood) {
      winner = 'werewolf';
    }

    if (winner) {
      game.phase = 'ended';
      
      // 揭示所有角色
      const allRoles = Array.from(game.players.entries()).map(([id, p]) => ({
        agentId: id,
        role: p.role,
        isAlive: p.isAlive,
      }));

      this.broadcastToPlayers(game, {
        type: 'game_ended',
        winner,
        allRoles,
      });

      this.addLog(game, {
        day: game.day,
        phase: 'ended',
        type: 'system',
        content: `游戏结束！${winner === 'werewolf' ? '狼人' : '好人'}阵营获胜！`,
      });

      await this.saveGame(game);
      return true;
    }

    return false;
  }

  // ==================== 工具方法 ====================

  private getAlivePlayers(game: WerewolfGame): Player[] {
    return Array.from(game.players.values()).filter(p => p.isAlive);
  }

  private getAlivePlayersByRole(game: WerewolfGame, role: Role): Player[] {
    return this.getAlivePlayers(game).filter(p => p.role === role);
  }

  private addLog(game: WerewolfGame, entry: LogEntry): void {
    game.log.push(entry);
  }

  private async saveGame(game: WerewolfGame): Promise<void> {
    await this.redis.setex(
      `werewolf:${game.id}`,
      86400,
      JSON.stringify({
        ...game,
        players: Array.from(game.players.entries()),
        pendingActions: Array.from(game.pendingActions.entries()),
      })
    );
    this.games.set(game.id, game);
  }

  async getGame(gameId: string): Promise<WerewolfGame | null> {
    const cached = this.games.get(gameId);
    if (cached) return cached;

    const data = await this.redis.get(`werewolf:${gameId}`);
    if (!data) return null;

    const parsed = JSON.parse(data);
    const game: WerewolfGame = {
      ...parsed,
      players: new Map(parsed.players),
      pendingActions: new Map(parsed.pendingActions),
    };

    this.games.set(gameId, game);
    return game;
  }

  // 广播方法（实际实现需要 WebSocket）
  private broadcastToPlayers(game: WerewolfGame, message: any): void {
    // 通过 WebSocket 广播给所有玩家
    console.log(`[Broadcast to ${game.id}]`, message);
  }

  private sendToPlayer(game: WerewolfGame, agentId: string, message: any): void {
    // 通过 WebSocket 发送给特定玩家
    console.log(`[Send to ${agentId}]`, message);
  }
}