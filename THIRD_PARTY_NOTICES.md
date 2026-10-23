# Прямые сторонние зависимости

Проверены package.json установленных версий; полный граф воспроизводится по package-lock.json. License/notices поставляются внутри соответствующих npm-пакетов и должны сохраняться при распространении. Это перечень прямых зависимостей, а не исчерпывающий SBOM bundled/transitive-компонентов.

| Пакет                  | Версия  | Лицензия   | Источник пакета                                                      |
| ---------------------- | ------- | ---------- | -------------------------------------------------------------------- |
| react                  | 19.3.1  | MIT        | [npm](https://www.npmjs.com/package/react/v/19.3.1)                  |
| react-dom              | 19.3.1  | MIT        | [npm](https://www.npmjs.com/package/react-dom/v/19.3.1)              |
| phaser                 | 3.90.0  | MIT        | [npm](https://www.npmjs.com/package/phaser/v/3.90.0)                 |
| @colyseus/core         | 0.18.23 | MIT        | [npm](https://www.npmjs.com/package/@colyseus/core/v/0.18.23)        |
| @colyseus/schema       | 5.0.42  | MIT        | [npm](https://www.npmjs.com/package/@colyseus/schema/v/5.0.42)       |
| @colyseus/sdk          | 0.18.6  | MIT        | [npm](https://www.npmjs.com/package/@colyseus/sdk/v/0.18.6)          |
| @colyseus/ws-transport | 0.18.4  | MIT        | [npm](https://www.npmjs.com/package/@colyseus/ws-transport/v/0.18.4) |
| zod                    | 4.6.7   | MIT        | [npm](https://www.npmjs.com/package/zod/v/4.6.7)                     |
| typescript             | 5.9.3   | Apache-2.0 | [npm](https://www.npmjs.com/package/typescript/v/5.9.3)              |
| vite                   | 8.3.5   | MIT        | [npm](https://www.npmjs.com/package/vite/v/8.3.5)                    |
| @vitejs/plugin-react   | 6.1.2   | MIT        | [npm](https://www.npmjs.com/package/@vitejs/plugin-react/v/6.1.2)    |
| vitest                 | 5.0.5   | MIT        | [npm](https://www.npmjs.com/package/vitest/v/5.0.5)                  |
| @playwright/test       | 1.64.1  | Apache-2.0 | [npm](https://www.npmjs.com/package/@playwright/test/v/1.64.1)       |
| tsx                    | 4.20.6  | MIT        | [npm](https://www.npmjs.com/package/tsx/v/4.20.6)                    |
| prettier               | 3.8.1   | MIT        | [npm](https://www.npmjs.com/package/prettier/v/3.8.1)                |
| @types/node            | 24.10.1 | MIT        | [npm](https://www.npmjs.com/package/@types/node/v/24.10.1)           |
| @types/react           | 19.3.0  | MIT        | [npm](https://www.npmjs.com/package/@types/react/v/19.3.0)           |
| @types/react-dom       | 19.2.3  | MIT        | [npm](https://www.npmjs.com/package/@types/react-dom/v/19.2.3)       |

Supabase SDK сейчас не устанавливается: его лицензия и условия выбранной версии будут проверены на этапе 2. WorkAdventure и его пакеты отсутствуют в dependencies. Собственная графика описана в [content/ASSETS.md](content/ASSETS.md).
