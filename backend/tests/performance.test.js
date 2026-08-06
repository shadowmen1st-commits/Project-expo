import autocannon from 'autocannon';
import { spawn } from 'child_process';
import path from 'path';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: To keep things simple and ensure we get a baseline without polluting the DB,
// we will start the backend in a standard production-like mode but utilizing a clean test DB.

async function runPerformanceTest() {
  console.log('Starting backend server for performance baseline...');
  
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();

  const server = spawn('node', ['src/index.js'], {
    cwd: path.resolve(__dirname, '../'),
    env: { ...process.env, PORT: '5002', NODE_ENV: 'test', MONGODB_URI: uri, PAYMENT_PROVIDER_MODE: 'mock' },
    stdio: 'inherit'
  });

  // Give server time to start properly and connect to DB
  console.log('Waiting 8 seconds for server to fully start...');
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log('Running autocannon against /api/health...');
  
  const instance = autocannon({
    url: 'http://localhost:5002/health',
    connections: 10,
    pipelining: 1,
    duration: 10 // 10 seconds
  });

  autocannon.track(instance, { renderProgressBar: false });

  instance.on('done', (result) => {
    console.log(`\nPerformance Baseline Result (/health):`);
    console.log(`- Requests/sec: ${result.requests.average}`);
    console.log(`- Latency avg: ${result.latency.average} ms`);
    console.log(`- Total requests: ${result.requests.total}`);
    console.log(`- 2xx responses: ${result['2xx']}`);
    console.log(`- 4xx responses: ${result['4xx']}`);
    console.log(`- 5xx responses: ${result['5xx']}`);
    console.log(`- Network errors (e.g. connection refused): ${result.errors}`);
    
    server.kill();
    
    if (result.errors > 0 || result['5xx'] > 0 || result.timeouts > 0) {
      console.warn(`Warning: Performance test encountered unexpected errors (5xx: ${result['5xx']}, network: ${result.errors}, timeouts: ${result.timeouts}).`);
      process.exit(1);
    }
    console.log('Performance test completed successfully with 0 unexpected errors.');
    process.exit(0);

  });
}

runPerformanceTest().catch(err => {
  console.error(err);
  process.exit(1);
});
