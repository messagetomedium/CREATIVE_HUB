import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use local Vite');
const output = fileURLToPath(new URL('../TECH_DOCS/ПЕРСОНАЖ/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  const p = await browser.newPage();
  await p.goto(base.href);
  const pack = await p.evaluate(async () => {
    const { assemble, attachPart } = await import('/src/avatar/modular/render.ts');
    const { pose, DIRECTIONS, BODY_SHAPES } = await import('/src/avatar/modular/rig.ts');
    const { PartEntrySchema } = await import('/src/avatar/modular/parts.ts');
    const { INDEX_LEVELS } = await import('/src/avatar/modular/materials.ts');
    const { loadAvatarSheet, assemblyStats } = await import('/src/avatar/art.ts');
    const { avatarCatalog } = await import('/src/avatar/catalog.ts');
    const { updateConstructor, AVATAR_PALETTES } = await import('/src/avatar/editor.ts');
    const images = {},
      rigs = [];
    const save = (name, c) => (images[name] = c.toDataURL('image/png').split(',')[1]);
    const make = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    let config = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'female',
      age: 'adult',
      hair: { male: 1, female: 1 },
    });
    for (const build of ['slim', 'average', 'sturdy']) {
      const value = updateConstructor(config, { build });
      save(`ТЕЛО_${build}_A24.png`, assemble(value, { bodyOnly: true }));
      rigs.push({
        build,
        poses: DIRECTIONS.flatMap((dir) =>
          Array.from({ length: 6 }, (_, f) => pose(build, dir, f)),
        ),
      });
    }
    const head = make(32, 128),
      hc = head.getContext('2d');
    const master = assemble(config, { bodyOnly: true });
    for (let r = 0; r < 4; r++) hc.drawImage(master, 8, r * 64 + 1, 32, 28, 0, r * 32, 32, 28);
    save('ГОЛОВА_V4.png', head);
    const example = make(6, 48),
      ctx = example.getContext('2d');
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = '#202020';
      ctx.fillRect(0, r * 12, 6, 12);
      ctx.fillStyle = '#b8b8b8';
      ctx.fillRect(1, r * 12 + 1, 4, 10);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(1, r * 12 + 1, 1, 10);
    }
    save('РУКАВ_МАСКА_V4.png', example);
    const leg = make(6, 48);
    leg.getContext('2d').drawImage(example, 0, 0);
    save('ШТАНИНА_МАСКА_V4.png', leg);
    const torso = make(18, 64),
      tc = torso.getContext('2d');
    for (let r = 0; r < 4; r++) {
      tc.fillStyle = '#202020';
      tc.fillRect(0, r * 16, 18, 16);
      tc.fillStyle = '#b8b8b8';
      tc.fillRect(1, r * 16 + 1, 16, 14);
      tc.fillStyle = '#f0f0f0';
      tc.fillRect(1, r * 16 + 1, 2, 14);
    }
    save('ВЕРХ_КОРПУС_V4.png', torso);
    save('КОРПУС_БАЗА_V4.png', torso);
    save('РУКА_БАЗА_V4.png', example);
    save('НОГА_БАЗА_V4.png', leg);
    for (const [name, w, h] of [
      ['ШЕЯ', 4, 6],
      ['ТАЗ', 15, 6],
      ['КИСТЬ', 4, 4],
      ['СТОПА', 6, 3],
    ]) {
      const c = make(w, h * 4),
        x = c.getContext('2d');
      for (let r = 0; r < 4; r++) {
        x.fillStyle = '#202020';
        x.fillRect(0, r * h, w, h);
        x.fillStyle = '#b8b8b8';
        x.fillRect(1, r * h + 1, Math.max(1, w - 2), Math.max(1, h - 2));
      }
      save(`${name}_БАЗА_V4.png`, c);
    }
    const skeleton = make(288, 256),
      sk = skeleton.getContext('2d');
    sk.globalAlpha = 0.35;
    sk.drawImage(master, 0, 0);
    sk.globalAlpha = 1;
    for (let r = 0; r < 4; r++)
      for (let f = 0; f < 6; f++) {
        const p = pose('average', DIRECTIONS[r], f);
        for (const [limbs, color] of [
          [p.arms, '#c95d68'],
          [p.legs, '#487589'],
        ])
          for (const l of limbs)
            for (const pt of [l.root, l.joint, l.end]) {
              sk.fillStyle = color;
              sk.fillRect(f * 48 + pt.x - 1, r * 64 + pt.y - 1, 2, 2);
            }
      }
    save('СУСТАВЫ_A24.png', skeleton);

    const palette = make(100, 20),
      pc = palette.getContext('2d');
    INDEX_LEVELS.forEach((v, i) => {
      pc.fillStyle = `rgb(${v},${v},${v})`;
      pc.fillRect(i * 20, 0, 20, 20);
    });
    save('ИНДЕКСЫ_МАСКИ.png', palette);
    const empty = make(32, 128);
    save('ПУСТАЯ_ДЕТАЛЬ_V4.png', empty);
    const part = PartEntrySchema.parse({
      id: 'example-sleeve',
      parent: 'armRight',
      pass: 'front',
      material: 'top',
      frameWidth: 6,
      frameHeight: 12,
      anchor: { x: 3, y: 0 },
      offset: { x: 0, y: 0 },
      fit: 'limb',
      mirrorWest: false,
      sync: 'limb',
      overrides: [{ direction: 'south', phase: 3, sourceFrame: 1, offset: { x: 0, y: 0 } }],
      selection: { field: 'top', slot: 1 },
      source: '/content/example-sleeve.png',
    });
    save(
      'ПРИМЕР_ИМПОРТА_A24.png',
      assemble(config, { parts: [{ descriptor: part, image: example }] }),
    );
    const guide = make(1040, 520),
      gc = guide.getContext('2d');
    gc.fillStyle = '#fbf8f4';
    gc.fillRect(0, 0, 1040, 520);
    gc.imageSmoothingEnabled = false;
    gc.fillStyle = '#65554f';
    gc.font = 'bold 24px sans-serif';
    gc.fillText('Универсальный взрослый риг / голова 20×20 / опора (24,56)', 24, 38);
    for (const [i, build] of ['slim', 'average', 'sturdy'].entries()) {
      const a = assemble(updateConstructor(config, { build }), { bodyOnly: true });
      gc.drawImage(a, 0, 128, 48, 64, 30 + i * 330, 70, 240, 320);
      gc.font = '18px sans-serif';
      gc.fillText(build, 30 + i * 330, 430);
    }
    save('ПРОПОРЦИИ_ТЕЛА.png', guide);
    for (let h = 1; h <= 4; h++) {
      const c = updateConstructor(config, { hair: { male: 1, female: h } });
      save(
        `ПРИЧЕСКА_${h}_СБОРКА_A24.png`,
        await loadAvatarSheet(avatarCatalog, c, new AbortController().signal),
      );
    }
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const c = updateConstructor(config, {
        build: ['slim', 'average', 'sturdy'][i % 3],
        hair: { male: 1, female: (i % 4) + 1 },
      });
      c.palette.hair = AVATAR_PALETTES.hair[i % 12];
      c.palette.outfit = AVATAR_PALETTES.outfit[Math.floor(i / 12)];
      await loadAvatarSheet(avatarCatalog, c, new AbortController().signal);
    }
    const elapsed = performance.now() - start;
    const before = assemblyStats(),
      repeat = performance.now();
    for (let i = 0; i < 100; i++)
      await loadAvatarSheet(avatarCatalog, config, new AbortController().signal);
    const hitsMs = performance.now() - repeat;
    return {
      images,
      rig: {
        version: 'modular-adult-v1',
        frame: { width: 48, height: 64, anchor: { x: 24, y: 56 } },
        head: { width: 20, height: 20, center: { x: 24, y: 17 } },
        directions: DIRECTIONS,
        phases: ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3'],
        fps: { idle: 2, walk: 9 },
        bodyShapes: BODY_SHAPES,
        rigs,
        palettes: AVATAR_PALETTES,
      },
      part,
      metrics: {
        distinctAssemblies: 50,
        totalMs: elapsed,
        averageMs: elapsed / 50,
        repeat100Ms: hitsMs,
        cache: assemblyStats(),
        before,
        scope:
          'Local headless Chromium CPU texture assembly. Not multiplayer, FPS or total browser RAM.',
      },
    };
  });
  for (const [name, data] of Object.entries(pack.images))
    await writeFile(path.join(output, name), Buffer.from(data, 'base64'));
  for (const [name, value] of [
    ['РИГ.json', pack.rig],
    ['ПРИМЕР_ДЕТАЛИ.json', pack.part],
    ['ЗАМЕРЫ.json', pack.metrics],
  ])
    await writeFile(
      path.join(output, name),
      await format(JSON.stringify(value), { parser: 'json' }),
    );
  const runtime = fileURLToPath(
    new URL('../content/avatars/modular/hair-indexed.png', import.meta.url),
  );
  await writeFile(path.join(output, 'ПРИЧЕСКИ_ИНДЕКСЫ.png'), await readFile(runtime));
  await writeFile(
    path.join(output, 'manifest.json'),
    await format(
      JSON.stringify({
        version: 'modular-adult-v1',
        outputs: Object.keys(pack.images),
        hairAtlas: {
          file: 'ПРИЧЕСКИ_ИНДЕКСЫ.png',
          width: 128,
          height: 128,
          columns: 4,
          rows: ['north', 'east', 'south', 'west'],
        },
        original: 'ПРИЧЕСКИ_ИСХОДНИК.png',
      }),
      { parser: 'json' },
    ),
  );
  console.log(
    'Modular art built:',
    Object.keys(pack.images).length,
    'technical PNGs, 1 small shared hair atlas, one rig; templates and runtime use the same compiler.',
  );
  console.log(JSON.stringify(pack.metrics));
} finally {
  await browser.close();
}
