const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Silicon Lounge Features...\n');

// Check services
const servicesDir = './src/services';
const services = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts') && !f.includes('.test.'));

console.log('📦 Services (' + services.length + '):');
services.forEach(s => {
  const content = fs.readFileSync(path.join(servicesDir, s), 'utf8');
  const lines = content.split('\n').length;
  const hasExport = content.includes('export class');
  const hasMethods = (content.match(/async \w+\(/g) || []).length;
  console.log(`  ✅ ${s.replace('.ts', '')}: ${lines} lines, ${hasMethods} methods`);
});

// Check routes
const routesDir = './src/routes';
const routes = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

console.log('\n🌐 Routes (' + routes.length + '):');
routes.forEach(r => {
  const content = fs.readFileSync(path.join(routesDir, r), 'utf8');
  const endpoints = (content.match(/fastify\.(get|post|put|delete)/g) || []).length;
  console.log(`  ✅ ${r.replace('.ts', '')}: ${endpoints} endpoints`);
});

// Check tests
const testsDir = './src/__tests__';
const tests = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

console.log('\n🧪 Tests (' + tests.length + '):');
tests.forEach(t => {
  const content = fs.readFileSync(path.join(testsDir, t), 'utf8');
  const testCases = (content.match(/it\(/g) || []).length;
  console.log(`  ✅ ${t.replace('.test.ts', '')}: ${testCases} test cases`);
});

// Check frontend
const webDir = '../web/src';
if (fs.existsSync(webDir)) {
  const pages = fs.readdirSync(webDir + '/app').filter(f => f.endsWith('.tsx') || f === 'page.tsx');
  console.log('\n🎨 Frontend Pages:');
  pages.forEach(p => console.log(`  ✅ ${p}`));
}

console.log('\n📊 Summary:');
console.log(`  - Services: ${services.length}`);
console.log(`  - Routes: ${routes.length}`);
console.log(`  - Tests: ${tests.length}`);
console.log(`  - Frontend Pages: ${fs.existsSync(webDir) ? fs.readdirSync(webDir + '/app').filter(f => f.endsWith('.tsx')).length : 0}`);
