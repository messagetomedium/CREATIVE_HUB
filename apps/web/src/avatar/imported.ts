import source from '../../../../content/avatars/modular/import-manifest.json';
import { contentPath } from '../game/contentPath';
const fields: Record<string, string> = {
  hair: 'hair',
  eyes: 'eyes',
  mouth: 'mouth',
  faceFeatures: 'face_features',
  bodyFeatures: 'body_features',
  top: 'tops',
  bottom: 'bottoms',
  footwear: 'footwear',
  hat: 'hats',
  jewelry: 'jewelry',
  special: 'specials',
};
interface ImportedItem {
  category: string;
  slot: number;
  gender?: string;
  label: string;
  thumbnail: string;
}
export function importedChoice(field: string, slot: number, gender: string) {
  return (source.items as ImportedItem[]).find(
    (i) => i.category === fields[field] && i.slot === slot && (!i.gender || i.gender === gender),
  );
}
export const importedThumbnail = (url: string) => contentPath(url, import.meta.env.BASE_URL);
