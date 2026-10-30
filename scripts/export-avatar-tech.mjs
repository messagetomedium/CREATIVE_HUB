import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { format } from 'prettier';
import snapshot from './character/approved-snapshot.json' with { type: 'json' };

// Documentation export only. Reads the approved editor; never modifies app code/assets.
for (const [file, hash] of Object.entries(snapshot.sha256)) {
  const actual = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  if (actual !== hash)
    throw new Error(`Approved editor changed: ${file}. Do not silently refreeze it.`);
}
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use local Vite');
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  const page = await browser.newPage();
  let registryIsolated = false;
  // Isolate reference generation from future imported clothing without editing the registry.
  await page.route('**/content/avatars/modular/parts.json*', (route) => {
    registryIsolated = true;
    return route.fulfill({ contentType: 'application/javascript', body: 'export default [];' });
  });
  await page.goto(base.href);
  const pack = await page.evaluate(
    async ({ contractUrl }) => {
      const {
        ARTIST_TEMPLATES,
        ARTIST_VIEWS,
        ARTIST_BUILDS,
        ARTIST_VERSION,
        ARTIST_LOWER,
        artistLegX,
        artistHairLayer,
      } = await import(contractUrl);
      const { createEditorRig } = await import('/src/avatar/editorReview.ts');
      const {
        reviewPose,
        editorDimensions,
        EDITOR_ARM_LENGTH,
        EDITOR_LEG_LENGTH,
        EDITOR_WALK_FRAME_MS,
      } = await import('/src/avatar/editorMotion.ts');
      const { parentPoint, FRAME, FACE_ANCHORS } = await import('/src/avatar/modular/rig.ts');
      const { avatarCatalog } = await import('/src/avatar/catalog.ts');
      const { updateConstructor } = await import('/src/avatar/editor.ts');
      const files = {},
        records = [],
        captures = new Map();
      const make = (width, height) =>
        Object.assign(document.createElement('canvas'), { width, height });
      const save = (name, c) => {
        files[name] = c.toDataURL('image/png').split(',')[1];
      };
      const ink = [53, 43, 53];
      const normalize = (source, name) => {
        const out = make(96, 128),
          ctx = out.getContext('2d');
        const data = source.getContext('2d').getImageData(0, 0, 96, 128),
          copy = new Uint8ClampedArray(data.data);
        const solid = (x, y) =>
          x >= 0 && x < 96 && y >= 0 && y < 128 && copy[(y * 96 + x) * 4 + 3] > 0;
        for (let y = 0; y < 128; y++)
          for (let x = 0; x < 96; x++) {
            const at = (y * 96 + x) * 4;
            if (!copy[at + 3]) continue;
            const outline = ink.every((v, i) => copy[at + i] === v);
            const external = [
              [-2, 0],
              [2, 0],
              [0, -2],
              [0, 2],
            ].some(([dx, dy]) => !solid(x + dx, y + dy));
            // Preserve the approved open joins. Remove only temporary sleeve/colour seams from underlays.
            data.data.set(
              outline && (name === 'head' || external) ? [53, 43, 53, 255] : [184, 184, 184, 255],
              at,
            );
          }
        ctx.putImageData(data, 0, 0);
        return out;
      };
      const order = {
        south: [
          'back',
          'legLeft',
          'footLeft',
          'legRight',
          'footRight',
          'torso',
          'armLeft',
          'handLeft',
          'armRight',
          'handRight',
          'head',
        ],
        north: [
          'back',
          'legLeft',
          'footLeft',
          'legRight',
          'footRight',
          'handLeft',
          'handRight',
          'torso',
          'armLeft',
          'armRight',
          'head',
        ],
        east: [
          'back',
          'armLeft',
          'handLeft',
          'legLeft',
          'footLeft',
          'legRight',
          'footRight',
          'torso',
          'armRight',
          'handRight',
          'head',
        ],
        west: [
          'back',
          'armRight',
          'handRight',
          'legRight',
          'footRight',
          'legLeft',
          'footLeft',
          'torso',
          'armLeft',
          'handLeft',
          'head',
        ],
      };
      for (const gender of ['female', 'male'])
        for (const build of ARTIST_BUILDS) {
          const config = updateConstructor(avatarCatalog.defaultAvatar, {
            gender,
            build,
            hair: { male: 6, female: 6 },
            special: null,
            hat: null,
            jewelry: null,
            bodyFeatures: [],
            faceFeatures: [],
          });
          const rig = await createEditorRig(config, new AbortController().signal);
          for (const direction of ARTIST_VIEWS.full) {
            const native = make(96, 128),
              ctx = native.getContext('2d'),
              parts = new Map();
            let i = 0;
            const original = ctx.drawImage.bind(ctx);
            ctx.drawImage = (...args) => {
              const name = order[direction][i++];
              if (!name) throw new Error('Approved draw order changed');
              const module = make(96, 128),
                mc = module.getContext('2d');
              mc.setTransform(ctx.getTransform());
              mc.drawImage(...args);
              parts.set(name, normalize(module, name));
              original(...args);
            };
            rig.draw(ctx, direction, 'static', 0);
            if (i !== order[direction].length) throw new Error('Approved module count changed');
            captures.set(`${gender}/${build}/${direction}`, {
              parts,
              order: order[direction],
              pose: reviewPose(build, direction, 0, gender),
            });
          }
        }
      // Both genders have the same head. Use its approved bare female source to omit the male hair placeholder.
      for (const capture of captures.values())
        capture.parts.set(
          'head',
          captures.get(`female/average/${capture.pose.direction}`).parts.get('head'),
        );
      const selected = (t) =>
        t.id === 'HAIR'
          ? ['head', 'torso', 'armLeft', 'armRight']
          : t.id === 'HEAD'
            ? ['head']
            : t.id === 'TOP'
              ? ['torso', 'armLeft', 'armRight', 'handLeft', 'handRight']
              : t.id === 'BOTTOM'
                ? ['torso', 'legLeft', 'legRight']
                : ['footLeft'];
      for (const t of ARTIST_TEMPLATES)
        for (const mode of t.modes) {
          const views = ARTIST_VIEWS[mode],
            out = make(t.width, t.height * views.length),
            ctx = out.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          for (const [row, direction] of views.entries()) {
            const capture = captures.get(`male/average/${direction}`),
              p = capture.pose;
            const parent = parentPoint(p, t.parent),
              dx = t.anchor.x - parent.x,
              dy = row * t.height + t.anchor.y - parent.y;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, row * t.height, t.width, t.height);
            ctx.clip();
            for (const name of capture.order)
              if (
                name !== 'back' &&
                (t.id !== 'HEAD' || name === 'head') &&
                (t.id !== 'SHOES' || ['footLeft', 'legLeft'].includes(name))
              ) {
                ctx.globalAlpha = selected(t).includes(name) ? 0.52 : 0.09;
                ctx.drawImage(capture.parts.get(name), dx, dy);
              }
            if (t.id === 'HEAD') {
              ctx.save();
              ctx.beginPath();
              ctx.rect(44 + dx, 50 + dy, 8, 12);
              ctx.clip();
              ctx.globalAlpha = 0.3;
              ctx.drawImage(capture.parts.get('torso'), dx, dy);
              ctx.restore();
            }
            ctx.globalAlpha = 1;
            if (t.id === 'TOP') {
              ctx.fillStyle = '#d34b8420';
              ctx.fillRect(1, row * t.height + 1, t.width - 2, 49);
              for (const edge of [48 - p.hipWidth / 2, 48 + p.hipWidth / 2]) {
                ctx.fillStyle = '#258b9170';
                ctx.fillRect(edge, row * t.height + 56, 1, 40);
              }
              ctx.fillStyle = '#258b9170';
              ctx.fillRect(1, row * t.height + 86, t.width - 2, 1);
            }
            if (t.id === 'HAIR')
              for (let y = 1; y < t.height - 1; y++)
                for (let x = 1; x < t.width - 1; x++) {
                  ctx.fillStyle =
                    artistHairLayer(x, y, direction) === 'front' ? '#d34b8425' : '#258b9130';
                  ctx.fillRect(x, row * t.height + y, 1, 1);
                }
            if (t.id === 'BOTTOM') {
              const top = ARTIST_LOWER.bandTop;
              const hem = ARTIST_LOWER.floor;
              ctx.fillStyle = '#d34b8430';
              ctx.fillRect(1, row * t.height + 1, t.width - 2, top - 1);
              ctx.fillStyle = '#d34b8420';
              ctx.fillRect(1, row * t.height + top, t.width - 2, ARTIST_LOWER.bandBottom - top);
              for (const boundary of [top, ARTIST_LOWER.bandBottom, ARTIST_LOWER.legSplit, hem]) {
                ctx.fillStyle = '#258b91';
                ctx.fillRect(1, row * t.height + boundary, t.width - 2, 1);
              }
              const legs = p.side ? [direction === 'east' ? 1 : 0] : [0, 1];
              for (const i of legs) {
                const centre = artistLegX(direction, i);
                ctx.fillStyle = '#258b9160';
                ctx.fillRect(
                  centre,
                  row * t.height + ARTIST_LOWER.legSplit,
                  1,
                  hem - ARTIST_LOWER.legSplit,
                );
              }
            }
            if (t.parent === 'head') {
              ctx.fillStyle = '#7495a999';
              for (const pt of FACE_ANCHORS[direction].eyes)
                ctx.fillRect(48 + pt.x + dx, 34 + pt.y + dy, 4, 8);
              for (const pt of FACE_ANCHORS[direction].mouth)
                ctx.fillRect(48 + pt.x + dx, 34 + pt.y + dy, 3, 1);
            }
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
            ctx.fillText(direction[0].toUpperCase(), 3, row * t.height + 7);
            ctx.restore();
          }
          const stem = `TECH_DOCS/CHARACTER/TEMPLATES/${t.id}`;
          save(stem + '_TEMPLATE.png', out);
          records.push({
            ...t,
            mode,
            views,
            template: stem + '_TEMPLATE.png',
          });
        }
      const references = [];
      for (const gender of ['male', 'female']) {
        const out = make(96 * 4, 128 * 4),
          ctx = out.getContext('2d');
        for (const [row, build] of ARTIST_BUILDS.entries())
          for (const [col, dir] of ARTIST_VIEWS.full.entries()) {
            const capture = captures.get(`${gender}/${build}/${dir}`);
            for (const name of capture.order)
              if (name !== 'back') ctx.drawImage(capture.parts.get(name), col * 96, row * 128);
          }
        const name = `TECH_DOCS/CHARACTER/BODY_${gender.toUpperCase()}.png`;
        save(name, out);
        references.push({ name, width: out.width, height: out.height });
      }
      const modules = ['head', 'torso', 'armLeft', 'handLeft', 'legLeft', 'footLeft'];
      const out = make(96 * modules.length, 128 * 4),
        ctx = out.getContext('2d');
      for (const [row, dir] of ARTIST_VIEWS.full.entries())
        for (const [col, name] of modules.entries())
          ctx.drawImage(captures.get(`male/average/${dir}`).parts.get(name), col * 96, row * 128);
      save('TECH_DOCS/CHARACTER/MODULES.png', out);
      references.push({
        name: 'TECH_DOCS/CHARACTER/MODULES.png',
        width: out.width,
        height: out.height,
      });
      const palette = make(300, 70),
        pc = palette.getContext('2d');
      pc.font = '12px monospace';
      ['#202020', '#505050', '#808080', '#b8b8b8', '#f0f0f0'].forEach((color, i) => {
        pc.fillStyle = color;
        pc.fillRect(i * 60, 0, 60, 40);
        pc.fillStyle = '#352b35';
        pc.fillText(color, i * 60 + 2, 60);
      });
      save('TECH_DOCS/CHARACTER/COLORS.png', palette);
      return {
        files,
        manifest: {
          version: ARTIST_VERSION,
          frame: FRAME,
          outlinePixels: 2,
          armLength: EDITOR_ARM_LENGTH,
          legLength: EDITOR_LEG_LENGTH,
          idleFrameMs: [500, 500],
          walkFrameMs: [...EDITOR_WALK_FRAME_MS],
          builds: ARTIST_BUILDS,
          geometry: ARTIST_BUILDS.map((build) => ({
            build,
            front: editorDimensions(build, false, 'male', 'south'),
            femaleFront: editorDimensions(build, false, 'female', 'south'),
            side: editorDimensions(build, true),
          })),
          neutralPoses: ['male', 'female'].flatMap((gender) =>
            ARTIST_VIEWS.full.map((dir) => {
              const p = reviewPose('average', dir, 0, gender);
              return {
                gender,
                direction: dir,
                head: p.head,
                torso: p.torso,
                pelvis: p.pelvis,
                arms: p.arms,
                hands: p.hands,
                legs: p.legs,
                feet: p.feet,
              };
            }),
          ),
          templates: records,
          references,
        },
      };
    },
    { contractUrl: '/@fs' + path.resolve('scripts/character/artist-contract.ts') },
  );
  if (!registryIsolated) throw new Error('Artist reference was not isolated from imported items');
  await rm('TECH_DOCS/CHARACTER/TEMPLATES', { recursive: true, force: true });
  for (const [file, bytes] of Object.entries(pack.files)) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(bytes, 'base64'));
  }
  const outputHashes = Object.fromEntries(
    Object.entries(pack.files).map(([file, bytes]) => [
      file,
      createHash('sha256').update(Buffer.from(bytes, 'base64')).digest('hex'),
    ]),
  );
  await writeFile(
    'content/avatars/modular/template-manifest.json',
    await format(JSON.stringify({ ...pack.manifest, approval: snapshot, outputHashes }), {
      parser: 'json',
    }),
  );
  console.log(
    `Approved editor exported read-only: ${pack.manifest.templates.length} artist TEMPLATE canvases, 4 builds, 2 genders, 4 independent views.`,
  );
} finally {
  await browser.close();
}
