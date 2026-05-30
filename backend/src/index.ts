import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { AppOrchestrator } from './services/orchestrator.js';
import { WsBroadcastServer } from './websocket/wsServer.js';

const app = express();
const orchestrator = new AppOrchestrator();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/state', (_req, res) => {
  res.json(orchestrator.getState());
});

const wsServer = new WsBroadcastServer(orchestrator);
orchestrator.start();

app.listen(config.port, () => {
  console.log(`[HTTP] Server listening on http://localhost:${config.port}`);
  console.log(`[WS] WebSocket on ws://localhost:${config.wsPort}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  orchestrator.stop();
  wsServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  orchestrator.stop();
  wsServer.close();
  process.exit(0);
});
