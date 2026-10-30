/** Deliberately simple test graphics. Never installed in the real CHARACTER catalogue. */
import { PNG } from 'pngjs';
import { reviewPose } from '../../apps/web/src/avatar/editorMotion';
import { SOURCE_VIEWS } from './compact-contract';
export function rect(
  image: PNG,
  row: number,
  height: number,
  x: number,
  y: number,
  width: number,
  h: number,
  color = [184, 184, 184, 255],
) {
  for (let dy = y; dy < y + h; dy++)
    for (let dx = x; dx < x + width; dx++)
      image.data.set(color, ((row * height + dy) * image.width + dx) * 4);
}
export function topFixture(views = 4) {
  const p = new PNG({ width: 96, height: 448 });
  for (let row = 0; row < views; row++) {
    const dir = SOURCE_VIEWS[row]!,
      pose = reviewPose('average', dir, 0, 'male');
    rect(p, row, 112, pose.side ? 35 : 33, 58, pose.side ? 26 : 30, 34);
    for (const i of pose.side ? [dir === 'east' ? 1 : 0] : [0, 1])
      rect(p, row, 112, pose.arms[i]!.root.x - 5, 58, 10, 32);
  }
  return p;
}
export function lowerFixture(length = 46, belt = true, skirt = false, views = 4) {
  const p = new PNG({ width: 80, height: 256 });
  for (let row = 0; row < views; row++) {
    const dir = SOURCE_VIEWS[row]!;
    if (belt) rect(p, row, 64, 25, 8, 30, 8);
    rect(p, row, 64, 25, 16, 30, 8);
    if (skirt) rect(p, row, 64, 22, 24, 36, length - 24);
    else
      for (const x of dir === 'east' || dir === 'west' ? [36] : [26, 42])
        rect(p, row, 64, x, 24, 12, length - 24);
  }
  return p;
}
export function headFixture(rows = [0, 1, 2, 3]) {
  const p = new PNG({ width: 64, height: 256 });
  for (const row of rows) rect(p, row, 64, 14 + row, 16, 5, 4, [80 + row * 16, 20 + row, 40, 255]);
  return p;
}
export function hairFixture() {
  const p = new PNG({ width: 96, height: 448 });
  for (let row = 0; row < 4; row++) {
    rect(p, row, 112, 29, 12, 38, 15);
    rect(p, row, 112, 29, 54, 8, 28);
    rect(p, row, 112, 42, 54, 12, 28);
  }
  return p;
}
export function shoesFixture() {
  const p = new PNG({ width: 40, height: 54 });
  for (let row = 0; row < 3; row++) rect(p, row, 18, 14, 6, row === 1 ? 14 : 12, 7);
  return p;
}
