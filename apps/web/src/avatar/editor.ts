import {
  SavedAvatarSchema,
  type AvatarCatalog,
  type AvatarConfig,
  type AvatarCustomization,
} from '@creative-factory/contracts';

export const FABRIC_PALETTE = [
  '#f1e9d8',
  '#d9cbbc',
  '#d6ab82',
  '#cf6546',
  '#e49a83',
  '#ccac62',
  '#7c9585',
  '#46584c',
  '#7495a9',
  '#6e7da4',
  '#a294bd',
  '#484754',
];
export const AVATAR_PALETTES = {
  skin: [
    '#f4e3d4',
    '#efd7c6',
    '#e8c8a2',
    '#e2bfae',
    '#dcae86',
    '#bd947f',
    '#ad8261',
    '#9a7767',
    '#805d48',
    '#674e43',
  ],
  hair: [
    '#273a36',
    '#594035',
    '#78543c',
    '#a8784f',
    '#c79e68',
    '#e2c78f',
    '#e9dccc',
    '#b7afa7',
    '#797679',
    '#b75b3f',
    '#8d393b',
    '#5b494c',
  ],
  outfit: FABRIC_PALETTE,
  shoes: FABRIC_PALETTE,
};
export const CONSTRUCTOR_TABS = ['body', 'head', 'clothes', 'details'] as const;
export type ConstructorTab = (typeof CONSTRUCTOR_TABS)[number];
export const TAB_LABELS: Record<ConstructorTab, string> = {
  body: 'Тело',
  head: 'Голова',
  clothes: 'Одежда',
  details: 'Детали',
};
export const FACE_FEATURES = [
  'Веснушки',
  'Родинки на лице',
  'Покраснения',
  'Синяки под глазами',
  'Румянец',
  'Румяная переносица',
];
export const SLOTS = [1, 2, 3, 4, 5, 6];
const HAIR_PARTS = ['short-01', 'bob-01', 'curls-01', 'short-01', 'bob-01', 'curls-01'];
const FEMALE_HAIR_PARTS = ['bob-01', 'curls-01', 'short-01', 'bob-01', 'curls-01', 'short-01'];
const TOP_PARTS = ['workwear-01', 'jacket-01', 'dress-01', 'workwear-01', 'jacket-01', 'dress-01'];

/** Read old saves without changing them or marking an untouched form dirty. */
export function constructorChoices(config: AvatarConfig): AvatarCustomization {
  if (config.customization) return structuredClone(config.customization);
  return {
    version: 1,
    gender: 'male',
    age: 'adult',
    build: config.parts.body === 'base-02' ? 'sturdy' : 'average',
    bodyFeatures: [],
    mouth: 1,
    eyes: 1,
    faceFeatures: [],
    hair: {
      male: HAIR_PARTS.indexOf(config.parts.hair) + 1 || 1,
      female: FEMALE_HAIR_PARTS.indexOf(config.parts.hair) + 1 || 1,
    },
    top: TOP_PARTS.indexOf(config.parts.outfit) + 1 || 1,
    bottom: 1,
    footwear: 1,
    hat: null,
    jewelry: null,
    special: config.parts.accessory === 'headphones-01' ? 1 : null,
    colors: { bottom: '#46584c', hat: '#a294bd', jewelry: '#ccac62', special: '#f1e9d8' },
  };
}
/** Project new choices onto the existing blockout catalog until their sprites arrive. */
export function updateConstructor(
  config: AvatarConfig,
  patch: Partial<AvatarCustomization>,
): AvatarConfig {
  const customization = { ...constructorChoices(config), ...patch };
  return SavedAvatarSchema.parse({
    ...config,
    customization,
    parts: {
      body: customization.build === 'sturdy' ? 'base-02' : 'base-01',
      hair: (customization.gender === 'male' ? HAIR_PARTS : FEMALE_HAIR_PARTS)[
        customization.hair[customization.gender] - 1
      ],
      outfit: TOP_PARTS[customization.top - 1],
      accessory: customization.special === 1 ? 'headphones-01' : null,
    },
  });
}
export function appearanceKey(a: AvatarConfig): string {
  return JSON.stringify([
    a.catalogVersion,
    a.presetId,
    a.parts.body,
    a.parts.hair,
    a.parts.outfit,
    a.parts.accessory,
    a.palette.skin,
    a.palette.hair,
    a.palette.outfit,
    a.palette.shoes,
    a.customization ?? null,
  ]);
}
export function randomAvatar(
  _catalog: AvatarCatalog,
  previous: AvatarConfig,
  random = Math.random,
): AvatarConfig {
  const choose = <T>(items: readonly T[]): T =>
    items[Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))]!;
  let avatar = updateConstructor(previous, {
    gender: choose(['male', 'female'] as const),
    age: choose(['child', 'adult'] as const),
    build: choose(['slim', 'average', 'sturdy'] as const),
    hair: { male: choose(SLOTS), female: choose(SLOTS) },
    top: choose(SLOTS),
    bottom: choose(SLOTS),
    footwear: choose(SLOTS),
    mouth: choose(SLOTS),
    eyes: choose(SLOTS),
    hat: choose([null, ...SLOTS]),
    jewelry: choose([null, ...SLOTS]),
    special: choose([null, ...SLOTS]),
    colors: {
      bottom: choose(FABRIC_PALETTE),
      hat: choose(FABRIC_PALETTE),
      jewelry: choose(FABRIC_PALETTE),
      special: choose(FABRIC_PALETTE),
    },
  });
  for (const key of ['skin', 'hair', 'outfit', 'shoes'] as const)
    avatar.palette[key] = choose(AVATAR_PALETTES[key]);
  if (appearanceKey(avatar) === appearanceKey(previous)) {
    const index = AVATAR_PALETTES.skin.indexOf(avatar.palette.skin);
    avatar = {
      ...avatar,
      palette: {
        ...avatar.palette,
        skin: AVATAR_PALETTES.skin[(index + 1) % AVATAR_PALETTES.skin.length]!,
      },
    };
  }
  return SavedAvatarSchema.parse(avatar);
}
