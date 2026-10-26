import { z } from 'zod';

const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]*$/, 'Уберите управляющие символы');
export const EmailSchema = z.string().trim().max(254).email('Проверьте адрес электронной почты');
export const HttpsLinkSchema = line(300)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        value.startsWith('https://') &&
        !/\s/.test(value) &&
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        /^[a-z0-9][a-z0-9.-]*$/i.test(url.hostname)
      );
    } catch {
      return false;
    }
  }, 'Нужна полная HTTPS-ссылка без логина и пароля')
  .transform((value) => new URL(value).href)
  .pipe(line(300));
export const ProfileInputSchema = z
  .object({
    firstName: line(60).min(1, 'Введите имя'),
    lastName: line(60).min(1, 'Введите фамилию'),
    role: z.enum(['expert', 'educator']),
    specialization: line(100),
    organization: line(120),
    competencies: z.array(line(60).min(1)).max(16),
    bio: z
      .string()
      .trim()
      .max(1000)
      .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/),
    portfolioLinks: z.array(HttpsLinkSchema).max(5),
  })
  .strict();
export type ProfileInput = z.infer<typeof ProfileInputSchema>;
export const PublicProfileSchema = ProfileInputSchema.extend({
  userId: z.string().uuid(),
  revision: z.number().int().positive(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export const EMPTY_PROFILE: ProfileInput = {
  firstName: '',
  lastName: '',
  role: 'expert',
  specialization: '',
  organization: '',
  competencies: [],
  bio: '',
  portfolioLinks: [],
};
