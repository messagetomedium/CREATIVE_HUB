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
    const { assemble, renderBaseModule } = await import('/src/avatar/modular/render.ts');
    const { pose, DIRECTIONS, BODY_SHAPES } = await import('/src/avatar/modular/rig.ts');
    const { SOURCE_TEMPLATES, templateDescriptor } =
      await import('/src/avatar/modular/templates.ts');
    const { INDEX_LEVELS } = await import('/src/avatar/modular/materials.ts');
    const { loadAvatarSheet, assemblyStats } = await import('/src/avatar/art.ts');
    const { avatarCatalog } = await import('/src/avatar/catalog.ts');
    const { updateConstructor, AVATAR_PALETTES } = await import('/src/avatar/editor.ts');
    const images = {},
      rigs = [],
      templates = [],
      parts = [],
      surfaces = new Map();
    const save = (name, c) => (images[name] = c.toDataURL('image/png').split(',')[1]);
    const make = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const config = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'female',
      age: 'adult',
      hair: { male: 1, female: 1 },
    });
    const palette = INDEX_LEVELS.map((v) => `rgb(${v},${v},${v})`);
    for (const t of SOURCE_TEMPLATES) {
      const source = make(t.width, t.height * 3),
        ctx = source.getContext('2d');
      for (let row = 0; row < 3; row++) {
        const p = pose('average', DIRECTIONS[row], 0);
        const parent =
          t.parent === 'head'
            ? p.head
            : t.parent === 'torso'
              ? p.torso
              : t.parent === 'pelvis'
                ? p.pelvis
                : t.parent.startsWith('arm')
                  ? p.arms[0].root
                  : t.parent.startsWith('leg')
                    ? p.legs[0].root
                    : t.parent.startsWith('foot')
                      ? p.legs[0].end
                      : p.arms[1].end;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, row * t.height, t.width, t.height);
        ctx.clip();
        ctx.translate(t.anchor.x - parent.x, row * t.height + t.anchor.y - parent.y);
        const module = ['face', 'hair', 'hat', 'jewelry'].includes(t.id)
          ? 'head'
          : t.id === 'top' || t.id === 'bottom'
            ? 'torso'
            : t.id === 'item'
              ? 'armRight'
              : t.id === 'sleeve'
                ? 'armLeft'
                : t.id === 'pant' || t.id === 'shoe'
                  ? 'legLeft'
                  : t.parent;
        renderBaseModule(ctx, p, module, palette);
        ctx.restore();
      }
      const underlay = `ПОДЛОЖКА_${t.label}_V3.png`,
        blank = `ПУСТОЙ_${t.label}_V3.png`,
        guideName = `СХЕМА_${t.label}.png`;
      save(underlay, source);
      save(blank, make(t.width, t.height * 3));
      surfaces.set(t.id, source);
      const guide = make(840, 430),
        gc = guide.getContext('2d');
      gc.imageSmoothingEnabled = false;
      gc.fillStyle = '#faf6ef';
      gc.fillRect(0, 0, guide.width, guide.height);
      gc.fillStyle = '#443b42';
      gc.font = 'bold 19px sans-serif';
      gc.fillText(
        `${t.label}: клетка ${t.width}×${t.height}, PNG ${t.width}×${t.height * 3}, опора (${t.anchor.x},${t.anchor.y})`,
        18,
        30,
      );
      for (let row = 0; row < 3; row++) {
        const scale = Math.min(7, Math.floor(220 / Math.max(t.width, t.height))),
          x = 28 + row * 275,
          y = 85;
        gc.font = '18px sans-serif';
        gc.fillStyle = '#443b42';
        gc.fillText(['N · СПИНА', 'E · ВПРАВО', 'S · ЛИЦО'][row], x, 64);
        for (let cy = 0; cy < t.height; cy++)
          for (let cx = 0; cx < t.width; cx++) {
            gc.fillStyle = (cx + cy) % 2 ? '#e5ddd2' : '#f5eee4';
            gc.fillRect(x + cx * scale, y + cy * scale, scale, scale);
          }
        gc.globalAlpha = 0.65;
        gc.drawImage(
          source,
          0,
          row * t.height,
          t.width,
          t.height,
          x,
          y,
          t.width * scale,
          t.height * scale,
        );
        gc.globalAlpha = 1;
        gc.strokeStyle = '#c24e65';
        gc.lineWidth = 1;
        gc.beginPath();
        gc.moveTo(x + t.anchor.x * scale, y);
        gc.lineTo(x + t.anchor.x * scale, y + t.height * scale);
        gc.moveTo(x, y + t.anchor.y * scale);
        gc.lineTo(x + t.width * scale, y + t.anchor.y * scale);
        gc.stroke();
        gc.fillStyle = '#c24e65';
        gc.fillRect(x + t.anchor.x * scale - 2, y + t.anchor.y * scale - 2, 5, 5);
      }
      gc.fillStyle = '#443b42';
      gc.font = '16px sans-serif';
      gc.fillText(
        'Рисовать на ПУСТОМ PNG. Подложку и красные направляющие не включать в готовый слой.',
        18,
        350,
      );
      gc.fillText(
        'Один рисунок на ракурс. W зеркалится из E. Не рисовать фазы, цвета и комплекции.',
        18,
        382,
      );
      save(guideName, guide);
      const descriptor = templateDescriptor(t);
      templates.push({
        ...t,
        rows: ['north', 'east', 'south'],
        underlay,
        blank,
        guide: guideName,
        descriptor,
      });
      if (t.field === 'base') {
        parts.push(descriptor);
        if (t.id === 'arm' || t.id === 'leg')
          parts.push({
            ...descriptor,
            id: descriptor.id + '-right',
            parent: t.id === 'arm' ? 'armRight' : 'legRight',
          });
      }
    }
    // This round-trip proof uses the exact source-sized kit supplied to artists.
    const imported = parts.map((d) => ({
      descriptor: d,
      image: surfaces.get(
        d.parent === 'head'
          ? 'head'
          : d.parent === 'torso'
            ? 'torso'
            : d.parent.startsWith('arm')
              ? 'arm'
              : 'leg',
      ),
    }));
    save('ПРОВЕРКА_ИМПОРТА_ТЕЛА_A24.png', assemble(config, { bodyOnly: true, parts: imported }));
    for (const build of ['slim', 'average', 'sturdy']) {
      save(
        `ТЕЛО_${build}_A24.png`,
        assemble(updateConstructor(config, { build }), { bodyOnly: true }),
      );
      rigs.push({
        build,
        poses: DIRECTIONS.flatMap((dir) =>
          Array.from({ length: 6 }, (_, f) => pose(build, dir, f)),
        ),
      });
    }
    const overview = make(1100, 740),
      oc = overview.getContext('2d');
    oc.fillStyle = '#faf6ef';
    oc.fillRect(0, 0, 1100, 740);
    oc.imageSmoothingEnabled = false;
    oc.font = 'bold 23px sans-serif';
    oc.fillStyle = '#443b42';
    oc.fillText('4 исходника тела × 3 ракурса = 12 рисунков', 24, 36);
    for (const [i, t] of SOURCE_TEMPLATES.slice(0, 4).entries()) {
      const img = surfaces.get(t.id),
        x = 24 + i * 270;
      oc.font = '17px sans-serif';
      oc.fillText(t.label, x, 76);
      oc.fillText(`${t.width}×${t.height * 3} PNG`, x, 103);
      oc.drawImage(img, 0, 0, t.width, t.height * 3, x, 120, t.width * 5, t.height * 15);
    }
    oc.font = '18px sans-serif';
    oc.fillText('Рука включает кисть. Нога включает стопу. Шея и таз входят в корпус.', 24, 650);
    oc.fillText('Повторные конечности, W, телосложения и 24 кадра собирает код.', 24, 690);
    save('НАБОР_ТЕЛА_ОБЗОР.png', overview);
    const guide = make(1040, 520),
      gc = guide.getContext('2d');
    gc.imageSmoothingEnabled = false;
    gc.fillStyle = '#fbf8f4';
    gc.fillRect(0, 0, 1040, 520);
    gc.fillStyle = '#65554f';
    gc.font = 'bold 24px sans-serif';
    gc.fillText('Голова 20×20 · опора (24,56) · ноги ближе к центру', 24, 38);
    for (const [i, build] of ['slim', 'average', 'sturdy'].entries()) {
      const a = assemble(updateConstructor(config, { build }), { bodyOnly: true });
      gc.drawImage(a, 0, 128, 48, 64, 30 + i * 330, 70, 240, 320);
      gc.font = '18px sans-serif';
      gc.fillText(build, 30 + i * 330, 430);
    }
    save('ПРОПОРЦИИ_ТЕЛА.png', guide);
    for (let h = 1; h <= 4; h++)
      save(
        `ПРИЧЕСКА_${h}_СБОРКА_A24.png`,
        await loadAvatarSheet(
          avatarCatalog,
          updateConstructor(config, { hair: { male: 1, female: h } }),
          new AbortController().signal,
        ),
      );
    const indices = make(100, 20),
      ic = indices.getContext('2d');
    palette.forEach((v, i) => {
      ic.fillStyle = v;
      ic.fillRect(i * 20, 0, 20, 20);
    });
    save('ИНДЕКСЫ_МАСКИ.png', indices);
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
    const elapsed = performance.now() - start,
      repeat = performance.now();
    for (let i = 0; i < 100; i++)
      await loadAvatarSheet(avatarCatalog, config, new AbortController().signal);
    return {
      images,
      templates,
      parts,
      rig: {
        version: 'modular-adult-v2',
        frame: { width: 48, height: 64, anchor: { x: 24, y: 56 } },
        head: { width: 20, height: 20, center: { x: 24, y: 17 } },
        directions: DIRECTIONS,
        phases: ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3'],
        fps: { idle: 2, walk: 9 },
        bodyShapes: BODY_SHAPES,
        rigs,
        palettes: AVATAR_PALETTES,
      },
      metrics: {
        distinctAssemblies: 50,
        totalMs: elapsed,
        averageMs: elapsed / 50,
        repeat100Ms: performance.now() - repeat,
        cache: assemblyStats(),
        scope: 'Local headless Chromium CPU texture assembly. Not FPS or total browser RAM.',
      },
    };
  });
  for (const [name, data] of Object.entries(pack.images))
    await writeFile(path.join(output, name), Buffer.from(data, 'base64'));
  for (const [name, value] of [
    ['РИГ.json', pack.rig],
    ['ШАБЛОНЫ.json', pack.templates],
    ['КОМПЛЕКТ_ТЕЛА.json', pack.parts],
    ['ЗАМЕРЫ.json', pack.metrics],
  ])
    await writeFile(
      path.join(output, name),
      await format(JSON.stringify(value), { parser: 'json' }),
    );
  await writeFile(
    path.join(output, 'ПРИЧЕСКИ_ИНДЕКСЫ.png'),
    await readFile(
      fileURLToPath(new URL('../content/avatars/modular/hair-indexed.png', import.meta.url)),
    ),
  );
  await writeFile(
    path.join(output, 'manifest.json'),
    await format(
      JSON.stringify({
        version: 'modular-adult-v2',
        outputs: Object.keys(pack.images),
        artistSources: 'ШАБЛОНЫ.json',
        bodyKit: 'КОМПЛЕКТ_ТЕЛА.json',
        original: 'ПРИЧЕСКИ_ИСХОДНИК.png',
        note: 'Artist sources are static V3. A24 outputs are automatic engineering previews.',
      }),
      { parser: 'json' },
    ),
  );
  console.log(
    'Built',
    Object.keys(pack.images).length,
    'PNGs,',
    pack.templates.length,
    'static V3 templates and a matching importable four-source body kit.',
  );
  console.log(JSON.stringify(pack.metrics));
} finally {
  await browser.close();
}
