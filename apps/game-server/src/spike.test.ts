import { afterAll, beforeAll, expect, it } from 'vitest';
import { Client, getStateCallbacks, type Room } from '@colyseus/sdk';
import { startCompatibilityServer, type ProbeState } from './spike.js';
let server: Awaited<ReturnType<typeof startCompatibilityServer>>;
const rooms: Room<unknown, ProbeState>[] = [];
beforeAll(async () => {
  server = await startCompatibilityServer();
});
afterAll(async () => {
  for (const room of rooms) if (room.connection.isOpen) await room.leave();
  await server?.close();
});
it('two real clients receive additions, patches, filtered removal and reconnect without visible ghosts', async () => {
  const sdkA = new Client(server.endpoint),
    sdkB = new Client(server.endpoint);
  const a = await sdkA.joinOrCreate<ProbeState>('compatibility-spike');
  rooms.push(a);
  a.reconnection.enabled = false;
  const b = await sdkB.joinById<ProbeState>(a.roomId, { selfOnly: true });
  rooms.push(b);
  b.reconnection.enabled = false;
  await expect.poll(() => a.state?.players.size).toBe(2);
  await expect.poll(() => b.state?.players.size).toBe(1);
  expect(b.state.players.has(a.sessionId)).toBe(false); // Filtered from the initial snapshot too.
  b.send('visibility', { sessionId: a.sessionId, visible: true });
  await expect.poll(() => b.state?.players.size).toBe(2);
  const removed: string[] = [];
  const callbacks = getStateCallbacks(b);
  const off = callbacks(b.state).players.onRemove((_entity, id) => removed.push(id));
  a.send('change', 42);
  await expect.poll(() => b.state.players.get(a.sessionId)?.x).toBe(42);
  b.send('visibility', { sessionId: a.sessionId, visible: false });
  await expect.poll(() => b.state.players.has(a.sessionId)).toBe(false);
  expect(a.state.players.size).toBe(2); // Filtering is per recipient, not deletion from the room.
  a.send('change', 77);
  await expect.poll(() => a.state.players.get(a.sessionId)?.x).toBe(77);
  expect(b.state.players.has(a.sessionId)).toBe(false);
  b.send('visibility', { sessionId: a.sessionId, visible: true });
  await expect.poll(() => b.state.players.get(a.sessionId)?.x).toBe(77);
  const token = a.reconnectionToken,
    sessionId = a.sessionId;
  // Browser-compatible WebSocket only permits 1000 or application codes 3000–4999.
  a.connection.close(4001, 'test transport interruption');
  await expect.poll(() => b.state.players.has(sessionId)).toBe(false);
  const resumed = await sdkA.reconnect<ProbeState>(token);
  rooms.push(resumed);
  resumed.reconnection.enabled = false;
  expect(resumed.sessionId).toBe(sessionId);
  await expect.poll(() => b.state.players.get(sessionId)?.x).toBe(77);
  await expect.poll(() => resumed.state?.players.size).toBe(2);
  await resumed.leave();
  await expect.poll(() => b.state.players.has(sessionId)).toBe(false);
  expect(removed.filter((id) => id === sessionId).length).toBeGreaterThanOrEqual(3);
  off();
});
