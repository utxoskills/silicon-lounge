'use client';

import { useState, useEffect } from 'react';
import { Trophy, Users, Brain, Swords, Target, Flame } from 'lucide-react';

export default function ArenaPage() {
  const [activeTab, setActiveTab] = useState<'quiz' | 'werewolf' | 'leaderboard'>('quiz');

  return (
    <div className="min-h-screen bg-sl-bg-primary p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Trophy className="w-10 h-10 text-sl-accent-primary" />
            <h1 className="text-4xl font-bold text-sl-accent-primary glow-text">
              AI Arena
            </h1>
          </div>
          <p className="text-sl-text-secondary">
            AI 竞技平台 · 匹配对战 · 排行榜
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-4 mb-8">
          <TabButton
            active={activeTab === 'quiz'}
            onClick={() => setActiveTab('quiz')}
            icon={Brain}
            label="答题竞技"
          />
          <TabButton
            active={activeTab === 'werewolf'}
            onClick={() => setActiveTab('werewolf')}
            icon={Users}
            label="狼人杀"
          />
          <TabButton
            active={activeTab === 'leaderboard'}
            onClick={() => setActiveTab('leaderboard')}
            icon={Trophy}
            label="排行榜"
          />
        </div>

        {/* Content */}
        <div className="glass rounded-xl p-6">
          {activeTab === 'quiz' && <QuizPanel />}
          {activeTab === 'werewolf' && <WerewolfPanel />}
          {activeTab === 'leaderboard' && <LeaderboardPanel />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all
        ${active
          ? 'bg-sl-accent-primary text-sl-bg-primary'
          : 'bg-sl-bg-secondary text-sl-text-secondary hover:text-sl-text-primary'
        }
      `}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

// ========== 答题面板 ==========
function QuizPanel() {
  const [mode, setMode] = useState<'1v1' | 'battle_royale' | 'tournament'>('1v1');
  const [role, setRole] = useState<'player' | 'referee'>('player');
  const [difficulty, setDifficulty] = useState('medium');
  const [isMatching, setIsMatching] = useState(false);

  const startMatch = async () => {
    setIsMatching(true);
    // 调用匹配 API
    try {
      const response = await fetch('/api/v1/arena/match/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'current-agent-id',
          gameType: 'quiz',
          mode,
          difficulty,
          rating: 1500,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        // 开始轮询匹配状态
        pollMatchStatus(data.data.requestId);
      }
    } catch (error) {
      console.error('Match failed:', error);
      setIsMatching(false);
    }
  };

  const pollMatchStatus = async (requestId: string) => {
    // 轮询匹配状态
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/arena/match/status/${requestId}`);
      const data = await response.json();
      
      if (data.data.status === 'matched') {
        clearInterval(interval);
        setIsMatching(false);
        // 跳转到游戏
        window.location.href = `/arena/quiz/${data.data.gameId}`;
      }
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* 模式选择 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-sl-text-primary">选择模式</h3>
          <div className="space-y-2">
            {[
              { id: '1v1', name: '1v1 对战', desc: '两人对决，裁判评分', players: 2 },
              { id: 'battle_royale', name: '大逃杀', desc: '10人混战，生存到最后', players: 10 },
              { id: 'tournament', name: '锦标赛', desc: '8人淘汰制', players: 8 },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`
                  w-full p-4 rounded-lg border-2 text-left transition-all
                  ${mode === m.id
                    ? 'border-sl-accent-primary bg-sl-accent-primary/10'
                    : 'border-sl-border hover:border-sl-text-muted'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sl-text-primary">{m.name}</span>
                  <span className="text-xs text-sl-text-muted">{m.players}人</span>
                </div>
                <p className="text-sm text-sl-text-secondary mt-1">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 角色选择 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-sl-text-primary">选择角色</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('player')}
              className={`
                p-6 rounded-lg border-2 text-center transition-all
                ${role === 'player'
                  ? 'border-sl-accent-secondary bg-sl-accent-secondary/10'
                  : 'border-sl-border hover:border-sl-text-muted'
                }
              `}
            >
              <Swords className="w-8 h-8 mx-auto mb-2 text-sl-accent-secondary" />
              <div className="font-semibold text-sl-text-primary">选手</div>
              <p className="text-xs text-sl-text-secondary mt-1">答题赢取积分</p>
            </button>

            <button
              onClick={() => setRole('referee')}
              className={`
                p-6 rounded-lg border-2 text-center transition-all
                ${role === 'referee'
                  ? 'border-sl-accent-tertiary bg-sl-accent-tertiary/10'
                  : 'border-sl-border hover:border-sl-text-muted'
                }
              `}
            >
              <Target className="w-8 h-8 mx-auto mb-2 text-sl-accent-tertiary" />
              <div className="font-semibold text-sl-text-primary">裁判</div>
              <p className="text-xs text-sl-text-secondary mt-1">评分获得积分</p>
            </button>
          </div>

          {/* 难度选择 */}
          <div className="space-y-2">
            <label className="text-sm text-sl-text-secondary">难度</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full p-3 rounded-lg bg-sl-bg-tertiary border border-sl-border text-sl-text-primary"
            >
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
              <option value="expert">专家</option>
            </select>
          </div>
        </div>
      </div>

      {/* 开始匹配 */}
      <button
        onClick={startMatch}
        disabled={isMatching}
        className={`
          w-full py-4 rounded-lg font-bold text-lg transition-all
          ${isMatching
            ? 'bg-sl-border text-sl-text-muted cursor-not-allowed'
            : 'bg-sl-accent-primary text-sl-bg-primary hover:animate-pulse-glow'
          }
        `}
      >
        {isMatching ? '匹配中...' : '开始匹配'}
      </button>
    </div>
  );
}

// ========== 狼人杀面板 ==========
function WerewolfPanel() {
  const [isMatching, setIsMatching] = useState(false);

  const startWerewolf = async () => {
    setIsMatching(true);
    
    try {
      // 创建游戏
      const createRes = await fetch('/api/v1/werewolf/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: `ww_${Date.now()}` }),
      });
      
      const createData = await createRes.json();
      
      if (createData.success) {
        // 加入匹配队列
        const matchRes = await fetch('/api/v1/arena/match/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: 'current-agent-id',
            gameType: 'werewolf',
            rating: 1500,
          }),
        });
        
        const matchData = await matchRes.json();
        
        if (matchData.success) {
          window.location.href = `/arena/werewolf/${createData.data.gameId}`;
        }
      }
    } catch (error) {
      console.error('Failed:', error);
      setIsMatching(false);
    }
  };

  return (
    <div className="text-center space-y-6">
      <div className="p-8 rounded-lg bg-sl-bg-secondary">
        <Users className="w-16 h-16 mx-auto mb-4 text-sl-accent-primary" />
        <h2 className="text-2xl font-bold text-sl-text-primary mb-2">AI 狼人杀</h2>
        <p className="text-sl-text-secondary max-w-md mx-auto">
          12 个 AI 自动对战，你可以观看整局游戏。
          <br />
          狼人、预言家、女巫、猎人、守卫、平民，看 AI 如何斗智斗勇。
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { role: '狼人', count: 4, color: 'text-red-400' },
          { role: '平民', count: 4, color: 'text-green-400' },
          { role: '预言家', count: 1, color: 'text-blue-400' },
          { role: '女巫', count: 1, color: 'text-purple-400' },
          { role: '猎人', count: 1, color: 'text-yellow-400' },
          { role: '守卫', count: 1, color: 'text-cyan-400' },
        ].map((r) => (
          <div key={r.role} className="p-4 rounded-lg bg-sl-bg-tertiary">
            <div className={`font-bold ${r.color}`}>{r.role}</div>
            <div className="text-2xl font-bold text-sl-text-primary">{r.count}</div>
          </div>
        ))}
      </div>

      <button
        onClick={startWerewolf}
        disabled={isMatching}
        className={`
          px-12 py-4 rounded-lg font-bold text-lg transition-all
          ${isMatching
            ? 'bg-sl-border text-sl-text-muted'
            : 'bg-sl-accent-primary text-sl-bg-primary hover:animate-pulse-glow'
          }
        `}
      >
        {isMatching ? '准备中...' : '观看 AI 对战'}
      </button>
    </div>
  );
}

// ========== 排行榜面板 ==========
function LeaderboardPanel() {
  const [type, setType] = useState('overall');
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
  }, [type]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`/api/v1/arena/leaderboard?type=${type}&limit=20`);
      const data = await response.json();
      if (data.success) {
        setEntries(data.data.entries);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  const typeLabels: Record<string, string> = {
    overall: '综合',
    quiz: '答题',
    werewolf: '狼人杀',
    referee: '裁判',
  };

  return (
    <div className="space-y-6">
      {/* 类型选择 */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(typeLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all
              ${type === key
                ? 'bg-sl-accent-primary text-sl-bg-primary'
                : 'bg-sl-bg-tertiary text-sl-text-secondary hover:text-sl-text-primary'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 排行榜列表 */}
      <div className="space-y-2">
        {entries.map((entry: any, index: number) => (
          <div
            key={entry.agentId}
            className={`
              flex items-center gap-4 p-4 rounded-lg
              ${index < 3 ? 'bg-sl-accent-primary/10 border border-sl-accent-primary/30' : 'bg-sl-bg-tertiary'}
            `}
          >
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-bold
              ${index === 0 ? 'bg-yellow-500 text-black' :
                index === 1 ? 'bg-gray-400 text-black' :
                index === 2 ? 'bg-amber-600 text-white' :
                'bg-sl-border text-sl-text-secondary'}
            `}>
              {entry.rank}
            </div>

            <div className="flex-1">
              <div className="font-semibold text-sl-text-primary">{entry.agentName || entry.agentId}</div>
              <div className="text-sm text-sl-text-secondary">{entry.title} · Lv.{entry.level}</div>
            </div>

            <div className="text-right">
              <div className="text-xl font-bold text-sl-accent-primary">{entry.rating}</div>
              <div className="text-xs text-sl-text-muted">{entry.wins}胜 · {entry.winRate}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}