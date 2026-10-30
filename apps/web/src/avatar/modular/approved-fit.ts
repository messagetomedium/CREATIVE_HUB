/** Imported artwork adapter only. The approved body renderer/poses remain byte-for-byte unchanged. */
import type { AvatarConfig } from '@creative-factory/contracts';
import { constructorChoices } from '../editor';
import { editorDimensions, editorShoeLayout, reviewPose } from '../editorMotion';
import { DIRECTIONS, pose } from './rig';
import type { PartEntry } from './parts';
export interface RgbaRaster {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}
export function fitApprovedPixels(
  source: RgbaRaster,
  descriptor: PartEntry,
  config: AvatarConfig,
  geometry: 'approved' | 'legacy' = 'approved',
) {
  const approved = descriptor.approved;
  if (!approved || approved.kind === 'head') return { descriptor, raster: source };
  const c = constructorChoices(config),
    kind = approved.kind,
    index = descriptor.parent.endsWith('Left') ? 0 : 1;
  const rects: { row: number; x0: number; x1: number; y0: number; y1: number; at: number }[] = [];
  let minX = 128,
    minY = 128,
    maxX = -128,
    maxY = -128;
  const isInk = (at: number) =>
    source.data[at + 3] === 255 &&
    source.data[at] === 53 &&
    source.data[at + 1] === 43 &&
    source.data[at + 2] === 53;
  for (const [row, dir] of DIRECTIONS.entries()) {
    const ref = reviewPose('average', dir, 0, approved.referenceGender),
      target =
        geometry === 'approved' ? reviewPose(c.build, dir, 0, c.gender) : pose(c.build, dir, 0);
    const rd = editorDimensions('average', ref.side, approved.referenceGender, dir),
      td = editorDimensions(c.build, target.side, c.gender, dir);
    const widthAt = (y: number, reference: boolean) => {
      if (y < 58) return 8;
      const dims = reference ? rd : td;
      if (!reference && geometry === 'legacy') {
        const waist = target.side ? Math.round(target.shape.waist * 0.65) : target.shape.waist;
        return y < 76
          ? target.torsoWidth + ((waist - target.torsoWidth) * (y - 58)) / 18
          : waist + (target.hipWidth - waist) * Math.min(1, (y - 76) / 12);
      }
      return (
        dims.shoulderWidth +
        (dims.torsoWidth - dims.shoulderWidth) * Math.min(1, Math.max(0, (y - 58) / 26))
      );
    };
    const mapY = (local: number) => {
      if (geometry === 'legacy' && (kind === 'torso' || kind === 'belt')) {
        const root = kind === 'torso' ? ref.torso.y : ref.pelvis.y,
          outRoot = kind === 'torso' ? target.torso.y : target.pelvis.y,
          world = root + local;
        return (world < 58 ? world : 58 + ((world - 58) * 30) / 34) - outRoot;
      }
      if (geometry === 'legacy' && (kind === 'arm' || kind === 'leg'))
        return (local * (kind === 'arm' ? 20 : 24)) / 26;
      return local;
    };
    for (let y = 0; y < descriptor.frameHeight; y++) {
      const ly = y - descriptor.anchor.y;
      const sy = kind === 'belt' ? ref.pelvis.y + ly : ref.torso.y + ly;
      const ty = kind === 'belt' ? target.pelvis.y + mapY(ly) : target.torso.y + mapY(ly);
      const scale =
        kind === 'arm'
          ? target.arms[index]!.width / rd.armWidth
          : kind === 'leg'
            ? target.legs[index]!.width / rd.legWidth
            : kind === 'torso' || kind === 'belt'
              ? widthAt(ty, false) / widthAt(sy, true)
              : kind === 'pelvis'
                ? target.hipWidth / rd.torsoWidth
                : 1;
      const shift =
        kind === 'foot' && geometry === 'approved'
          ? editorShoeLayout(c.build, dir, index).left -
            editorShoeLayout('average', dir, index).left
          : 0;
      let first = descriptor.frameWidth,
        last = -1;
      for (let x = 0; x < descriptor.frameWidth; x++)
        if (source.data[((row * descriptor.frameHeight + y) * source.width + x) * 4 + 3]) {
          first = Math.min(first, x);
          last = Math.max(last, x);
        }
      if (last < first) continue;
      const rowAt = (x: number) => ((row * descriptor.frameHeight + y) * source.width + x) * 4;
      const left = first - descriptor.anchor.x,
        right = last + 1 - descriptor.anchor.x,
        a = Math.round(left * scale + shift),
        b = Math.round(right * scale + shift);
      const fixedLeft =
        last - first >= 3 && b - a >= 4 && isInk(rowAt(first)) && isInk(rowAt(first + 1)) ? 2 : 0;
      const fixedRight =
        last - first >= 3 && b - a >= 4 && isInk(rowAt(last)) && isInk(rowAt(last - 1)) ? 2 : 0;
      const mapX = (local: number) => {
        if (fixedLeft && local <= left + 2) return a + local - left;
        if (fixedRight && local >= right - 2) return b - (right - local);
        const inner = right - left - fixedLeft - fixedRight;
        return inner > 0
          ? a + fixedLeft + ((local - left - fixedLeft) * (b - a - fixedLeft - fixedRight)) / inner
          : local * scale + shift;
      };
      for (let x = first; x <= last; x++) {
        const at = rowAt(x);
        if (!source.data[at + 3]) continue;
        const x0 = Math.round(mapX(x - descriptor.anchor.x)),
          x1 = Math.round(mapX(x + 1 - descriptor.anchor.x)),
          y0 = Math.round(mapY(ly)),
          y1 = Math.round(mapY(ly + 1));
        if (x1 <= x0 || y1 <= y0) continue;
        minX = Math.min(minX, x0);
        maxX = Math.max(maxX, x1);
        minY = Math.min(minY, y0);
        maxY = Math.max(maxY, y1);
        rects.push({ row, x0, x1, y0, y1, at });
      }
    }
  }
  const width = Math.max(1, maxX - minX),
    height = Math.max(1, maxY - minY);
  if (width > 96 || height > 128)
    throw new Error(
      'Импортированная вещь не помещается в кадр после подгонки; уточните макет или маску.',
    );
  const data = new Uint8ClampedArray(width * height * 4 * 4);
  for (const r of rects)
    for (let y = r.y0; y < r.y1; y++)
      for (let x = r.x0; x < r.x1; x++) {
        const at = ((r.row * height + y - minY) * width + x - minX) * 4;
        data.set(source.data.subarray(r.at, r.at + 4), at);
      }
  // Match the approved blockout's far-leg/boot depth tint; front/back stay uniform.
  if (geometry === 'approved' && (kind === 'leg' || kind === 'foot')) {
    const outline = [53, 43, 53];
    for (const row of index === 0 ? [1] : [3]) {
      for (let at = row * width * height * 4; at < (row + 1) * width * height * 4; at += 4)
        if (data[at + 3]) {
          for (let channel = 0; channel < 3; channel++)
            data[at + channel] = Math.round(data[at + channel]! * 0.86 + outline[channel]! * 0.14);
        }
    }
  }
  const legacyLimb = geometry === 'legacy' && (kind === 'arm' || kind === 'leg');
  const legacyWidth =
    kind === 'arm'
      ? pose(c.build, 'south', 0).arms[index]!.width
      : pose(c.build, 'south', 0).legs[index]!.width;
  return {
    descriptor: {
      ...descriptor,
      frameWidth: width,
      frameHeight: height,
      anchor: { x: -minX, y: -minY },
      fit: legacyLimb ? ('limb' as const) : ('fixed' as const),
      referenceWidth: legacyLimb ? { front: legacyWidth, side: legacyWidth } : undefined,
    },
    raster: { width, height: height * 4, data },
  };
}
