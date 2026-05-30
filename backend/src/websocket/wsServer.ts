import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { AppState, WsMessage } from '../types/index.js';
import type { AppOrchestrator } from '../services/orchestrator.js';

export class WsBroadcastServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private unsubscribe: (() => void) | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private orchestrator: AppOrchestrator,
    httpServer: HttpServer,
  ) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });
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

    this.wss.on('error', (error) => {
      console.error('[WS] Server error:', error.message);
    });

    this.unsubscribe = this.orchestrator.onStateChange((state: AppState) => {
      this.broadcast(state);
    });

    this.pingTimer = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          const ping: WsMessage = { type: 'ping', timestamp: Date.now() };
          client.send(JSON.stringify(ping));
        }
      }
    }, 30_000);

    console.log('[WS] WebSocket attached at path /ws');
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
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.unsubscribe?.();
    for (const client of this.clients) {
      client.close();
    }
    this.wss.close();
  }
}
