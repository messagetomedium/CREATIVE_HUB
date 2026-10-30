import type { PlayerState, Zone } from '@creative-factory/contracts';
import type { ContextInteraction } from './interactions';
export interface GameEvents {
  ready: undefined;
  zone: Zone | undefined;
  position: PlayerState;
  error: string;
  interaction: ContextInteraction | undefined;
  dismissInteraction: undefined;
}
export class GameBridge {
  private listeners = new Map<keyof GameEvents, Set<(value: never) => void>>();
  on<K extends keyof GameEvents>(event: K, listener: (value: GameEvents[K]) => void): () => void {
    const callbacks = this.listeners.get(event) ?? new Set();
    callbacks.add(listener as (value: never) => void);
    this.listeners.set(event, callbacks);
    return () => {
      callbacks.delete(listener as (value: never) => void);
    };
  }
  emit<K extends keyof GameEvents>(event: K, value: GameEvents[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(value as never));
  }
  dispose(): void {
    this.listeners.clear();
  }
}
