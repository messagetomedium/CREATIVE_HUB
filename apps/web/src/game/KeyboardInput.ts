import type { MovementInput } from '@creative-factory/contracts';
import { NEUTRAL_INPUT } from '@creative-factory/world-core';
const handled = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
export class KeyboardInput {
  private held = new Set<string>();
  private down = (event: KeyboardEvent) => {
    if (handled.has(event.code)) {
      event.preventDefault();
      this.held.add(event.code);
    }
  };
  private up = (event: KeyboardEvent) => {
    this.held.delete(event.code);
  };
  private clear = () => {
    this.held.clear();
  };
  private visibility = () => {
    if (document.hidden) this.clear();
  };
  private focus = () => this.canvas.focus({ preventScroll: true });
  constructor(private canvas: HTMLCanvasElement) {
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Карта завода. Перемещение: WASD или стрелки.');
    canvas.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    canvas.addEventListener('blur', this.clear);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.visibility);
    canvas.addEventListener('pointerdown', this.focus);
  }
  read(): MovementInput {
    if (document.hidden || document.activeElement !== this.canvas) return NEUTRAL_INPUT;
    return {
      up: this.held.has('KeyW') || this.held.has('ArrowUp'),
      down: this.held.has('KeyS') || this.held.has('ArrowDown'),
      left: this.held.has('KeyA') || this.held.has('ArrowLeft'),
      right: this.held.has('KeyD') || this.held.has('ArrowRight'),
    };
  }
  dispose(): void {
    this.clear();
    this.canvas.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    this.canvas.removeEventListener('blur', this.clear);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.visibility);
    this.canvas.removeEventListener('pointerdown', this.focus);
  }
}
