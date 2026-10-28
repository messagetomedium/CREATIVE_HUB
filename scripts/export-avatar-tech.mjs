import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use local Vite');
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  const page = await browser.newPage();
  await page.goto(base.href);
  await rm('TECH_DOCS/CHARACTER/TEMPLATES', { recursive: true, force: true });
  const pack = await page.evaluate(async () => {
    const { SOURCE_TEMPLATES, VIEW_MODES, templateModes, templateFolder } =
      await import('/src/avatar/modular/templates.ts');
    const { pose, FRAME, BODY_SHAPES, RIG_VERSION, DIRECTIONS, ANIMATION_FPS, FACE_ANCHORS } =
      await import('/src/avatar/modular/rig.ts');
    const { hairLayer, LOWER_LAYOUT, lowerLegSourceX } =
      await import('/src/avatar/modular/layout.ts');
    const { renderBaseModule, renderNeck, assemble, parentPoint } =
      await import('/src/avatar/modular/render.ts');
    const { avatarCatalog } = await import('/src/avatar/catalog.ts');
    const { updateConstructor } = await import('/src/avatar/editor.ts');
    const { loadAvatarSheet } = await import('/src/avatar/art.ts');
    const files = {},
      records = [];
    const make = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const save = (name, c) => (files[name] = c.toDataURL('image/png').split(',')[1]);
    const pal = ['#202020', '#505050', '#808080', '#b8b8b8', '#f0f0f0'];
    for (const t of SOURCE_TEMPLATES)
      for (const mode of templateModes(t)) {
        const views = VIEW_MODES[mode];
        const c = make(t.width, t.height * views.length),
          ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (const [row, dir] of views.entries()) {
          const p = pose('average', dir, 0),
            parent = parentPoint(p, t.parent);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, row * t.height, t.width, t.height);
          ctx.clip();
          ctx.translate(t.anchor.x - parent.x, row * t.height + t.anchor.y - parent.y);
          ctx.globalAlpha = 0.08;
          for (let py = 0; py < t.height; py++)
            for (let px = 0; px < t.width; px++)
              if ((px + py) % 2 === 0) {
                ctx.fillStyle = '#7495a9';
                ctx.fillRect(parent.x - t.anchor.x + px, parent.y - t.anchor.y + py, 1, 1);
              }
          ctx.globalAlpha = 0.14;
          const headOnly = ['eyes', 'mouth', 'details'].includes(t.id);
          for (const name of [
            'legLeft',
            'legRight',
            'footLeft',
            'footRight',
            'torso',
            'armLeft',
            'armRight',
            'handLeft',
            'handRight',
            'head',
          ])
            if (
              (!headOnly || name === 'head') &&
              (t.id !== 'shoe' || ['legLeft', 'footLeft'].includes(name))
            )
              renderBaseModule(ctx, p, name, pal);
          if (headOnly) renderNeck(ctx, p, pal);
          ctx.globalAlpha = 0.58;
          if (/^(pants|shorts|skirt)-/.test(t.id)) {
            for (const module of ['torso', ...(p.side ? ['legRight'] : ['legLeft', 'legRight'])])
              renderBaseModule(ctx, p, module, pal);
          } else renderBaseModule(ctx, p, t.parent, pal);
          if (t.parent === 'head') {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#7495a9';
            for (const pt of FACE_ANCHORS[dir].eyes)
              ctx.fillRect(p.head.x + pt.x, p.head.y + pt.y, 4, 8);
            for (const pt of FACE_ANCHORS[dir].mouth)
              ctx.fillRect(p.head.x + pt.x, p.head.y + pt.y, 3, 1);
          }
          ctx.restore();
          if (t.id.startsWith('hair-')) {
            for (let py = 1; py < t.height - 1; py++)
              for (let px = 1; px < t.width - 1; px++) {
                ctx.fillStyle = hairLayer(px, py, dir) === 'front' ? '#d34b8420' : '#258b9130';
                ctx.fillRect(px, row * t.height + py, 1, 1);
              }
          }
          if (/^(pants|shorts|skirt)-/.test(t.id)) {
            const high = t.id.endsWith('-high'),
              max = t.id.startsWith('shorts') ? LOWER_LAYOUT.shortHem : LOWER_LAYOUT.maxHem;
            ctx.fillStyle = '#d34b8430';
            ctx.fillRect(
              1,
              row * t.height + 1,
              t.width - 2,
              (high ? LOWER_LAYOUT.bandTop : LOWER_LAYOUT.bandBottom) - 1,
            );
            for (const boundary of [
              high ? LOWER_LAYOUT.bandTop : LOWER_LAYOUT.bandBottom,
              LOWER_LAYOUT.bandBottom,
              LOWER_LAYOUT.legSplit,
              max,
            ]) {
              ctx.fillStyle = '#258b91';
              ctx.fillRect(1, row * t.height + boundary, t.width - 2, 1);
            }
            if (!t.id.startsWith('skirt'))
              for (const index of p.side ? [1] : [0, 1]) {
                const centre = lowerLegSourceX(dir, index);
                ctx.strokeStyle = '#258b91';
                ctx.strokeRect(
                  centre - 15.5,
                  row * t.height + LOWER_LAYOUT.legSplit + 0.5,
                  31,
                  max - LOWER_LAYOUT.legSplit - 1,
                );
              }
          }
          // All markers are on the hidden TEMPLATE layer, never in EMPTY/the delivered artwork.
          for (let x = 0; x < t.width; x += 4) {
            ctx.fillStyle = '#7495a91c';
            ctx.fillRect(x, row * t.height, 1, t.height);
          }
          for (let y = 0; y < t.height; y += 4) {
            ctx.fillStyle = '#7495a91c';
            ctx.fillRect(0, row * t.height + y, t.width, 1);
          }
          ctx.strokeStyle = '#258b91';
          ctx.lineWidth = 1;
          ctx.strokeRect(1.5, row * t.height + 1.5, t.width - 3, t.height - 3);
          ctx.fillStyle = '#d34b84';
          ctx.fillRect(t.anchor.x - 2, row * t.height + t.anchor.y, 5, 1);
          ctx.fillRect(t.anchor.x, row * t.height + t.anchor.y - 2, 1, 5);
          ctx.fillStyle = '#258b9199';
          ctx.fillRect(2, row * t.height + t.anchor.y, t.width - 4, 1);
          ctx.fillStyle = '#443b42';
          ctx.font = '6px monospace';
          ctx.fillText(dir[0].toUpperCase(), 3, row * t.height + 7);
        }
        const directory = `TECH_DOCS/CHARACTER/TEMPLATES/${templateFolder(t)}`;
        const stem = `${directory}/${t.id.replaceAll('-', '_')}_${mode}`;
        save(stem + '_TEMPLATE.png', c);
        save(stem + '_EMPTY.png', make(c.width, c.height));
        records.push({
          id: t.id,
          category: t.category,
          mode,
          views,
          width: t.width,
          height: t.height,
          anchor: t.anchor,
          parent: t.parent,
          template: stem + '_TEMPLATE.png',
          empty: stem + '_EMPTY.png',
        });
      }
    const palette = make(300, 70),
      pc = palette.getContext('2d');
    pc.font = '12px monospace';
    pal.forEach((color, i) => {
      pc.fillStyle = color;
      pc.fillRect(i * 60, 0, 60, 40);
      pc.fillStyle = '#352b35';
      pc.fillText(color, i * 60 + 2, 60);
    });
    save('TECH_DOCS/CHARACTER/COLORS.png', palette);
    const config = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'female',
      hair: { male: 1, female: 1 },
      special: null,
    });
    for (const build of ['slim', 'average', 'sturdy'])
      save(
        `.cache/character-review/body-${build}-A24.png`,
        assemble(updateConstructor(config, { build }), { bodyOnly: true }),
      );
    for (let i = 1; i <= 4; i++)
      save(
        `.cache/character-review/hair-${i}-A24.png`,
        await loadAvatarSheet(
          avatarCatalog,
          updateConstructor(config, { hair: { male: 1, female: i } }),
          new AbortController().signal,
        ),
      );
    const overview = make(1152, 720),
      oc = overview.getContext('2d');
    oc.fillStyle = '#f5efe5';
    oc.fillRect(0, 0, 1152, 720);
    oc.imageSmoothingEnabled = false;
    for (const [i, build] of ['slim', 'average', 'sturdy'].entries()) {
      const a = assemble(updateConstructor(config, { build }), { bodyOnly: true });
      oc.drawImage(a, 0, 256, 96, 128, 30 + i * 380, 25, 288, 384);
      oc.fillStyle = '#352b35';
      oc.font = '20px sans-serif';
      oc.fillText(build, 30 + i * 380, 450);
      oc.font = '16px sans-serif';
      oc.fillText(
        'arm ' + BODY_SHAPES[build].arm + ' / leg ' + BODY_SHAPES[build].leg,
        30 + i * 380,
        482,
      );
    }
    save('.cache/character-review/proportions.png', overview);
    return {
      files,
      manifest: {
        version: RIG_VERSION,
        frame: FRAME,
        fps: ANIMATION_FPS,
        bodyShapes: BODY_SHAPES,
        templates: records,
      },
      rig: DIRECTIONS.flatMap((dir) =>
        ['slim', 'average', 'sturdy'].flatMap((build) =>
          Array.from({ length: 6 }, (_, f) => pose(build, dir, f)),
        ),
      ),
    };
  });
  for (const [file, bytes] of Object.entries(pack.files)) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(bytes, 'base64'));
  }
  await writeFile(
    'content/avatars/modular/template-manifest.json',
    await format(JSON.stringify(pack.manifest), { parser: 'json' }),
  );
  await writeFile('.cache/character-review/rig.json', JSON.stringify(pack.rig, null, 2) + '\n');
  console.log(
    '2× character templates generated:',
    pack.manifest.templates.length,
    'pairs. A24/rig reviews are in .cache/character-review only.',
  );
} finally {
  await browser.close();
}
