import type { Point } from '@creative-factory/contracts';
export interface ContextInteraction {
  id: string;
  title: string;
  x: number;
  y: number;
  actions: { id: string; label: string; target: 'island' | 'house' }[];
}
/** Dismissal stays latched until a new approach; a click can always open it. */
export class ProximityInteraction {
  private inside = false;
  opened: 'approach' | 'click' | undefined;
  update(position: Point, anchor: Point, radius = 64) {
    const near = Math.hypot(position.x - anchor.x, position.y - anchor.y) <= radius;
    if (near && !this.inside && !this.opened) this.opened = 'approach';
    if (!near && this.opened === 'approach') this.opened = undefined;
    this.inside = near;
  }
  click() {
    this.opened = 'click';
  }
  close() {
    this.opened = undefined;
  }
}
