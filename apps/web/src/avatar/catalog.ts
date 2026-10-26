import { AvatarCatalogSchema } from '@creative-factory/contracts';
import source from '../../../../content/avatars/catalog.json';
export const avatarCatalog = AvatarCatalogSchema.parse(source);
