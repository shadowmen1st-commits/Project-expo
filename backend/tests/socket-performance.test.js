import { io } from 'socket.io-client';
import { spawn } from 'child_process';
import path from 'path';
import jwt from 'jsonwebtoken';

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSocketPerformance() {
  console.log('Starting backend server for socket performance baseline...');
  
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();

  const server = spawn('node', ['src/index.js'], {
    cwd: path.resolve(__dirname, '../'),
    env: { ...process.env, PORT: '5003', NODE_ENV: 'e2e', MONGODB_URI: uri, PAYMENT_PROVIDER_MODE: 'mock', JWT_ACCESS_SECRET: 'test-secret', JWT_REFRESH_SECRET: 'test-secret' },
    stdio: 'inherit'
  });

  console.log('Waiting 8 seconds for server to fully start...');
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Need to seed DB directly before spawning clients or they will fail auth
  const mongoose = await import('mongoose');
  await mongoose.connect(uri);
  const User = (await import('../src/models/User.js')).default;
  for (let i = 0; i < 25; i++) {
    await User.create({ _id: new mongoose.Types.ObjectId(), name: `Test User ${i}`, email: `user_${i}@test.com`, role: 'CUSTOMER', status: 'ACTIVE', passwordHash: '123' }).catch((err) => { console.error('Failed to seed user:', err.message); });
  }
  const users = await User.find({});

  console.log('Simulating 25 concurrent Socket.IO clients...');
  
  const clients = [];
  let connectedCount = 0;
  
  const latencies = [];
  let messagesReceived = 0;
  let duplicates = 0;
  const messageIds = new Set();

  for (let i = 0; i < 25; i++) {
    const token = jwt.sign({ userId: String(users[i]._id), role: 'CUSTOMER' }, 'test-secret', { expiresIn: '1h' });
    const socket = io('http://localhost:5003', {
      transports: ['websocket'],
      reconnection: false,
      auth: { token }
    });

    clients.push(socket);

    socket.on('connect', () => {
      connectedCount++;
      // Send a test message with a timestamp
      socket.emit('ping', { id: `msg_${i}`, timestamp: Date.now() });
    });
    
    socket.on('connect_error', (err) => {
      console.error(`Socket ${i} connect_error:`, err.message);
    });

    socket.on('pong', (data) => {
      if (messageIds.has(data.id)) {
        duplicates++;
      } else {
        messageIds.add(data.id);
        messagesReceived++;
        latencies.push(Date.now() - data.timestamp);
      }
    });
  }

  // Wait for connections and messages
  await new Promise(resolve => setTimeout(resolve, 5000));

  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const missing = connectedCount - messagesReceived;

  console.log(`\nSocket Performance Baseline Result:`);
  console.log(`- Connected clients: ${connectedCount}/25`);
  console.log(`- Latency avg: ${avgLatency.toFixed(2)} ms`);
  console.log(`- Messages received: ${messagesReceived}`);
  console.log(`- Duplicate messages: ${duplicates}`);
  console.log(`- Missing messages: ${missing}`);
  
  for (const socket of clients) {
    socket.disconnect();
  }

  server.kill();
  
  if (connectedCount < 25) {
    console.warn('Some sockets failed to connect in time.');
  }
  if (missing > 0 || duplicates > 0) {
    console.warn('Warning: Missing or duplicate messages detected.');
  }
  
  console.log('Socket performance test completed successfully.');
  process.exit(0);
}

runSocketPerformance().catch(err => {
  console.error(err);
  process.exit(1);
});
