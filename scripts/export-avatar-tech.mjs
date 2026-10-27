import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';
import { crc32 } from 'node:zlib';

// Exact technical raster exports, not AI illustrations: fixed frames and shared motion data.
// Run against the local Vite server. Nothing under TECH_DOCS is loaded by the game.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use local Vite.');
const output = fileURLToPath(new URL('../TECH_DOCS/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  const page = await browser.newPage();
  await page.goto(base.href);
  const pack = await page.evaluate(async () => {
    const { AVATAR_PALETTES, FABRIC_PALETTE, FACE_FEATURES } =
      await import('/src/avatar/editor.ts');
    const { createAvatarSheet } = await import('/src/avatar/art.ts');
    const { avatarCatalog } = await import('/src/avatar/catalog.ts');
    const W = 48,
      H = 64;
    const directions = ['north', 'east', 'south', 'west'];
    const phaseNames = ['idle-0', 'idle-1', 'walk-0', 'walk-1', 'walk-2', 'walk-3'];
    const bob = [0, -1, 0, -1, 0, -1],
      step = [0, 0, 0, 2, 0, -2];
    const images = {},
      expanded = {},
      contactRigs = [];
    const make = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const save = (name, c) => {
      images[name] = c.toDataURL('image/png').split(',')[1];
      return c;
    };
    const primary = { gender: 'male', age: 'adult', build: 'average' };
    function geometry(rig, dir, frame) {
      const side = dir === 'east' || dir === 'west',
        back = dir === 'north';
      const broad = { slim: -2, average: 0, sturdy: 2 }[rig.build];
      const tw = side ? 16 + broad : 22 + broad * 2;
      const sx = rig.age === 'child' ? 0.9 : 1,
        sy = rig.age === 'child' ? 0.86 : 1;
      const p = (x, y) => ({
        x: Math.round(24 + (dir === 'west' ? -x : x) * sx),
        y: Math.round(56 + y * sy),
      });
      const b = bob[frame],
        s = step[frame];
      return { side, back, tw, p, b, s, sx, sy };
    }
    function draw(ctx, rig, dir, frame, layer) {
      const { side, back, tw, p, b, s } = geometry(rig, dir, frame);
      const rect = (x, y, w, h, c) => {
        const a = p(x, y),
          z = p(x + w, y + h);
        ctx.fillStyle = c;
        ctx.fillRect(Math.min(a.x, z.x), a.y, Math.abs(z.x - a.x), z.y - a.y);
      };
      const poly = (points, c) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        points.forEach(([x, y], i) => {
          const a = p(x, y);
          i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y);
        });
        ctx.closePath();
        ctx.fill();
      };
      const ellipse = (x, y, rx, ry, c) => {
        const center = p(x, y),
          edge = p(x + rx, y + ry),
          ex = Math.abs(edge.x - center.x),
          ey = edge.y - center.y;
        ctx.fillStyle = c;
        for (let yy = -ey; yy <= ey; yy++)
          for (let xx = -ex; xx <= ex; xx++)
            if ((xx + 0.5) ** 2 / ex ** 2 + (yy + 0.5) ** 2 / ey ** 2 <= 1)
              ctx.fillRect(center.x + xx, center.y + yy, 1, 1);
      };
      const leg = (left, c) =>
        rect(
          side ? (left ? -5 : 0) : left ? -8 : 2,
          -14 + (left ? s : -s),
          side ? (left ? 8 : 7) : 6,
          12,
          c,
        );
      const shoe = (left, c) =>
        rect(side ? (left ? -5 : 1) : left ? -9 : 1, -4 + Math.min(left ? s : -s, 0), 9, 4, c);
      const headX = side ? 1 : 0;
      if (layer === 'body') {
        leg(true, '#cccccc');
        leg(false, '#e8e8e8');
        shoe(true, '#dddddd');
        shoe(false, '#ffffff');
        rect(-tw / 2, -31 + b, tw, 19, '#eeeeee');
        // Same shoulders/hips across gender, a one-pixel waist indication inside the silhouette.
        if (rig.gender === 'female') {
          rect(-tw / 2, -23 + b, 1, 6, '#cccccc');
          rect(tw / 2 - 1, -23 + b, 1, 6, '#cccccc');
        }
        rect(-tw / 2 - 3, -29 + b - s / 2, 5, 19, '#d7d7d7');
        rect(tw / 2 - 2, -29 + b + s / 2, 5, 19, '#f5f5f5');
        rect(-3, -34 + b, 6, 6, '#dddddd');
        ellipse(headX, -39 + b, side ? 9 : 10, 10, '#f4f4f4');
        if (side) rect(8, -38 + b, 3, 3, '#e8e8e8');
        else if (!back) {
          rect(-10, -39 + b, 2, 5, '#dddddd');
          rect(8, -39 + b, 2, 5, '#dddddd');
        }
      }
      if (layer === 'body-feature') rect(tw / 2 - 2, -15 + b + s / 2, 3, 2, '#ffffff');
      if (layer === 'bottom') {
        leg(true, '#d0d0d0');
        leg(false, '#f5f5f5');
        rect(-tw / 2, -15 + b, tw, 4, '#e5e5e5');
      }
      if (layer === 'shoes') {
        shoe(true, '#d8d8d8');
        shoe(false, '#ffffff');
      }
      if (layer === 'top') {
        rect(-tw / 2, -31 + b, tw, 17, '#f2f2f2');
        rect(-tw / 2 - 3, -29 + b - s / 2, 5, 13, '#d5d5d5');
        rect(tw / 2 - 2, -29 + b + s / 2, 5, 13, '#eeeeee');
        rect(-tw / 2, -16 + b, tw, 2, '#bababa');
        if (!back) rect(side ? 3 : -1, -29 + b, 2, 12, '#b8b8b8');
      }
      if (layer === 'eyes' && !back) {
        if (side) rect(5, -40, 2, 2, '#34423b');
        else {
          rect(-5, -39, 2, 2, '#34423b');
          rect(3, -39, 2, 2, '#34423b');
        }
      }
      if (layer === 'mouth' && !back) {
        if (side) rect(7, -33, 2, 1, '#82594b');
        else rect(-2, -33, 4, 1, '#82594b');
      }
      if (layer === 'freckles' && !back) {
        ctx.globalAlpha = 0.55;
        for (const [x, y] of side
          ? [
              [5, -36],
              [7, -35],
            ]
          : [
              [-7, -36],
              [-5, -35],
              [-3, -36],
              [3, -36],
              [5, -35],
              [7, -36],
            ])
          rect(x, y, 1, 1, '#ffffff');
        ctx.globalAlpha = 1;
      }
      if (layer === 'blush' && !back) {
        ctx.globalAlpha = 0.25;
        if (side) rect(3, -36, 4, 2, '#ffffff');
        else {
          rect(-8, -36, 5, 2, '#ffffff');
          rect(3, -36, 5, 2, '#ffffff');
        }
        ctx.globalAlpha = 1;
      }
      if (layer === 'hair-back') {
        if (back) ellipse(0, -40, 11, 11, '#ededed');
        else {
          rect(-11, -44, 4, 18, '#d5d5d5');
          if (!side) rect(7, -44, 4, 18, '#e8e8e8');
        }
      }
      if (layer === 'hair-front') {
        if (back) rect(-9, -48, 18, 5, '#f5f5f5');
        else {
          rect(-9, -48, 18, 6, '#f5f5f5');
          rect(-9, -42, 4, 4, '#dedede');
        }
      }
      if (layer === 'hat-back') rect(-12, -46, 24, 3, '#d0d0d0');
      if (layer === 'hat-front') {
        rect(-10, -52, 20, 7, '#f0f0f0');
        rect(-12, -46, 24, 3, '#d0d0d0');
      }
      if (layer === 'jewelry-back') {
        if (back) rect(-3, -33 + b, 6, 1, '#eeeeee');
      }
      if (layer === 'jewelry-front' && !back) {
        rect(side ? 3 : -3, -31 + b, side ? 2 : 6, 1, '#ffffff');
        rect(side ? 4 : -1, -30 + b, 2, 3, '#e4e4e4');
      }
      if (layer === 'special-back') {
        rect(-12, -49 + b, 24, 2, '#eeeeee');
      }
      if (layer === 'special-front') {
        rect(-13, -41 + b, 3, 7, '#dddddd');
        if (!side) rect(10, -41 + b, 3, 7, '#f5f5f5');
      }
    }
    function sheet(rig, layer, format = 'A24') {
      const c = make(format === 'V4' ? 48 : 288, 256),
        ctx = c.getContext('2d');
      directions.forEach((dir, row) => {
        for (let f = 0; f < (format === 'V4' ? 1 : 6); f++) {
          ctx.save();
          ctx.translate(f * 48, row * 64);
          draw(ctx, rig, dir, f, layer);
          ctx.restore();
        }
      });
      // Pixel borders remain binary; feature masks deliberately retain alpha for subtle overlays.
      if (!['freckles', 'blush'].includes(layer)) {
        const pixels = ctx.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < pixels.data.length; i += 4)
          pixels.data[i + 3] = pixels.data[i + 3] >= 128 ? 255 : 0;
        ctx.putImageData(pixels, 0, 0);
      }
      return c;
    }
    function expandViews(views, age) {
      const c = make(288, 256),
        ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      directions.forEach((_, r) => {
        for (let f = 0; f < 6; f++) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(f * 48, r * 64, 48, 64);
          ctx.clip();
          ctx.drawImage(
            views,
            0,
            r * 64,
            48,
            64,
            f * 48,
            r * 64 + Math.round(bob[f] * (age === 'child' ? 0.86 : 1)),
            48,
            64,
          );
          ctx.restore();
        }
      });
      return c;
    }
    const rigs = [];
    for (const gender of ['male', 'female'])
      for (const age of ['child', 'adult'])
        for (const build of ['slim', 'average', 'sturdy']) {
          const rig = { gender, age, build },
            id = `${gender}-${age}-${build}`;
          rigs.push({ id, ...rig });
          save(`RIG_${id}_A24.png`, sheet(rig, 'body'));
          contactRigs.push({
            id,
            frames: directions.flatMap((dir, row) =>
              phaseNames.map((phase, f) => {
                const { p, b, s, side, tw } = geometry(rig, dir, f);
                return {
                  direction: dir,
                  phase,
                  index: row * 6 + f,
                  anchor: { x: 24, y: 56 },
                  headCenter: p(side ? 1 : 0, -39 + b),
                  neck: p(0, -32 + b),
                  shoulderLeft: p(-tw / 2, -29 + b - s / 2),
                  shoulderRight: p(tw / 2, -29 + b + s / 2),
                  handLeft: p(-tw / 2 - 0.5, -13 + b - s / 2),
                  handRight: p(tw / 2 + 0.5, -13 + b + s / 2),
                  hipLeft: p(side ? -1 : -5, -14),
                  hipRight: p(side ? 3 : 5, -14),
                  footLeft: p(side ? -1 : -5, -2 + Math.min(s, 0)),
                  footRight: p(side ? 5 : 5, -2 + Math.min(-s, 0)),
                  headOffsetY: Math.round(b * (age === 'child' ? 0.86 : 1)),
                };
              }),
            ),
          });
        }
    const body = save('REF_BODY_MASTER_A24.png', sheet(primary, 'body'));
    const fullLayers = [
      'body-feature',
      'bottom',
      'shoes',
      'top',
      'jewelry-back',
      'jewelry-front',
      'special-back',
      'special-front',
    ];
    for (const layer of fullLayers)
      expanded[layer] = save(
        `REF_${layer.toUpperCase().replaceAll('-', '_')}_A24.png`,
        sheet(primary, layer),
      );
    const viewLayers = [
      'eyes',
      'mouth',
      'freckles',
      'blush',
      'hair-back',
      'hair-front',
      'hat-back',
      'hat-front',
    ];
    for (const layer of viewLayers) {
      const v = save(
        `REF_${layer.toUpperCase().replaceAll('-', '_')}_V4.png`,
        sheet(primary, layer, 'V4'),
      );
      expanded[layer] = save(
        `REF_${layer.toUpperCase().replaceAll('-', '_')}_A24.png`,
        expandViews(v, 'adult'),
      );
    }
    const keep = make(48, 256),
      keepCtx = keep.getContext('2d');
    keepCtx.fillStyle = '#fff';
    keepCtx.fillRect(0, 0, 48, 256);
    directions.forEach((dir, row) => {
      const { p } = geometry(primary, dir, 0);
      const a = p(-12, -56),
        z = p(12, -43);
      keepCtx.clearRect(Math.min(a.x, z.x), row * 64 + a.y, Math.abs(z.x - a.x), z.y - a.y);
    });
    save('REF_HAIR_KEEP_V4.png', keep);
    function tint(c, color) {
      const t = make(c.width, c.height),
        x = t.getContext('2d');
      x.drawImage(c, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(c, 0, 0);
      return t;
    }
    const skin = AVATAR_PALETTES.skin[4],
      hair = AVATAR_PALETTES.hair[2];
    const mix = (a, b, f) =>
      '#' +
      [1, 3, 5]
        .map((i) =>
          Math.round(
            parseInt(a.slice(i, i + 2), 16) * (1 - f) + parseInt(b.slice(i, i + 2), 16) * f,
          )
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    const layerOrder = [
      ['special-back', '#7495a9'],
      ['hat-back', '#a294bd'],
      ['hair-back', hair],
      ['jewelry-back', '#ccac62'],
      ['body', skin],
      ['body-feature', mix(skin, '#503628', 0.65)],
      ['bottom', '#46584c'],
      ['shoes', '#f1e9d8'],
      ['top', '#cf6546'],
      ['mouth', null],
      ['eyes', null],
      ['freckles', mix(skin, '#503628', 0.65)],
      ['blush', mix(skin, '#b5625a', 0.45)],
      ['jewelry-front', '#ccac62'],
      ['hair-front', hair],
      ['hat-front', '#a294bd'],
      ['special-front', '#7495a9'],
    ];
    const oraLayers = [];
    const composite = make(288, 256),
      cx = composite.getContext('2d');
    for (const [layer, color] of layerOrder) {
      let image = layer === 'body' ? body : expanded[layer];
      if (layer.startsWith('hair-')) {
        const masked = make(288, 256),
          m = masked.getContext('2d');
        m.drawImage(image, 0, 0);
        m.globalCompositeOperation = 'destination-in';
        m.drawImage(expandViews(keep, 'adult'), 0, 0);
        image = masked;
      }
      const colored = color ? tint(image, color) : image;
      cx.drawImage(colored, 0, 0);
      oraLayers.push({ name: layer, data: colored.toDataURL('image/png').split(',')[1] });
    }
    save('REF_COMPOSITE_A24.png', composite);
    save(
      'REF_CURRENT_BLOCKOUT_A24.png',
      createAvatarSheet(avatarCatalog, avatarCatalog.defaultAvatar),
    );
    save('REF_EMPTY_A24.png', make(288, 256));
    save('REF_EMPTY_V4.png', make(48, 256));
    const grid = make(288, 256),
      gc = grid.getContext('2d');
    gc.fillStyle = '#9380b6';
    for (let x = 0; x < 288; x += 48) gc.fillRect(x, 0, 1, 256);
    for (let y = 0; y < 256; y += 64) gc.fillRect(0, y, 288, 1);
    directions.forEach((_, r) => {
      for (let f = 0; f < 6; f++) {
        gc.fillStyle = '#cc6572';
        gc.fillRect(f * 48 + 21, r * 64 + 56, 7, 1);
        gc.fillRect(f * 48 + 24, r * 64 + 53, 1, 7);
      }
    });
    save('REF_GRID_A24.png', grid);
    function panel(w, h, title) {
      const c = make(w, h),
        ctx = c.getContext('2d');
      ctx.fillStyle = '#fbf8f4';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#65554f';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(title, 32, 42);
      ctx.imageSmoothingEnabled = false;
      return [c, ctx];
    }
    const [map, mc] = panel(1330, 1160, 'Creative Factory / 48×64 px / A24 / 288×256 px');
    mc.font = '16px sans-serif';
    mc.fillText(
      'Строки: север, восток, юг, запад. Колонки: 2 ожидания + 4 шага. Опора: (24, 56).',
      32,
      76,
    );
    for (let row = 0; row < 4; row++)
      for (let f = 0; f < 6; f++) {
        const x = 154 + f * 192,
          y = 128 + row * 256;
        mc.fillStyle = '#eee6db';
        mc.fillRect(x, y, 192, 256);
        mc.drawImage(body, f * 48, row * 64, 48, 64, x, y, 192, 256);
        mc.strokeStyle = '#d6c5b9';
        mc.strokeRect(x, y, 192, 256);
        mc.fillStyle = '#cf5d64';
        mc.fillRect(x + 24 * 4 - 4, y + 56 * 4, 9, 1);
        mc.fillRect(x + 24 * 4, y + 56 * 4 - 4, 1, 9);
        if (row === 0) {
          mc.fillStyle = '#65554f';
          mc.font = '16px sans-serif';
          mc.fillText(phaseNames[f], x + 26, 115);
        }
        if (f === 0) {
          mc.fillStyle = '#65554f';
          mc.fillText(['N / спина', 'E / вправо', 'S / лицо', 'W / влево'][row], 24, y + 128);
        }
      }
    save('GUIDE_FRAME_MAP.png', map);
    const [rg, rc] = panel(1040, 910, '12 совместимых тел / неизменная точка ног');
    rigs.forEach((rig, i) => {
      const x = 24 + (i % 6) * 168,
        y = 98 + Math.floor(i / 6) * 390;
      rc.fillStyle = '#eee6db';
      rc.fillRect(x, y, 156, 270);
      rc.drawImage(sheet(rig, 'body'), 0, 128, 48, 64, x + 6, y + 22, 144, 192);
      rc.fillStyle = '#65554f';
      rc.font = '12px sans-serif';
      rc.fillText(`${rig.gender} / ${rig.age}`, x + 10, y + 236);
      rc.fillText(rig.build, x + 10, y + 255);
    });
    save('GUIDE_RIGS.png', rg);
    const [stack, sc] = panel(1360, 820, 'Послойная сборка / один и тот же пиксельный origin');
    const showcase = [
      ['body', body, skin],
      ['bottom', expanded.bottom, '#46584c'],
      ['top', expanded.top, '#cf6546'],
      ['freckles', expanded.freckles, mix(skin, '#503628', 0.65)],
      ['hair', expanded['hair-front'], hair],
      ['all', composite, null],
    ];
    showcase.forEach(([name, c, col], i) => {
      const x = 24 + i * 220;
      sc.fillStyle = '#eee6db';
      sc.fillRect(x, 100, 208, 370);
      sc.drawImage(col ? tint(c, col) : c, 0, 128, 48, 64, x + 8, 120, 192, 256);
      sc.fillStyle = '#65554f';
      sc.font = '18px sans-serif';
      sc.fillText(name, x + 12, 440);
    });
    sc.font = '20px sans-serif';
    sc.fillText(
      'Каждый слой: прозрачный фон; никаких отдельных голов, рамок или сдвигов при экспорте.',
      32,
      530,
    );
    sc.fillText('Белые/серые маски окрашиваются один раз. Глаза и рот — готовый RGBA.', 32, 570);
    sc.fillText(
      'V4: четыре вида; bob добавляется по таблице. A24: все 24 кадра уже на месте.',
      32,
      610,
    );
    sc.fillText('GUIDE-файлы — схемы; REF/RIG PNG — прозрачные технические образцы.', 32, 650);
    save('GUIDE_LAYER_STACK.png', stack);
    const [pal, pc] = panel(
      1100,
      570,
      'Палитры редактора / цвета не требуют отдельных спрайт-листов',
    );
    [
      ['Кожа / 10', AVATAR_PALETTES.skin],
      ['Волосы / 12', AVATAR_PALETTES.hair],
      ['Ткань, обувь, детали / 12', FABRIC_PALETTE],
    ].forEach(([label, colors], row) => {
      const y = 100 + row * 145;
      pc.fillStyle = '#65554f';
      pc.font = '18px sans-serif';
      pc.fillText(label, 32, y);
      colors.forEach((color, i) => {
        const x = 32 + i * 86;
        pc.fillStyle = color;
        pc.fillRect(x, y + 18, 58, 50);
        pc.fillStyle = '#65554f';
        pc.font = '11px monospace';
        pc.fillText(`${i + 1}: ${color}`, x, y + 88);
      });
    });
    save('GUIDE_PALETTES.png', pal);
    const spec = {
      version: 'cf-avatar-art-1',
      frame: { width: W, height: H, anchor: { x: 24, y: 56 }, padding: 0, spacing: 0 },
      formats: {
        A24: { width: 288, height: 256, columns: 6, rows: 4, frames: 24 },
        V4: { width: 48, height: 256, columns: 1, rows: 4, frames: 4 },
        ICON: { width: 48, height: 48, frames: 1 },
      },
      directions,
      phases: phaseNames.map((name, index) => ({
        name,
        column: index,
        step: step[index],
        adultHeadOffsetY: bob[index],
        childHeadOffsetY: Math.round(bob[index] * 0.86),
      })),
      animationFps: { idle: 2, walk: 9 },
      rigs,
      headRigs: ['child', 'adult'],
      palettes: { skin: AVATAR_PALETTES.skin, hair: AVATAR_PALETTES.hair, fabric: FABRIC_PALETTE },
      faceFeatures: FACE_FEATURES.map((label, i) => ({ slot: i + 1, label })),
      layerOrder: [
        'special.back',
        'hat.back',
        'hair.back',
        'jewelry.back',
        'body',
        'bodyFeatures:ascending',
        'bottom',
        'shoes',
        'top',
        'mouth',
        'eyes',
        'faceFeatures:ascending',
        'jewelry.front',
        'hair.front',
        'hat.front',
        'special.front',
      ],
      sampleLayerOrder: layerOrder.map(([name]) => name),
      note: 'REF and RIG are positioning masters, not final production art. V4 expansion/new passes require the next art importer; current game renderer is intentionally unchanged.',
    };
    return {
      images,
      oraLayers,
      spec,
      contacts: {
        version: spec.version,
        coordinateSystem: 'frame-local pixels; +x right, +y down',
        rigs: contactRigs,
      },
    };
  });
  for (const [name, bytes] of Object.entries(pack.images))
    await writeFile(path.join(output, name), Buffer.from(bytes, 'base64'));
  for (const [name, value] of [
    ['CF_ART_SPEC.json', pack.spec],
    ['CF_BODY_CONTACTS.json', pack.contacts],
  ])
    await writeFile(
      path.join(output, name),
      await format(JSON.stringify(value), { parser: 'json' }),
    );
  const stackXml = `<?xml version="1.0" encoding="UTF-8"?>
<image version="0.0.3" w="288" h="256" name="Creative Factory positioning master"><stack>${[
    ...pack.oraLayers,
  ]
    .reverse()
    .map(
      (layer) =>
        `<layer name="${layer.name}" src="data/${layer.name}.png" x="0" y="0" opacity="1.0" visibility="visible" composite-op="svg:src-over"/>`,
    )
    .join('')}</stack></image>`;
  const entries = [
    ['mimetype', Buffer.from('image/openraster')],
    ['stack.xml', Buffer.from(stackXml)],
    ['mergedimage.png', Buffer.from(pack.images['REF_COMPOSITE_A24.png'], 'base64')],
    ...pack.oraLayers.map((layer) => [`data/${layer.name}.png`, Buffer.from(layer.data, 'base64')]),
  ];
  const chunks = [],
    directory = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const filename = Buffer.from(name),
      checksum = crc32(data),
      local = Buffer.alloc(30),
      central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(((2026 - 1980) << 9) | (10 << 5) | 27, 12);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(((2026 - 1980) << 9) | (10 << 5) | 27, 14);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    chunks.push(local, filename, data);
    directory.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const centralDirectory = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(
    path.join(output, 'CF_REFERENCE_STACK.ora'),
    Buffer.concat([...chunks, centralDirectory, end]),
  );
  const rows = [
    ['filename', 'category', 'slot', 'rig', 'format', 'pass', 'material', 'design_status'],
  ];
  const add = (filename, category, slot, rig, layout, pass, material, status = 'design-needed') =>
    rows.push([filename, category, slot, rig, layout, pass, material, status]);
  const n = (v) => String(v).padStart(2, '0');
  for (const rig of pack.spec.rigs)
    add(`body_${rig.id}.png`, 'body', '-', rig.id, 'A24', 'body', 'skin');
  for (const [category, count] of [
    ['body-feature', 12],
    ['top', 6],
    ['bottom', 6],
    ['shoes', 6],
    ['jewelry', 6],
    ['special', 6],
  ])
    for (let i = 1; i <= count; i++)
      for (const rig of pack.spec.rigs)
        for (const pass of ['jewelry', 'special'].includes(category) ? ['back', 'front'] : ['main'])
          add(
            `${category}_${n(i)}_${rig.id}_${pass}.png`,
            category,
            i,
            rig.id,
            'A24',
            pass,
            category === 'body-feature' ? 'skin-relative' : 'fabric',
            category === 'body-feature' || category === 'special'
              ? 'concept-not-assigned'
              : 'design-needed',
          );
  for (const [category, count] of [
    ['mouth', 6],
    ['eyes', 6],
    ['face-feature', 6],
    ['hair-male', 6],
    ['hair-female', 6],
    ['hat', 6],
  ])
    for (let i = 1; i <= count; i++)
      for (const head of pack.spec.headRigs)
        for (const pass of category.startsWith('hair') || category === 'hat'
          ? ['back', 'front']
          : ['main'])
          add(
            `${category}_${n(i)}_${head}_${pass}.png`,
            category,
            i,
            head,
            'V4',
            pass,
            ['mouth', 'eyes'].includes(category)
              ? 'fixed-rgba'
              : category === 'face-feature'
                ? 'skin-relative'
                : category.startsWith('hair')
                  ? 'hair'
                  : 'fabric',
          );
  for (let i = 1; i <= 6; i++)
    for (const head of pack.spec.headRigs)
      add(
        `hat_${n(i)}_${head}_hair-keep.png`,
        'hat-hair-mask',
        i,
        head,
        'V4',
        'mask',
        'alpha-mask',
      );
  for (const [category, count] of [
    ['gender-age', 4],
    ['build', 3],
    ['body-feature', 12],
    ['mouth', 6],
    ['eyes', 6],
    ['face-feature', 6],
    ['hair-male', 6],
    ['hair-female', 6],
    ['top', 6],
    ['bottom', 6],
    ['shoes', 6],
    ['hat', 6],
    ['jewelry', 6],
    ['special', 6],
  ])
    for (let i = 1; i <= count; i++)
      add(`icon_${category}_${n(i)}.png`, 'icon', i, category, 'ICON', 'ui', 'fixed-rgba');
  await writeFile(
    path.join(output, 'CF_PRODUCTION_LIST.csv'),
    '\uFEFF' + rows.map((row) => row.join(',')).join('\n') + '\n',
  );
  console.log(
    `Exported ${Object.keys(pack.images).length} PNG masters, 12 rigs, ${rows.length - 1} inventory entries to TECH_DOCS (flat).`,
  );
} finally {
  await browser.close();
}
