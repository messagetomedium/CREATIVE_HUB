import { importCharacters } from './character/pipeline';
const result = await importCharacters();
console.log(
  `CHARACTER: обновлено ${result.updated}, без изменений ${result.unchanged}, подключено ${result.items} предметов.`,
);
if (result.errors.length) {
  for (const e of result.errors) console.error(`${e.category}/${e.name}: ${e.problem}`);
  process.exitCode = 1;
}
