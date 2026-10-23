/** Manifest entries are rooted at /content; hosting may add a project prefix. */
export function contentPath(entry: string, base: string): string {
  if (!/^\/content\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry) || entry.includes('..')) {
    throw new Error('Недопустимый путь контента');
  }
  if (
    !base.startsWith('/') ||
    !base.endsWith('/') ||
    base.startsWith('//') ||
    /[?#\\]/.test(base) ||
    base.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw new Error('Недопустимый базовый путь приложения');
  }
  return base + entry.slice(1);
}
