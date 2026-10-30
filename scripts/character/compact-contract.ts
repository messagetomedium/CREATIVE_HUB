export const COMPACT_VERSION = 'compact-approved-2026-10-30';
export const SOURCE_VIEWS = ['south', 'east', 'north', 'west'] as const;
export const RUNTIME_VIEWS = ['north', 'east', 'south', 'west'] as const;
export const COMPACT_SPECS = {
  HAIR: { width: 96, height: 112, anchor: { x: 48, y: 34 }, parent: 'head' },
  HEAD: { width: 64, height: 64, anchor: { x: 32, y: 32 }, parent: 'head' },
  TOP: { width: 96, height: 112, anchor: { x: 48, y: 72 }, parent: 'torso' },
  BOTTOM: { width: 80, height: 64, anchor: { x: 40, y: 20 }, parent: 'pelvis' },
  SHOES: { width: 40, height: 18, anchor: { x: 20, y: 8 }, parent: 'footLeft' },
} as const;
export const COMPACT_TYPES = {
  hair: { template: 'HAIR', category: 'hair', field: 'hair', material: 'hair' },
  top: { template: 'TOP', category: 'tops', field: 'top', material: 'top' },
  bottom: { template: 'BOTTOM', category: 'bottoms', field: 'bottom', material: 'bottom' },
  skirt: { template: 'BOTTOM', category: 'bottoms', field: 'bottom', material: 'bottom' },
  shoes: { template: 'SHOES', category: 'footwear', field: 'footwear', material: 'footwear' },
  hat: { template: 'HEAD', category: 'hats', field: 'hat', material: 'hat' },
  accessory: { template: 'HEAD', category: 'jewelry', field: 'jewelry', material: 'jewelry' },
  eyes: { template: 'HEAD', category: 'eyes', field: 'eyes', material: 'fixed' },
  mouth: { template: 'HEAD', category: 'mouth', field: 'mouth', material: 'fixed' },
  face: { template: 'HEAD', category: 'face_features', field: 'faceFeatures', material: 'skin' },
} as const;
export type CompactType = keyof typeof COMPACT_TYPES;
export const BELT_ZONE = { top: 8, bottom: 16, legSplit: 24 } as const;
