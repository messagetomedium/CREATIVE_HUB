# Как рисовать графику Creative Factory

**Программа создаёт тело и анимацию. Художник рисует только сменные вещи — без ручного разрезания по ригу и без анимационных спрайт-листов.** Исходники 2×: кадр 96×128, голова 40×40; игровой размер прежний.

1. Выберите строку в таблице. Откройте **TEMPLATE PNG** в исходном размере; **EMPTY PNG** того же размера лежит рядом.
2. На новом слое рисуйте по силуэту, точке крепления и цветным зонам. Техническую подложку не включать в рисунок.
3. Для перекраски используйте `#202020`, `#505050`, `#808080`, `#b8b8b8`, `#f0f0f0`; внешний контур 1 пиксель. [Палитра](CHARACTER/COLORS.png). Глаза/рот могут быть fixed RGBA, кожные эффекты допускают alpha.
4. Скройте TEMPLATE, экспортируйте только художественный слой на прозрачности. Не обрезать поля, не менять размер/порядок клеток, не применять сглаживание.
5. Имя простое: **`category_template_symmetry_01.png`**. Например `pants_high_full_01.png`, `hair_long_full_01.png`, `shoes_basic_pair_01.png`. **Номер — существующий слот 01…06**, для особенностей тела до 12. У pants/skirt/shorts общая нумерация низа; примеры с 01 — альтернативы, не три вещи в одном слоте.
6. Загрузите PNG в указанную папку [CHARACTER](../CHARACTER/README.md). Обычный файл не требует заполнения метаданных; название/исключение можно добавить строкой в `ITEMS.md`. JSON не нужен.
7. Напишите Codex: **«Импортируй новые изображения из CHARACTER»**. Команда — `npm run character:import`. Она проверяет оригинал и готовит внутренние слои, привязки, профили и миниатюру. Затем Codex проверяет и публикует приложение. Сам коммит PNG без импорта пока не подключает его к игре.
8. Проверьте слот в конструкторе, четыре направления, ожидание/ходьбу и три телосложения. Исправленный PNG загрузите под тем же именем и повторите импорт.

**Порядок рисунков:** `full` = фронт S, правый бок E, спина N, левый бок W; `pair` = фронт S, правый бок E, спина N. `sym1` = один фронтальный рисунок для всех направлений; `sym2` = фронт S + правый бок E (W отражается, N повторяет фронт). Если затылок детали отличается, выбрать `full`. `front` = только фронт лица; нужные профили формирует программа, N пустой.

<!-- character-categories:start -->

| Файл-пример                    | Рисунков | PNG    | Шаблон                                                                 | Куда загрузить                              |
| ------------------------------ | -------: | ------ | ---------------------------------------------------------------------- | ------------------------------------------- |
| `hair_short_full_01.png`       |        4 | 96×384 | [Шаблон](CHARACTER/TEMPLATES/HAIR/hair_short_full_TEMPLATE.png)        | [hair](../CHARACTER/hair)                   |
| `hair_long_full_01.png`        |        4 | 96×448 | [Шаблон](CHARACTER/TEMPLATES/HAIR/hair_long_full_TEMPLATE.png)         | [hair](../CHARACTER/hair)                   |
| `eyes_basic_front_01.png`      |        1 | 64×64  | [Шаблон](CHARACTER/TEMPLATES/EYES/eyes_front_TEMPLATE.png)             | [eyes](../CHARACTER/eyes)                   |
| `mouth_basic_front_01.png`     |        1 | 64×64  | [Шаблон](CHARACTER/TEMPLATES/MOUTH/mouth_front_TEMPLATE.png)           | [mouth](../CHARACTER/mouth)                 |
| `face_detail_front_01.png`     |        1 | 64×64  | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_sym1_TEMPLATE.png)        | [face_features](../CHARACTER/face_features) |
| `hat_detail_sym1_01.png`       |        1 | 64×64  | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_sym1_TEMPLATE.png)        | [hats](../CHARACTER/hats)                   |
| `accessory_detail_sym2_01.png` |        2 | 64×128 | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_sym2_TEMPLATE.png)        | [jewelry](../CHARACTER/jewelry)             |
| `accessory_detail_full_01.png` |        4 | 64×256 | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_full_TEMPLATE.png)        | [jewelry](../CHARACTER/jewelry)             |
| `pants_high_full_01.png`       |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/pants_high_full_TEMPLATE.png)     | [bottoms](../CHARACTER/bottoms)             |
| `pants_low_full_01.png`        |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/pants_low_full_TEMPLATE.png)      | [bottoms](../CHARACTER/bottoms)             |
| `skirt_high_full_01.png`       |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/skirt_high_full_TEMPLATE.png)     | [bottoms](../CHARACTER/bottoms)             |
| `skirt_low_full_01.png`        |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/skirt_low_full_TEMPLATE.png)      | [bottoms](../CHARACTER/bottoms)             |
| `shorts_high_full_01.png`      |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/shorts_high_full_TEMPLATE.png)    | [bottoms](../CHARACTER/bottoms)             |
| `shorts_low_full_01.png`       |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/shorts_low_full_TEMPLATE.png)     | [bottoms](../CHARACTER/bottoms)             |
| `shoes_basic_pair_01.png`      |        3 | 40×54  | [Шаблон](CHARACTER/TEMPLATES/FOOTWEAR/shoe_pair_TEMPLATE.png)          | [footwear](../CHARACTER/footwear)           |
| `top_body_pair_01.png`         |        3 | 56×156 | [Шаблон](CHARACTER/TEMPLATES/TOPS/top_pair_TEMPLATE.png)               | [tops](../CHARACTER/tops)                   |
| `top_sleeve_pair_01.png`       |        3 | 24×96  | [Шаблон](CHARACTER/TEMPLATES/TOPS/sleeve_pair_TEMPLATE.png)            | [tops](../CHARACTER/tops)                   |
| `top_glove_pair_01.png`        |        3 | 20×72  | [Шаблон](CHARACTER/TEMPLATES/TOPS/glove_pair_TEMPLATE.png)             | [tops](../CHARACTER/tops)                   |
| `body_torso_full_01.png`       |        4 | 56×208 | [Шаблон](CHARACTER/TEMPLATES/BODY_FEATURES/body_full_TEMPLATE.png)     | [body_features](../CHARACTER/body_features) |
| `body_arm_full_01.png`         |        4 | 24×128 | [Шаблон](CHARACTER/TEMPLATES/BODY_FEATURES/body_arm_full_TEMPLATE.png) | [body_features](../CHARACTER/body_features) |
| `body_leg_full_01.png`         |        4 | 24×144 | [Шаблон](CHARACTER/TEMPLATES/BODY_FEATURES/body_leg_full_TEMPLATE.png) | [body_features](../CHARACTER/body_features) |
| `item_hand_full_01.png`        |        4 | 32×160 | [Шаблон](CHARACTER/TEMPLATES/SPECIALS/item_full_TEMPLATE.png)          | [specials](../CHARACTER/specials)           |

<!-- character-categories:end -->

**[Полная таблица файлов, шаблонов и логики импорта](CHARACTER/README.md)** · **[Как рисовать по зонам, цвета и перекрытия](CHARACTER/ART_RULES.md)** · **[Имена и ITEMS.md](CHARACTER/FILE_NAMING.md)**.

Сначала сдайте одну причёску или одну вещь, проверьте её в игре и только затем расширяйте набор. Критические ошибки появляются в `DEBUG_REPORT.md` соответствующей категории; исправленная запись исчезает после повторного импорта. Технические проверки не заменяют визуальную оценку посадки и дизайна.
