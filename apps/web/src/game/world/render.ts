import Phaser from 'phaser';
import type { GameLocation } from '@creative-factory/contracts';
import { feetDepth } from '@creative-factory/contracts';
import { terrainAt } from './terrain';
function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}
/** Static native-pixel terrain. Edges sample the same world coordinates across tiles. */
export function landscape(world: GameLocation, seed: number) {
  const c = canvas(world.width * 32, world.height * 32),
    ctx = c.getContext('2d')!;
  const at = (x: number, y: number) => world.ground[y * world.width + x] ?? 0;
  const hash = (x: number, y: number) => {
    let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + 17, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  };
  // Four-corner autotiling softens the mask without changing the grid collider.
  for (let ty = 0; ty < world.height; ty++)
    for (let tx = 0; tx < world.width; tx++) {
      const id = at(tx, ty);
      for (let py = 0; py < 32; py++)
        for (let px = 0; px < 32; px++) {
          const x = tx * 32 + px,
            y = ty * 32 + py;
          let material = id;
          if (world.id === 'island' && id !== 0) {
            const left = at(tx - 1, ty),
              right = at(tx + 1, ty),
              top = at(tx, ty - 1),
              bottom = at(tx, ty + 1);
            const edge = (v: number) =>
              v !== id && (v === 0 || (id === 2 && v !== 4) || (id === 3 && v === 1));
            const pad = 2 + ((Math.floor(x / 5) + Math.floor(y / 7)) % 2);
            if (edge(left) && px < pad) material = left;
            if (edge(right) && px >= 32 - pad) material = right;
            if (edge(top) && py < pad) material = top;
            if (edge(bottom) && py >= 32 - pad) material = bottom;
            for (const [sx, sy, a, b] of [
              [-1, -1, left, top],
              [1, -1, right, top],
              [-1, 1, left, bottom],
              [1, 1, right, bottom],
            ] as const) {
              const dx = sx < 0 ? px : 31 - px,
                dy = sy < 0 ? py : 31 - py;
              if (a === b && edge(a) && dx < 9 && dy < 9 && (dx - 9) ** 2 + (dy - 9) ** 2 > 81)
                material = a;
            }
          }
          const terrain = terrainAt(material),
            n = hash(x, y),
            patch = hash(Math.floor(x / 64), Math.floor(y / 64));
          let color = terrain.source.kind === 'placeholder' ? terrain.source.color : '#83b86c';
          if (material === 4) {
            if (y % 16 === 15 || (x + (Math.floor(y / 16) % 2) * 32) % 64 === 63) color = '#c5a47f';
          } else if (material === 0) {
            if (y % 32 === 12 && (x + Math.floor(y / 32) * 13) % 61 < 8) color = '#8bc7c7';
          } else if (n % 137 < 3 || (patch % 5 === 0 && n % 23 === 0))
            color = terrain.variants[n % 2]!;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
    }
  return c;
}
function houseArt() {
  const c = canvas(192, 224),
    ctx = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  };
  rect(8, 70, 176, 148, '#655c59');
  rect(12, 74, 168, 140, '#e8d4b1');
  rect(12, 132, 168, 5, '#b6a082');
  rect(12, 208, 168, 8, '#b6a082');
  for (const y of [92, 150])
    for (const x of [28, 132]) {
      rect(x, y, 32, 36, '#766d68');
      rect(x + 3, y + 3, 26, 30, '#94b5b3');
      rect(x + 14, y + 3, 3, 30, '#ede0c4');
      rect(x + 3, y + 16, 26, 3, '#ede0c4');
      rect(x - 2, y + 34, 36, 4, '#b6a082');
    }
  rect(78, 164, 36, 52, '#6d6058');
  rect(82, 168, 28, 48, '#ad8971');
  rect(104, 190, 3, 3, '#eddbac');
  ctx.fillStyle = '#655463';
  ctx.beginPath();
  ctx.moveTo(0, 82);
  ctx.lineTo(30, 8);
  ctx.lineTo(162, 8);
  ctx.lineTo(192, 82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#917a85';
  ctx.beginPath();
  ctx.moveTo(7, 78);
  ctx.lineTo(34, 13);
  ctx.lineTo(158, 13);
  ctx.lineTo(185, 78);
  ctx.closePath();
  ctx.fill();
  for (let y = 28; y < 78; y += 16)
    rect(30 - Math.floor((y - 8) / 3), y, 132 + Math.floor((y - 8) / 3) * 2, 2, '#846d79');
  rect(0, 80, 192, 6, '#655463');
  rect(74, 216, 44, 8, '#c8bcaa');
  return c;
}
function wallArt() {
  const c = canvas(32, 48),
    ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8f8175';
  ctx.fillRect(0, 0, 32, 48);
  ctx.fillStyle = '#e8decc';
  ctx.fillRect(0, 0, 32, 30);
  ctx.fillStyle = '#d3c4ae';
  ctx.fillRect(0, 30, 32, 14);
  ctx.fillStyle = '#a99b87';
  ctx.fillRect(0, 44, 32, 4);
  return c;
}
export function installLocation(scene: Phaser.Scene, world: GameLocation, seed: number) {
  scene.textures.addCanvas('landscape', landscape(world, seed));
  scene.add.image(0, 0, 'landscape').setOrigin(0).setDepth(0);
  if (world.id === 'house') {
    scene.textures.addCanvas('interior-wall', wallArt());
    for (let y = 0; y < world.height; y++)
      for (let x = 0; x < world.width; x++)
        if (world.solids[y * world.width + x])
          scene.add
            .image(x * 32, (y + 1) * 32, 'interior-wall')
            .setOrigin(0, 1)
            .setDepth(feetDepth((y + 1) * 32));
    scene.add.rectangle(world.door.x, world.door.y + 8, 64, 12, 0x9d8271).setDepth(3);
  }
  const sprites: { id: string; sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics }[] =
    [];
  for (const object of world.objects) {
    const { bounds } = object;
    if (object.kind === 'house') {
      scene.textures.addCanvas('home', houseArt());
      scene.add
        .ellipse(bounds.x + 98, bounds.y + bounds.height - 4, 208, 56, 0x4c6458, 0.15)
        .setDepth(1);
      const sprite = scene.add
        .image(bounds.x + bounds.width / 2, bounds.y + bounds.height, 'home')
        .setOrigin(0.5, 1)
        .setDepth(feetDepth(bounds.y + bounds.height));
      sprites.push({ id: object.id, sprite });
    } else {
      const sprite = scene.add.graphics().setDepth(feetDepth(bounds.y + bounds.height));
      sprite
        .fillStyle(0x8d7b69)
        .fillRect(bounds.x, bounds.y - 16, bounds.width, bounds.height + 16);
      for (let i = 0; i < 8; i++) {
        sprite
          .fillStyle(i % 2 ? 0xc9b497 : 0xd9c4a6)
          .fillRect(bounds.x + 5, bounds.y + i * 16 - 12, bounds.width - 10, 12);
        sprite.fillStyle(0xa08a70).fillRect(bounds.x + 5, bounds.y + i * 16, bounds.width - 10, 4);
      }
      sprite.fillStyle(0x655f59).fillRect(bounds.x, bounds.y - 16, bounds.width, 5);
      sprites.push({ id: object.id, sprite });
    }
  }
  return sprites;
}
