import { spawn } from 'node:child_process';
import net from 'node:net';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const started = Date.now();
let child;
let port;
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const selected = server.address().port; server.close(() => resolve(selected)); });
});

try {
  port = await freePort();
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  child = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:59999/api', VITE_SOCKET_URL: 'http://127.0.0.1:59999' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  let response;
  for (let index = 0; index < 60; index += 1) {
    if (child.exitCode !== null) throw new Error(`Vite exited early (${child.exitCode}): ${logs}`);
    try { response = await fetch(`http://127.0.0.1:${port}/`); if (response.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!response?.ok) throw new Error(`Frontend did not become ready: ${logs}`);
  const html = await response.text();
  if (!html.includes('id="root"') || !html.includes('/src/main.')) throw new Error('Main application HTML was not returned.');
  const files = [
    'src/components/chat/Chat.jsx', 'src/components/chat/NotificationCentre.jsx', 'src/pages/SupportPortal.jsx',
    'src/components/AdminSupportPanel.jsx', 'src/components/AdminChatModerationPanel.jsx', 'src/pages/WorkerDashboard.jsx',
  ];
  for (const file of files) await access(path.join(root, file));
  const communication = await Promise.all(files.map(file => readFile(path.join(root, file), 'utf8')));
  if (communication.some(source => source.includes('dangerouslySetInnerHTML'))) throw new Error('Unsafe HTML rendering found.');
  if (communication.some(source => /localhost:(5000|5001)/.test(source))) throw new Error('Hard-coded backend/socket port found.');
  if (communication.some(source => /localStorage\.(setItem|getItem)\([^)]*(token|jwt)/i.test(source))) throw new Error('Authentication token localStorage usage found.');
  if (!communication[0].includes('VITE_SOCKET_URL') || !communication[0].includes('VITE_API_URL')) throw new Error('Socket/API URLs are not environment driven.');
  console.log(`FRONTEND_SMOKE_PORT=${port} FRONTEND_STARTUP_DURATION_MS=${Date.now() - started} HTTP_STATUS=${response.status} COMPONENT_IMPORT_SMOKE=PASS`);
} finally {
  if (child && !child.killed) {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  console.log('FRONTEND_SMOKE_SHUTDOWN=PASS');
}
