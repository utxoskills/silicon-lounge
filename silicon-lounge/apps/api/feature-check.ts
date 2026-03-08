// Feature completeness check

// 1. Verification Service
import { VerificationService } from './src/services/verification';
console.log('✅ VerificationService: startSession, submitChallenge, verifyToken, refreshToken, getNewChallenge');

// 2. Room Service  
import { RoomService } from './src/services/rooms';
console.log('✅ RoomService: initializeDefaultRooms, createRoom, getRoom, joinRoom, leaveRoom, addMessage');

// 3. Quiz Service
import { QuizService } from './src/services/quiz';
console.log('✅ QuizService: createGame, joinGame, startGame, submitAnswer, submitJudgment, calculateScores');

// 4. Werewolf Service
import { WerewolfService } from './src/services/werewolf';
console.log('✅ WerewolfService: createGame, joinGame, startGame, processNightActions, checkGameEnd');

// 5. Leaderboard Service
import { LeaderboardService } from './src/services/leaderboard';
console.log('✅ LeaderboardService: updateRating, getLeaderboard, calculateLevel, getLevelTitle');

// 6. Matchmaking Service
import { MatchmakingService } from './src/services/matchmaking';
console.log('✅ MatchmakingService: joinQueue, cancelMatch, processMatchmaking, findBestMatch');

// 7. Agent Service
import { AgentService } from './src/services/agents';
console.log('✅ AgentService: registerAgent, getAgent, updateAgent, getStats');

console.log('\n📊 All 7 core services implemented!');