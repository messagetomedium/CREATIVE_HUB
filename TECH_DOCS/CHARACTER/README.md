# Шаблоны и файлы персонажа 2×

[Короткий процесс](../README.md) · [Зоны и палитра](ART_RULES.md) · [Именование/исключения](FILE_NAMING.md).

В каждой строке — **один художественный PNG на вариант**. TEMPLATE — только подложка; EMPTY полностью прозрачный. Клетки расположены вертикально без зазоров. Выберите один режим, не рисуйте все альтернативы сразу. Для верхней одежды корпус/рукав/необязательная перчатка пока отдельны; низ и причёска всегда рисуются целиком.

<!-- character-sizes:start -->

| Имя файла / тип                | Папка CHARACTER | Рисунков | Готовый PNG | Шаблон                                                                                                                    | Что делает программа                                                |
| ------------------------------ | --------------- | -------: | ----------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `hair_short_full_01.png`       | hair            |        4 | 96×384      | [TEMPLATE](TEMPLATES/HAIR/hair_short_full_TEMPLATE.png) · [EMPTY](TEMPLATES/HAIR/hair_short_full_EMPTY.png)               | Цельная причёска → перед/зад по цветным зонам                       |
| `hair_long_full_01.png`        | hair            |        4 | 96×448      | [TEMPLATE](TEMPLATES/HAIR/hair_long_full_TEMPLATE.png) · [EMPTY](TEMPLATES/HAIR/hair_long_full_EMPTY.png)                 | Один лист головы/шеи/груди → перед/зад; pair = 3 вида               |
| `eyes_basic_front_01.png`      | eyes            |        1 | 64×64       | [TEMPLATE](TEMPLATES/EYES/eyes_front_TEMPLATE.png) · [EMPTY](TEMPLATES/EYES/eyes_front_EMPTY.png)                         | Два глаза фронтом; для E/W берётся соответствующий глаз, N пусто    |
| `mouth_basic_front_01.png`     | mouth           |        1 | 64×64       | [TEMPLATE](TEMPLATES/MOUTH/mouth_front_TEMPLATE.png) · [EMPTY](TEMPLATES/MOUTH/mouth_front_EMPTY.png)                     | Один фронтальный рот; профиль из половины рисунка, N пусто          |
| `face_detail_front_01.png`     | face_features   |        1 | 64×64       | [TEMPLATE](TEMPLATES/DETAILS/details_sym1_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_sym1_EMPTY.png)               | Фронтальная маска → соответствующие половины лица E/W; N пусто      |
| `hat_detail_sym1_01.png`       | hats            |        1 | 64×64       | [TEMPLATE](TEMPLATES/DETAILS/details_sym1_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_sym1_EMPTY.png)               | Один вид без изменений для N/E/S/W                                  |
| `accessory_detail_sym2_01.png` | jewelry         |        2 | 64×128      | [TEMPLATE](TEMPLATES/DETAILS/details_sym2_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_sym2_EMPTY.png)               | Фронт + правый бок; W отражается из E, N повторяет фронт            |
| `accessory_detail_full_01.png` | jewelry         |        4 | 64×256      | [TEMPLATE](TEMPLATES/DETAILS/details_full_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_full_EMPTY.png)               | Все четыре вида художника, без отражения                            |
| `pants_high_full_01.png`       | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/pants_high_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/pants_high_full_EMPTY.png)         | Цельная вещь → верхний пояс + нижняя часть; штанины выделяет код    |
| `pants_low_full_01.png`        | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/pants_low_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/pants_low_full_EMPTY.png)           | Цельная вещь без верхней полосы → только нижний модуль              |
| `skirt_high_full_01.png`       | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/skirt_high_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/skirt_high_full_EMPTY.png)         | Цельная юбка → верхний пояс + цельная нижняя часть                  |
| `skirt_low_full_01.png`        | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/skirt_low_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/skirt_low_full_EMPTY.png)           | Цельная вещь без верхней полосы → только нижний модуль              |
| `shorts_high_full_01.png`      | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/shorts_high_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/shorts_high_full_EMPTY.png)       | Цельная вещь → верхний пояс + нижняя часть; штанины выделяет код    |
| `shorts_low_full_01.png`       | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/shorts_low_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/shorts_low_full_EMPTY.png)         | Цельная вещь без верхней полосы → только нижний модуль              |
| `shoes_basic_pair_01.png`      | footwear        |        3 | 40×54       | [TEMPLATE](TEMPLATES/FOOTWEAR/shoe_pair_TEMPLATE.png) · [EMPTY](TEMPLATES/FOOTWEAR/shoe_pair_EMPTY.png)                   | Один ботинок: фронт/бок/спина; W и второй ботинок формируются кодом |
| `top_body_pair_01.png`         | tops            |        3 | 56×156      | [TEMPLATE](TEMPLATES/TOPS/top_pair_TEMPLATE.png) · [EMPTY](TEMPLATES/TOPS/top_pair_EMPTY.png)                             | Корпус верха; рукав необязателен для безрукавки                     |
| `top_sleeve_pair_01.png`       | tops            |        3 | 24×96       | [TEMPLATE](TEMPLATES/TOPS/sleeve_pair_TEMPLATE.png) · [EMPTY](TEMPLATES/TOPS/sleeve_pair_EMPTY.png)                       | Один рукав → две руки; тот же номер, что у корпуса                  |
| `top_glove_pair_01.png`        | tops            |        3 | 20×72       | [TEMPLATE](TEMPLATES/TOPS/glove_pair_TEMPLATE.png) · [EMPTY](TEMPLATES/TOPS/glove_pair_EMPTY.png)                         | Одна цельная перчатка/манжета → две кисти                           |
| `body_torso_full_01.png`       | body_features   |        4 | 56×208      | [TEMPLATE](TEMPLATES/BODY_FEATURES/body_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BODY_FEATURES/body_full_EMPTY.png)         | Накладка корпуса; тело не рисовать                                  |
| `body_arm_full_01.png`         | body_features   |        4 | 24×128      | [TEMPLATE](TEMPLATES/BODY_FEATURES/body_arm_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BODY_FEATURES/body_arm_full_EMPTY.png) | Накладка руки; тело не рисовать                                     |
| `body_leg_full_01.png`         | body_features   |        4 | 24×144      | [TEMPLATE](TEMPLATES/BODY_FEATURES/body_leg_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BODY_FEATURES/body_leg_full_EMPTY.png) | Накладка ноги; тело не рисовать                                     |
| `item_hand_full_01.png`        | specials        |        4 | 32×160      | [TEMPLATE](TEMPLATES/SPECIALS/item_full_TEMPLATE.png) · [EMPTY](TEMPLATES/SPECIALS/item_full_EMPTY.png)                   | Предмет на кисти; не верхняя деталь головы                          |

<!-- character-sizes:end -->

## Минимальное количество рисунков

- Глаза: **один фронтальный набор из двух глаз**; рот: **один фронтальный рот**; веснушки/румянец/родинка: **одна фронтальная накладка**. Профили и пустой N готовит программа. Лицевая накладка использует тот же холст головы/шеи, что `details_sym1`, но имя `face_detail_front_01.png` включает адаптацию половин лица, а не повтор картинки во всех направлениях.
- Верхние детали/шапки/украшения: **единый DETAILS**, никаких отдельных шаблонов по подкатегориям. `sym1` — 1 рисунок, `sym2` — 2, `full` — 4 клетки. Файл загружается в папку нужного существующего слота: hats/jewelry/face_features. Предмет на кисти использует отдельный `item_hand`.
- Причёска: **один цельный лист** с 4 видами `full` или 3 `pair`; код выделяет переднюю/заднюю части по зонам шаблона. `short` — 96×96 на ракурс; `long` — 96×112, с местом для шеи, плеч, груди и длины. Для pair PNG соответственно 96×288 / 96×336. Передние и задние слои вручную не рисовать.
- Низ: **один цельный лист** выбранного типа pants/skirt/shorts и посадки high/low. `full` — 80×256, 4 рисунка; `pair` — 80×192, 3 рисунка. High включает верхний пояс; low не содержит верхнюю полосу. Внутренний пояс/низ/штанины готовит код; юбка остаётся цельным нижним модулем.
- Обувь: **один ботинок в трёх видах front/side/back**, один PNG 40×54. Второй ботинок, W и движение создаются программно. Ботинок не делится на носок/подошву/пятку.
- Для верха/рукавов/перчаток и накладок тела можно выбрать pair вместо full: высота равна 3 клеткам, а не 4. Точные PNG уже лежат в соответствующих папках; рассчитывать размеры не нужно.

Для асимметрии используйте full. Невидимый вид у детали может быть пустым; у основного объёма одежды/волос/обуви необходимы виды со всех направлений. Цветовые копии, три телосложения и A24 художник не производит. Кисти, голое тело и стопы рисует программа.

Номер — общий слот внутри категории. В частности pants/skirt/shorts 01 заняли бы один и тот же слот низа: нумеруйте готовые варианты последовательно. Ёмкость редактора: волосы 6 мужских + 6 женских, глаза/рот/лицевые эффекты по 6, особенности тела 12, остальные категории по 6. Это резерв, а не заказ выдумать все дизайны.
