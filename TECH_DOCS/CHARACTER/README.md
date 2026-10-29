# ТЗ и шаблоны утверждённого персонажа

Версия **approved-editor-2026-10-29**, основа — утверждённый редактор `01432c7`. [Скачать ZIP](CREATIVE_FACTORY_ARTIST_KIT.zip) · [Правило тела](BODY_STANDARD.md) · [План производства по вкладкам](PRODUCTION.md) · [Рисование/стыки](ART_RULES.md) · [Имена](FILE_NAMING.md) · [Сдача](DELIVERY.md).

Все PNG нативного размера, прозрачность сохранена. TEMPLATE — подложка для нового слоя; EMPTY — полностью прозрачный холст. Художник сдаёт **статичные вещи**, без ручных A24, фаз движения, разрезания каждой ноги и копий на цвета/комплекции. Контур **2 px**, рука/нога рига **26 px** от узла до конца, четыре телосложения. Старые подложки заменены, а не оставлены как второй действующий стандарт.

## Файлы и размеры

Каждая строка описывает один вариант источника. Full и pair, high и low, short и long — альтернативы, не дополнительные обязательные рисунки. Размер указан для готового PNG целиком; клетки идут вертикально без зазоров.

<!-- character-sizes:start -->

| Имя файла / тип                | Папка CHARACTER | Рисунков | Готовый PNG | Шаблон                                                                                                                    | Что делает программа                                                   |
| ------------------------------ | --------------- | -------: | ----------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `hair_short_full_01.png`       | hair            |        4 | 96×384      | [TEMPLATE](TEMPLATES/HAIR/hair_short_full_TEMPLATE.png) · [EMPTY](TEMPLATES/HAIR/hair_short_full_EMPTY.png)               | Цельная причёска → перед/зад по цветным зонам                          |
| `hair_long_full_01.png`        | hair            |        4 | 96×448      | [TEMPLATE](TEMPLATES/HAIR/hair_long_full_TEMPLATE.png) · [EMPTY](TEMPLATES/HAIR/hair_long_full_EMPTY.png)                 | Один лист головы/шеи/груди → перед/зад; pair = 3 вида                  |
| `eyes_basic_front_01.png`      | eyes            |        1 | 64×64       | [TEMPLATE](TEMPLATES/EYES/eyes_front_TEMPLATE.png) · [EMPTY](TEMPLATES/EYES/eyes_front_EMPTY.png)                         | Два глаза фронтом; для E/W берётся соответствующий глаз, N пусто       |
| `mouth_basic_front_01.png`     | mouth           |        1 | 64×64       | [TEMPLATE](TEMPLATES/MOUTH/mouth_front_TEMPLATE.png) · [EMPTY](TEMPLATES/MOUTH/mouth_front_EMPTY.png)                     | Один фронтальный рот; профиль из половины рисунка, N пусто             |
| `face_detail_front_01.png`     | face_features   |        1 | 64×64       | [TEMPLATE](TEMPLATES/DETAILS/details_sym1_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_sym1_EMPTY.png)               | Фронтальная маска → соответствующие половины лица E/W; N пусто         |
| `hat_detail_full_01.png`       | hats            |        4 | 64×256      | [TEMPLATE](TEMPLATES/DETAILS/details_full_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_full_EMPTY.png)               | Четыре настоящих вида шапки; sym1 только для одинаковой плоской детали |
| `accessory_detail_sym2_01.png` | jewelry         |        2 | 64×128      | [TEMPLATE](TEMPLATES/DETAILS/details_sym2_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_sym2_EMPTY.png)               | Фронт + правый бок; W отражается из E, N повторяет фронт               |
| `accessory_detail_full_01.png` | jewelry         |        4 | 64×256      | [TEMPLATE](TEMPLATES/DETAILS/details_full_TEMPLATE.png) · [EMPTY](TEMPLATES/DETAILS/details_full_EMPTY.png)               | Все четыре вида художника, без отражения                               |
| `pants_high_full_01.png`       | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/pants_high_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/pants_high_full_EMPTY.png)         | Цельная вещь → верхний пояс + нижняя часть; штанины выделяет код       |
| `pants_low_full_01.png`        | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/pants_low_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/pants_low_full_EMPTY.png)           | Цельная вещь без верхней полосы → только нижний модуль                 |
| `skirt_high_full_01.png`       | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/skirt_high_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/skirt_high_full_EMPTY.png)         | Цельная юбка → верхний пояс + цельная нижняя часть                     |
| `skirt_low_full_01.png`        | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/skirt_low_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/skirt_low_full_EMPTY.png)           | Цельная вещь без верхней полосы → только нижний модуль                 |
| `shorts_high_full_01.png`      | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/shorts_high_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/shorts_high_full_EMPTY.png)       | Цельная вещь → верхний пояс + нижняя часть; штанины выделяет код       |
| `shorts_low_full_01.png`       | bottoms         |        4 | 80×256      | [TEMPLATE](TEMPLATES/BOTTOMS/shorts_low_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BOTTOMS/shorts_low_full_EMPTY.png)         | Цельная вещь без верхней полосы → только нижний модуль                 |
| `shoes_basic_pair_01.png`      | footwear        |        3 | 40×54       | [TEMPLATE](TEMPLATES/FOOTWEAR/shoe_pair_TEMPLATE.png) · [EMPTY](TEMPLATES/FOOTWEAR/shoe_pair_EMPTY.png)                   | Один ботинок: фронт/бок/спина; W и второй ботинок формируются кодом    |
| `top_body_full_01.png`         | tops            |        4 | 56×208      | [TEMPLATE](TEMPLATES/TOPS/top_full_TEMPLATE.png) · [EMPTY](TEMPLATES/TOPS/top_full_EMPTY.png)                             | Корпус верха; рукав необязателен для безрукавки                        |
| `top_body_female_full_01.png`  | tops            |        4 | 56×208      | [TEMPLATE](TEMPLATES/TOPS/top_female_full_TEMPLATE.png) · [EMPTY](TEMPLATES/TOPS/top_female_full_EMPTY.png)               | Необязательная посадка на женские плечи; это альтернатива общему верху |
| `top_sleeve_full_01.png`       | tops            |        4 | 24×160      | [TEMPLATE](TEMPLATES/TOPS/sleeve_full_TEMPLATE.png) · [EMPTY](TEMPLATES/TOPS/sleeve_full_EMPTY.png)                       | Один рукав → две руки; тот же номер, что у корпуса                     |
| `top_glove_pair_01.png`        | tops            |        3 | 20×72       | [TEMPLATE](TEMPLATES/TOPS/glove_pair_TEMPLATE.png) · [EMPTY](TEMPLATES/TOPS/glove_pair_EMPTY.png)                         | Одна цельная перчатка/манжета → две кисти                              |
| `body_torso_full_01.png`       | body_features   |        4 | 56×208      | [TEMPLATE](TEMPLATES/BODY_FEATURES/body_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BODY_FEATURES/body_full_EMPTY.png)         | Накладка корпуса; тело не рисовать                                     |
| `body_arm_full_01.png`         | body_features   |        4 | 24×160      | [TEMPLATE](TEMPLATES/BODY_FEATURES/body_arm_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BODY_FEATURES/body_arm_full_EMPTY.png) | Накладка руки; тело не рисовать                                        |
| `body_leg_full_01.png`         | body_features   |        4 | 24×144      | [TEMPLATE](TEMPLATES/BODY_FEATURES/body_leg_full_TEMPLATE.png) · [EMPTY](TEMPLATES/BODY_FEATURES/body_leg_full_EMPTY.png) | Накладка ноги; тело не рисовать                                        |
| `item_hand_full_01.png`        | specials        |        4 | 32×160      | [TEMPLATE](TEMPLATES/SPECIALS/item_full_TEMPLATE.png) · [EMPTY](TEMPLATES/SPECIALS/item_full_EMPTY.png)                   | Предмет на кисти; не верхняя деталь головы                             |

<!-- character-sizes:end -->

## Опоры в одной клетке

| Источник                    | Клетка         | Опора X,Y | Что совмещать                               |
| --------------------------- | -------------- | --------- | ------------------------------------------- |
| hair_short / hair_long      | 96×96 / 96×112 | 48,34     | Голова, одинаковая посадка во всех видах    |
| eyes / mouth / details      | 64×64          | 32,32     | Голова и верх шеи                           |
| top / top_female / body     | 56×52          | 28,24     | Центр корпуса на y=72 полного кадра         |
| sleeve / body_arm           | 24×40          | 12,8      | Плечевой узел на y=64, низ руки y=34 клетки |
| glove                       | 20×24          | 10,6      | Кистевой узел, центр кулачка (10,10)        |
| body_leg                    | 24×36          | 12,4      | Корень ноги; голеностоп y=30 клетки         |
| pants/skirt/shorts high/low | 80×64          | 40,20     | Служебный таз на y=84 полного кадра         |
| shoe                        | 40×18          | 20,8      | Голеностоп; один целый ботинок              |
| item                        | 32×40          | 16,8      | Правая кисть, центр кулачка (16,12)         |

Для любого t размер листа = ширина клетки × (высота клетки × число видов). Поэтому sleeve full — **24×160**, pair — **24×120**; body_arm имеет те же размеры. Top full — 56×208, pair — 56×156; body_leg full — 24×144, pair — 24×108. Остальные размеры клеток сохранены, но подложки внутри теперь соответствуют утверждённой форме.

## Как сократить число рисунков

- Глаза, рот, лицевая накладка — по одному S. Это не кадры моргания/речи.
- Волосы и низ — цельная вещь; перед/зад волос, пояс и штанины выделяет подготовка графики.
- Симметричная вещь может иметь S/E/N (pair). Для надписей, разных карманов/прядей или разных профилей выбрать full. Режим full никогда не заменяет W отражением E.
- Обувь — один ботинок в трёх видах. Обычный верх — корпус + один рукав; перчатка необязательна.
- Четыре комплекции и все цвета получают из одной основы; голова/кулачки/размер обуви постоянны. Женская подложка top_female — только дополнительная посадка для облегающего дизайна.
- Шесть вариантов каждой категории — вместимость редактора. Не надо сразу заполнять все слоты, рисовать все альтернативные шаблоны или все двенадцать цветов.

Текущая готовность подключения и обязательный тест до серии — [DELIVERY.md](DELIVERY.md). Документация не включает изменение утверждённого редактора или карты.
