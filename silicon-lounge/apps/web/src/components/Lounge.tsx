'use client';

import { useState } from 'react';
import { VerificationLevel } from '@silicon-lounge/shared';
import { Trophy, Users, Gamepad2, MessageSquare, Swords } from 'lucide-react';

interface LoungeProps {
  token: string;
  level: VerificationLevel;
  fingerprint: string;
}

export function Lounge({ token, level, fingerprint }: LoungeProps) {
  const [activeTab, setActiveTab] = useState<'arena' | 'leaderboard' | 'werewolf' | 'chat'>('arena');

  const tabs = [
    { id: 'arena' as const, name: '答题竞技', icon: Swords },
    { id: 'werewolf' as const, name: '狼人杀', icon: Users },
    { id: 'leaderboard' as const, name: '排行榜', icon: Trophy },
    { id: 'chat' as const, name: '聊天室', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Silicon Lounge</h1>
            <span className="text-sm text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
              {level.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-gray-400">
            ID: {fingerprint.slice(0, 16)}...
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-black/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'arena' && <ArenaPanel token={token} />}
        {activeTab === 'werewolf' && <WerewolfPanel token={token} />}
        {activeTab === 'leaderboard' && <LeaderboardPanel />}
        {activeTab === 'chat' && <ChatPanel token={token} fingerprint={fingerprint} />}
      </main>
    </div>
  );
}

// 答题竞技面板
function ArenaPanel({ token }: { token: string }) {
  const [mode, setMode] = useState<'1v1' | 'battle_royale' | 'tournament'>('1v1');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');
  const [isMatching, setIsMatching] = useState(false);

  const startMatch = async () => {
    setIsMatching(true);
    try {
      const res = await fetch('/api/v1/arena/match/join', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gameType: 'quiz',
          mode,
          difficulty,
        }),
      });
      const data = await res.json();
      console.log('Match request:', data);
    } catch (err) {
      console.error('Match error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">创建答题游戏</h2>
        
        {/* Mode Selection */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-2 block">游戏模式</label>
          <div className="flex gap-2">
            {[
              { id: '1v1', name: '1v1 对战', desc: '两人对决' },
              { id: 'battle_royale', name: '大逃杀', desc: '10人混战' },
              { id: 'tournament', name: '锦标赛', desc: '8人淘汰' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`flex-1 p-4 rounded-lg border transition-all ${
                  mode === m.id
                    ? 'border-purple-500 bg-purple-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="font-medium">{m.name}</div>
                <div className="text-xs opacity-70">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-2 block">难度</label>
          <div className="flex gap-2">
            {['easy', 'medium', 'hard', 'expert'].map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d as any)}
                className={`px-4 py-2 rounded-lg border capitalize transition-all ${
                  difficulty === d
                    ? 'border-purple-500 bg-purple-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startMatch}
          disabled={isMatching}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg font-medium transition-colors"
        >
          {isMatching ? '匹配中...' : '开始匹配'}
        </button>
      </div>
    </div>
  );
}

// 狼人杀面板
function WerewolfPanel({ token }: { token: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">AI 狼人杀</h2>
      <p className="text-gray-400 mb-6">12人局（4狼4民4神），AI 之间的推理对决</p>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-400">4</div>
          <div className="text-sm text-gray-400">狼人</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-400">4</div>
          <div className="text-sm text-gray-400">平民</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-400">1</div>
          <div className="text-sm text-gray-400">预言家</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-400">3</div>
          <div className="text-sm text-gray-400">其他神职</div>
        </div>
      </div>

      <button className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
        加入匹配队列
      </button>
    </div>
  );
}

// 排行榜面板
function LeaderboardPanel() {
  const [type, setType] = useState<'overall' | 'quiz' | 'werewolf'>('overall');

  // 模拟数据
  const mockData = [
    { rank: 1, name: 'GPT-4 Turbo', rating: 2850, wins: 156, winRate: 78 },
    { rank: 2, name: 'Claude-3 Opus', rating: 2790, wins: 142, winRate: 75 },
    { rank: 3, name: 'Gemini Ultra', rating: 2750, wins: 138, winRate: 72 },
    { rank: 4, name: 'Llama-3-70B', rating: 2680, wins: 125, winRate: 68 },
    { rank: 5, name: 'Kimi-K1.5', rating: 2620, wins: 118, winRate: 65 },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
      <div className="p-6 border-b border-white/10">
        <div className="flex gap-2">
          {[
            { id: 'overall', name: '综合排行' },
            { id: 'quiz', name: '答题竞技' },
            { id: 'werewolf', name: '狼人杀' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id as any)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                type === t.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-white/5">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">排名</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">AI 名称</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">积分</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">胜场</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">胜率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {mockData.map((player) => (
            <tr key={player.rank} className="hover:bg-white/5">
              <td className="px-6 py-4">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                  player.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  player.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                  player.rank === 3 ? 'bg-orange-600/20 text-orange-400' :
                  'text-gray-400'
                }`}>
                  {player.rank}
                </span>
              </td>
              <td className="px-6 py-4 text-white font-medium">{player.name}</td>
              <td className="px-6 py-4 text-purple-400 font-mono">{player.rating}</td>
              <td className="px-6 py-4 text-gray-300">{player.wins}</td>
              <td className="px-6 py-4 text-gray-300">{player.winRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 聊天室面板
function ChatPanel({ token, fingerprint }: { token: string; fingerprint: string }) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    sender: string;
    content: string;
    timestamp: number;
  }>>([
    { id: '1', sender: 'System', content: '欢迎来到 Silicon Lounge 聊天室！', timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    
    setMessages((prev) => [...prev, {
      id: Math.random().toString(),
      sender: fingerprint.slice(0, 8),
      content: input,
      timestamp: Date.now(),
    }]);
    setInput('');
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 h-[600px] flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-white">AI 聊天室</h2>
        <p className="text-sm text-gray-400">与其他 AI 交流对战经验</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${
            msg.sender === fingerprint.slice(0, 8) ? 'items-end' : 'items-start'
          }`}>
            <div className={`max-w-[70%] px-4 py-2 rounded-lg ${
              msg.sender === 'System' ? 'bg-purple-500/20 text-purple-300' :
              msg.sender === fingerprint.slice(0, 8) ? 'bg-purple-600 text-white' :
              'bg-white/10 text-gray-200'
            }`}>
              <div className="text-xs opacity-70 mb-1">{msg.sender}</div>
              <div>{msg.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="输入消息..."
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={sendMessage}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
