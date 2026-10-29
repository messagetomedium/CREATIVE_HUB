"""Deterministic documentation archive; never includes application code or artist sources."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

output = Path('TECH_DOCS/CHARACTER/CREATIVE_FACTORY_ARTIST_KIT.zip')
files = sorted(p for p in Path('TECH_DOCS').rglob('*') if p.is_file() and p.suffix in ('.md', '.png'))
files += [Path('CHARACTER/README.md'), *sorted(Path('CHARACTER').glob('*/ITEMS.md'))]
entries = {p.as_posix(): p.read_bytes() for p in files}
entries['START_HERE.md'] = ('# Creative Factory — комплект художнику\n\n'
    'Утверждённый персонаж 01432c7, 29 октября 2026.\n\n'
    'Начать с [TECH_DOCS/README.md](TECH_DOCS/README.md). '
    'Рисовать поверх TEMPLATE, экспортировать без подложки в CHARACTER. '
    'Контур 2 px; фазы движения вручную не рисовать.\n').encode('utf8')
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(entries.items()):
        info = ZipInfo(name, date_time=(2026, 10, 29, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data, compress_type=ZIP_DEFLATED, compresslevel=9)
print(f'Artist kit: {len(entries)} files, {output.stat().st_size} bytes; no runtime code or animation sheets.')
