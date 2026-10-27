import { readFile, writeFile } from 'node:fs/promises';
import { crc32 } from 'node:zlib';
const folder = new URL('../TECH_DOCS/ПЕРСОНАЖ/', import.meta.url);
const templates = JSON.parse(await readFile(new URL('ШАБЛОНЫ.json', folder)));
const names = [
  'ТЗ_ДЛЯ_ХУДОЖНИКА.md',
  'README.md',
  'НАБОР_ТЕЛА_ОБЗОР.png',
  'ПРОПОРЦИИ_ТЕЛА.png',
  'ИНДЕКСЫ_МАСКИ.png',
  ...templates.flatMap((t) => [t.blank, t.underlay, t.guide]),
];
// Standard ZIP/store, UTF-8 filenames. PNGs are already compressed; no tooling dependency.
const local = [],
  central = [];
let offset = 0,
  centralSize = 0;
for (const name of names) {
  const bytes =
      name === 'README.md'
        ? Buffer.from(
            '# Комплект художника Creative Factory\n\nНачать с ТЗ_ДЛЯ_ХУДОЖНИКА.md и НАБОР_ТЕЛА_ОБЗОР.png.\n\nПУСТОЙ — холст для рисования. ПОДЛОЖКА — посадка детали, скрыть перед экспортом. СХЕМА — увеличенные координаты и точка крепления.\n\nСначала сдаём 4 PNG тела: голова, корпус с шеей/тазом, цельная рука с кистью, цельная нога со стопой. Каждый PNG содержит 3 статических ракурса N/E/S. Не рисовать фазы анимации, цвета или телосложения.\n',
          )
        : await readFile(new URL(name, folder)),
    filename = Buffer.from(name),
    crc = crc32(bytes);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(0x5d5b, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(bytes.length, 18);
  header.writeUInt32LE(bytes.length, 22);
  header.writeUInt16LE(filename.length, 26);
  local.push(header, filename, bytes);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x800, 8);
  entry.writeUInt16LE(0x5d5b, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(bytes.length, 20);
  entry.writeUInt32LE(bytes.length, 24);
  entry.writeUInt16LE(filename.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, filename);
  centralSize += entry.length + filename.length;
  offset += header.length + filename.length + bytes.length;
}
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(names.length, 8);
end.writeUInt16LE(names.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...local, ...central, end]);
await writeFile(new URL('ДЛЯ_ХУДОЖНИКА.zip', folder), archive);
console.log(`Artist-only kit: ${names.length} files, ${archive.length} bytes; no A24 or archives.`);
