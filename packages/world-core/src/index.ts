import type {
  MovementInput,
  PlayerState,
  Point,
  Rect,
  World,
  Zone,
} from '@creative-factory/contracts';

export const FIXED_STEP_MS = 1000 / 30;
export const PLAYER_SPEED = 168;
export const PLAYER_HALF_WIDTH = 10;
export const PLAYER_HALF_HEIGHT = 8;
export const NEUTRAL_INPUT: MovementInput = { up: false, down: false, left: false, right: false };
export function contains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function canOccupy(world: World, point: Point): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const box = {
    x: point.x - PLAYER_HALF_WIDTH,
    y: point.y - PLAYER_HALF_HEIGHT,
    width: PLAYER_HALF_WIDTH * 2,
    height: PLAYER_HALF_HEIGHT * 2,
  };
  if (
    box.x < 0 ||
    box.y < 0 ||
    box.x + box.width > world.width * world.tileSize ||
    box.y + box.height > world.height * world.tileSize
  )
    return false;
  const epsilon = 0.000001;
  const right = Math.floor((box.x + box.width - epsilon) / world.tileSize);
  const bottom = Math.floor((box.y + box.height - epsilon) / world.tileSize);
  for (let y = Math.floor(box.y / world.tileSize); y <= bottom; y++) {
    for (let x = Math.floor(box.x / world.tileSize); x <= right; x++) {
      if (world.solids[y * world.width + x]) return false;
    }
  }
  return !world.props.some((prop) => prop.solid && overlaps(box, prop.bounds));
}
/** One fixed simulation step, shared later with the authoritative server. No Phaser dependency. */
export function stepPlayer(state: PlayerState, input: MovementInput, world: World): PlayerState {
  let dx = Number(input.right) - Number(input.left);
  let dy = Number(input.down) - Number(input.up);
  const direction =
    dy < 0 ? 'north' : dy > 0 ? 'south' : dx < 0 ? 'west' : dx > 0 ? 'east' : state.direction;
  const length = Math.hypot(dx, dy);
  if (!length) return { ...state, moving: false };
  const distance = (PLAYER_SPEED * FIXED_STEP_MS) / 1000;
  dx = (dx / length) * distance;
  dy = (dy / length) * distance;
  // Short substeps prevent tunnelling even through a thin future object collider.
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3);
  let x = state.x,
    y = state.y;
  for (let i = 0; i < steps; i++) {
    if (canOccupy(world, { x: x + dx / steps, y })) x += dx / steps;
    if (canOccupy(world, { x, y: y + dy / steps })) y += dy / steps;
  }
  return { x, y, direction, moving: x !== state.x || y !== state.y };
}
export function zoneAt(world: World, point: Point): Zone | undefined {
  return world.zones
    .filter((zone) => contains(zone.bounds, point))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
}
export function initialPlayer(world: World): PlayerState {
  if (!canOccupy(world, world.spawn)) throw new Error('Точка входа заблокирована');
  return { ...world.spawn, direction: 'north', moving: false };
}
