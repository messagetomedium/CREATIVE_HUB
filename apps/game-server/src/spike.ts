/** Loopback-only compatibility lab. Not a production game server and not connected to the browser. */
import { createServer } from 'node:http';
import { Server, Room, type Client } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { schema, t, StateView, type SchemaType } from '@colyseus/schema';

export const ProbeEntity = schema({ x: t.number(), label: t.string() }, 'CFProbeEntity');
export const ProbeState = schema({ players: t.map(ProbeEntity).view() }, 'CFProbeState');
export type ProbeState = SchemaType<typeof ProbeState>;
export class CompatibilityRoom extends Room<{ state: ProbeState }> {
  private reserved = new Map<string, number>();
  onCreate(): void {
    this.state = new ProbeState();
    this.setPatchRate(20);
    this.onMessage('change', (client, value: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (player && typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000)
        player.x = value;
    });
    this.onMessage('visibility', (client, value: { sessionId?: string; visible?: boolean }) => {
      if (!value || typeof value.sessionId !== 'string' || typeof value.visible !== 'boolean')
        return;
      const entity = this.state.players.get(value.sessionId);
      client.userData = { selfOnly: false };
      if (entity) {
        if (value.visible) client.view?.add(entity);
        else client.view?.remove(entity);
      }
    });
  }
  private publish(client: Client): void {
    const entity = new ProbeEntity();
    entity.x = this.reserved.get(client.sessionId) ?? 0;
    entity.label = client.sessionId;
    this.reserved.delete(client.sessionId);
    this.state.players.set(client.sessionId, entity);
    client.view = new StateView();
    for (const listener of this.clients) {
      listener.view ??= new StateView();
      for (const [id, player] of this.state.players)
        if (!listener.userData?.selfOnly || id === listener.sessionId) listener.view.add(player);
    }
  }
  onJoin(client: Client, options: { selfOnly?: boolean }): void {
    client.userData = { selfOnly: options.selfOnly === true };
    this.publish(client);
  }
  async onDrop(client: Client): Promise<void> {
    this.reserved.set(client.sessionId, this.state.players.get(client.sessionId)?.x ?? 0);
    this.state.players.delete(client.sessionId); // Visible state is removed BEFORE grace starts.
    try {
      await this.allowReconnection(client, 2);
    } catch {
      this.reserved.delete(client.sessionId);
    }
  }
  onReconnect(client: Client): void {
    this.publish(client);
  }
  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.reserved.delete(client.sessionId);
  }
}
export async function startCompatibilityServer(port = 0) {
  const http = createServer();
  const server = new Server({
    transport: new WebSocketTransport({ server: http, pingInterval: 1000, pingMaxRetries: 2 }),
    greet: false,
    gracefullyShutdown: false,
  });
  server.define('compatibility-spike', CompatibilityRoom);
  await server.listen(port, '127.0.0.1');
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('Cannot bind compatibility server');
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    close: () => server.gracefullyShutdown(false),
  };
}
