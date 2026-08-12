import config from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { initializeSocket } from './socketServer.js';
import { closeSocketServer } from './socketServer.js';
import NotificationDispatcher from './services/notifications/NotificationDispatcher.js';
import { pathToFileURL } from 'node:url';

let server;
export async function startServer(port = config.PORT) {
    await connectDB();
    const app = createApp();
    await new Promise((resolve, reject) => {
        server = app.listen(port, resolve);
        server.once('error', reject);
    });
    initializeSocket(server);
    if (process.env.NODE_ENV !== 'test') {
        NotificationDispatcher.start(5000); // Poll every 5s
    }
    const actualPort = server.address().port;
    console.log(`Server successfully started on port ${actualPort} in ${config.NODE_ENV} mode.`);
    console.log(`[AUTH ROUTE VERIFICATION] Registered Auth Endpoints: /api/auth/login, /api/v1/auth/login, /api/auth/register, /api/v1/auth/register, /api/auth/me, /api/v1/auth/me`);
    return { app, server, port: actualPort };
}

export async function stopServer() {
    NotificationDispatcher.stop();
    await closeSocketServer();
    if (server) await new Promise(resolve => server.close(resolve));
    server = undefined;
    await disconnectDB();
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
    startServer().catch(error => { console.error('Failed to start server:', error.message); process.exitCode = 1; });
    const shutdown = async () => { await stopServer(); };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
}
