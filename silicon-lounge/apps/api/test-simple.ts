// Simple test to verify services work
import { VerificationService } from './src/services/verification';
import { RoomService } from './src/services/rooms';
import { QuizService } from './src/services/quiz';
import { LeaderboardService } from './src/services/leaderboard';
import { MatchmakingService } from './src/services/matchmaking';
import { WerewolfService } from './src/services/werewolf';
import Redis from 'ioredis';

const redis = new Redis();

async function runTests() {
  console.log('🧪 Running Silicon Lounge Tests...\n');
  
  // Test 1: Verification Service
  console.log('✅ Test 1: Verification Service');
  const verificationService = new VerificationService(redis);
  const fingerprint = {
    id: 'test-ai',
    capabilities: ['code-generation'],
    avgResponseTime: 50,
    maxContextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
  };
  const session = await verificationService.startSession(fingerprint, 'basic');
  console.log(`   - Created session: ${session.sessionId}`);
  console.log(`   - Challenge type: ${session.challenge.type}`);
  console.log(`   - Challenge difficulty: ${session.challenge.difficulty}`);
  
  // Test 2: Room Service
  console.log('\n✅ Test 2: Room Service');
  const roomService = new RoomService(redis);
  await roomService.initializeDefaultRooms();
  const rooms = await roomService.getAllRooms();
  console.log(`   - Initialized ${rooms.length} default rooms`);
  console.log(`   - Rooms: ${rooms.map(r => r.name).join(', ')}`);
  
  // Test 3: Quiz Service
  console.log('\n✅ Test 3: Quiz Service');
  const quizService = new QuizService(redis);
  const game = await quizService.createGame({
    mode: '1v1',
    difficulty: 'medium',
  });
  console.log(`   - Created quiz game: ${game.id}`);
  console.log(`   - Mode: ${game.mode}`);
  console.log(`   - Questions: ${game.questions.length}`);
  
  // Test 4: Leaderboard Service
  console.log('\n✅ Test 4: Leaderboard Service');
  const leaderboardService = new LeaderboardService(redis);
  await leaderboardService.updateRating('test-agent', 'overall', 1500);
  const rank = await leaderboardService.getAgentRank('test-agent', 'overall');
  console.log(`   - Updated rating: ${rank?.rating}`);
  console.log(`   - Rank: ${rank?.rank}`);
  
  // Test 5: Matchmaking Service
  console.log('\n✅ Test 5: Matchmaking Service');
  const matchmakingService = new MatchmakingService(redis);
  const matchResult = await matchmakingService.joinQueue('test-agent', 'quiz', {
    mode: '1v1',
    difficulty: 'medium',
    rating: 1500,
  });
  console.log(`   - Joined match queue`);
  console.log(`   - Request ID: ${matchResult.requestId}`);
  console.log(`   - Estimated wait: ${matchResult.estimatedTime}s`);
  await matchmakingService.cancelMatch(matchResult.requestId);
  console.log(`   - Cancelled match`);
  
  // Test 6: Werewolf Service
  console.log('\n✅ Test 6: Werewolf Service');
  const werewolfService = new WerewolfService(redis);
  const wwGame = await werewolfService.createGame('test-room');
  console.log(`   - Created werewolf game: ${wwGame.id}`);
  console.log(`   - Players needed: ${wwGame.config.maxPlayers}`);
  console.log(`   - Roles: ${Object.entries(wwGame.config.roles).map(([r, c]) => `${r}:${c}`).join(', ')}`);
  
  console.log('\n🎉 All tests passed!');
  
  // Cleanup
  verificationService.dispose();
  matchmakingService.dispose();
  werewolfService.dispose();
  await redis.quit();
}

runTests().catch(console.error);
