import type { Point, Limb } from './rig';
export function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function raster(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  inside: (x: number, y: number) => boolean,
  color: string,
  line: string,
) {
  for (let y = Math.floor(bounds.y); y <= bounds.y + bounds.h; y++)
    for (let x = Math.floor(bounds.x); x <= bounds.x + bounds.w; x++)
      if (inside(x + 0.5, y + 0.5)) {
        ctx.fillStyle =
          inside(x - 0.5, y + 0.5) &&
          inside(x + 1.5, y + 0.5) &&
          inside(x + 0.5, y - 0.5) &&
          inside(x + 0.5, y + 1.5)
            ? color
            : line;
        ctx.fillRect(x, y, 1, 1);
      }
}
export function polygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  line: string,
) {
  const minX = Math.min(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y));
  const inside = (x: number, y: number) => {
    let yes = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i]!,
        b = points[j]!;
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
    }
    return yes;
  };
  raster(
    ctx,
    {
      x: minX,
      y: minY,
      w: Math.max(...points.map((p) => p.x)) - minX,
      h: Math.max(...points.map((p) => p.y)) - minY,
    },
    inside,
    color,
    line,
  );
}
export function oval(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  line: string,
) {
  polygon(
    ctx,
    [
      [-rx + 6, -ry],
      [rx - 6, -ry],
      [rx, -ry + 8],
      [rx, ry - 8],
      [rx - 8, ry],
      [-rx + 8, ry],
      [-rx, ry - 8],
      [-rx, -ry + 8],
    ].map(([dx, dy]) => ({ x: x + dx!, y: y + dy! })),
    color,
    line,
  );
}
export function limbShape(ctx: CanvasRenderingContext2D, l: Limb, color: string, line: string) {
  const points = [l.root, l.joint, l.end],
    radius = l.width / 2;
  const inside = (x: number, y: number) => {
    for (let i = 0; i < 2; i++) {
      const a = points[i]!,
        b = points[i + 1]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.max(1, Math.hypot(dx, dy)),
        t = ((x - a.x) * dx + (y - a.y) * dy) / (len * len),
        normal = ((x - a.x) * dy - (y - a.y) * dx) / len;
      if (
        t >= 0 &&
        t <= 1 &&
        normal >= -(l.width + (((l.tipWidth ?? l.width) - l.width) * (i + t)) / 2) / 2 &&
        normal < (l.width + (((l.tipWidth ?? l.width) - l.width) * (i + t)) / 2) / 2
      )
        return true;
    }
    return Math.hypot(x - l.joint.x, y - l.joint.y) < (l.width + (l.tipWidth ?? l.width)) / 4;
  };
  const x = Math.min(...points.map((p) => p.x)) - radius,
    y = Math.min(...points.map((p) => p.y)) - radius;
  raster(
    ctx,
    {
      x,
      y,
      w: Math.max(...points.map((p) => p.x)) + radius - x,
      h: Math.max(...points.map((p) => p.y)) + radius - y,
    },
    inside,
    color,
    line,
  );
}
