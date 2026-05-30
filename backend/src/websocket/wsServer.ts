import { WebSocketServer, WebSocket } from 'ws';
import type { AppState, WsMessage } from '../types/index.js';
import { config } from '../config.js';
import type { AppOrchestrator } from '../services/orchestrator.js';

export class WsBroadcastServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private unsubscribe: (() => void) | null = null;

  constructor(private orchestrator: AppOrchestrator) {
    this.wss = new WebSocketServer({ port: config.wsPort });
    this.setup();
  }

  private setup(): void {
    this.wss.on('connection', (socket) => {
      this.clients.add(socket);
      console.log(`[WS] Client connected (${this.clients.size} total)`);

      const state = this.orchestrator.getState();
      this.sendToClient(socket, state);

      socket.on('close', () => {
        this.clients.delete(socket);
        console.log(`[WS] Client disconnected (${this.clients.size} total)`);
      });

      socket.on('error', (error) => {
        console.error('[WS] Client error:', error.message);
        this.clients.delete(socket);
      });
    });

    this.unsubscribe = this.orchestrator.onStateChange((state: AppState) => {
      this.broadcast(state);
    });

    setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          const ping: WsMessage = { type: 'ping', timestamp: Date.now() };
          client.send(JSON.stringify(ping));
        }
      }
    }, 30_000);

    console.log(`[WS] Server listening on ws://localhost:${config.wsPort}`);
  }

  private sendToClient(client: WebSocket, state: AppState): void {
    const message: WsMessage = {
      type: 'state',
      payload: state,
      timestamp: Date.now(),
    };
    client.send(JSON.stringify(message));
  }

  private broadcast(state: AppState): void {
    const message: WsMessage = {
      type: 'state',
      payload: state,
      timestamp: Date.now(),
    };
    const payload = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  close(): void {
    this.unsubscribe?.();
    for (const client of this.clients) {
      client.close();
    }
    this.wss.close();
  }
}
