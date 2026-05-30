import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server as HttpServer } from 'http';
import type { RuntimeSettings } from './types/index.js';
import { config } from './config.js';
import { AppOrchestrator } from './services/orchestrator.js';
import { settingsService } from './services/settingsService.js';
import { WsBroadcastServer } from './websocket/wsServer.js';

const app = express();
const orchestrator = new AppOrchestrator();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/state', (_req, res) => {
  res.json(orchestrator.getState());
});

app.get('/api/settings', (_req, res) => {
  res.json(settingsService.get());
});

app.patch('/api/settings', (req, res) => {
  try {
    const body = req.body as Partial<RuntimeSettings>;
    const allowedKeys: (keyof RuntimeSettings)[] = [
      'demoMode',
      'autoExecute',
      'pollIntervalMs',
      'minNetProfitPct',
      'minVolumeBtc',
      'maxCombinedLatencyMs',
      'circuitBreakerThreshold',
      'circuitBreakerCooldownMs',
    ];

    const partial: Partial<RuntimeSettings> = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        partial[key] = body[key] as never;
      }
    }

    if (Object.keys(partial).length === 0) {
      res.status(400).json({ error: 'No valid settings provided' });
      return;
    }

    const updated = orchestrator.updateSettings(partial);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../frontend/dist',
  );
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

let wsServer: WsBroadcastServer;
let httpServer: HttpServer;

httpServer = app.listen(config.port, () => {
  wsServer = new WsBroadcastServer(orchestrator, httpServer);
  orchestrator.start();
  console.log(`[HTTP] Server listening on http://localhost:${config.port}`);
  console.log(`[WS] WebSocket available at ws://localhost:${config.port}/ws`);
  console.log(`[Settings] SQLite store loaded (demoMode=${settingsService.get().demoMode})`);
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[HTTP] Port ${config.port} is already in use. Change PORT in backend/.env`);
  } else {
    console.error('[HTTP] Server error:', error.message);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  orchestrator.stop();
  wsServer?.close();
  httpServer?.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  orchestrator.stop();
  wsServer?.close();
  httpServer?.close();
  process.exit(0);
});
