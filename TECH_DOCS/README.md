# Графика для утверждённого персонажа Creative Factory

**Персонаж утверждён 29 октября 2026, редактор `01432c7`. Рисуем вещи под него, форму тела и анимацию не переделываем.**

[Скачать весь комплект художнику](CHARACTER/CREATIVE_FACTORY_ARTIST_KIT.zip) · [Что и сколько рисовать](CHARACTER/PRODUCTION.md) · [Эталон тела и опоры](CHARACTER/BODY_STANDARD.md).

1. Выбрать одну нужную подложку TEMPLATE и прозрачный EMPTY в таблице ниже. Основной рисунок — на среднем теле, без отдельных цветовых/анимационных копий.
2. Рисовать на новом слое; внешний контур **2 исходных пикселя**, прозрачность PNG, без сглаживания. [Правила и стыки](CHARACTER/ART_RULES.md).
3. Скрыть подложку и сохранить полный PNG с прежними полями и порядком статичных видов. Анимационные фазы, вторая рука/ботинок и четыре телосложения вручную не производятся.
4. Назвать по [FILE_NAMING](CHARACTER/FILE_NAMING.md), положить в нужную папку [CHARACTER](../CHARACTER/README.md). Художнику не нужен JSON или код.
5. Передать один тестовый комплект разработчику по [DELIVERY](CHARACTER/DELIVERY.md), проверить посадку и затем рисовать серию. Старый импортёр ещё требует адаптации к утверждённому телу; сам коммит PNG не заменяет пробного подключения.

Ракурсы full сверху вниз S/E/N/W (спереди/смотрит вправо/сзади/смотрит влево), pair — S/E/N только для симметрии. Front — один фронт лица. Шапкам с другим затылком нужен full. Точные опоры, размеры клеток и EMPTY — [в полной таблице](CHARACTER/README.md).

<!-- character-categories:start -->

| Файл-пример                    | Рисунков | PNG    | Шаблон                                                                 | Куда загрузить                              |
| ------------------------------ | -------: | ------ | ---------------------------------------------------------------------- | ------------------------------------------- |
| `hair_short_full_01.png`       |        4 | 96×384 | [Шаблон](CHARACTER/TEMPLATES/HAIR/hair_short_full_TEMPLATE.png)        | [hair](../CHARACTER/hair)                   |
| `hair_long_full_01.png`        |        4 | 96×448 | [Шаблон](CHARACTER/TEMPLATES/HAIR/hair_long_full_TEMPLATE.png)         | [hair](../CHARACTER/hair)                   |
| `eyes_basic_front_01.png`      |        1 | 64×64  | [Шаблон](CHARACTER/TEMPLATES/EYES/eyes_front_TEMPLATE.png)             | [eyes](../CHARACTER/eyes)                   |
| `mouth_basic_front_01.png`     |        1 | 64×64  | [Шаблон](CHARACTER/TEMPLATES/MOUTH/mouth_front_TEMPLATE.png)           | [mouth](../CHARACTER/mouth)                 |
| `face_detail_front_01.png`     |        1 | 64×64  | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_sym1_TEMPLATE.png)        | [face_features](../CHARACTER/face_features) |
| `hat_detail_full_01.png`       |        4 | 64×256 | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_full_TEMPLATE.png)        | [hats](../CHARACTER/hats)                   |
| `accessory_detail_sym2_01.png` |        2 | 64×128 | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_sym2_TEMPLATE.png)        | [jewelry](../CHARACTER/jewelry)             |
| `accessory_detail_full_01.png` |        4 | 64×256 | [Шаблон](CHARACTER/TEMPLATES/DETAILS/details_full_TEMPLATE.png)        | [jewelry](../CHARACTER/jewelry)             |
| `pants_high_full_01.png`       |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/pants_high_full_TEMPLATE.png)     | [bottoms](../CHARACTER/bottoms)             |
| `pants_low_full_01.png`        |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/pants_low_full_TEMPLATE.png)      | [bottoms](../CHARACTER/bottoms)             |
| `skirt_high_full_01.png`       |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/skirt_high_full_TEMPLATE.png)     | [bottoms](../CHARACTER/bottoms)             |
| `skirt_low_full_01.png`        |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/skirt_low_full_TEMPLATE.png)      | [bottoms](../CHARACTER/bottoms)             |
| `shorts_high_full_01.png`      |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/shorts_high_full_TEMPLATE.png)    | [bottoms](../CHARACTER/bottoms)             |
| `shorts_low_full_01.png`       |        4 | 80×256 | [Шаблон](CHARACTER/TEMPLATES/BOTTOMS/shorts_low_full_TEMPLATE.png)     | [bottoms](../CHARACTER/bottoms)             |
| `shoes_basic_pair_01.png`      |        3 | 40×54  | [Шаблон](CHARACTER/TEMPLATES/FOOTWEAR/shoe_pair_TEMPLATE.png)          | [footwear](../CHARACTER/footwear)           |
| `top_body_full_01.png`         |        4 | 56×208 | [Шаблон](CHARACTER/TEMPLATES/TOPS/top_full_TEMPLATE.png)               | [tops](../CHARACTER/tops)                   |
| `top_body_female_full_01.png`  |        4 | 56×208 | [Шаблон](CHARACTER/TEMPLATES/TOPS/top_female_full_TEMPLATE.png)        | [tops](../CHARACTER/tops)                   |
| `top_sleeve_full_01.png`       |        4 | 24×160 | [Шаблон](CHARACTER/TEMPLATES/TOPS/sleeve_full_TEMPLATE.png)            | [tops](../CHARACTER/tops)                   |
| `top_glove_pair_01.png`        |        3 | 20×72  | [Шаблон](CHARACTER/TEMPLATES/TOPS/glove_pair_TEMPLATE.png)             | [tops](../CHARACTER/tops)                   |
| `body_torso_full_01.png`       |        4 | 56×208 | [Шаблон](CHARACTER/TEMPLATES/BODY_FEATURES/body_full_TEMPLATE.png)     | [body_features](../CHARACTER/body_features) |
| `body_arm_full_01.png`         |        4 | 24×160 | [Шаблон](CHARACTER/TEMPLATES/BODY_FEATURES/body_arm_full_TEMPLATE.png) | [body_features](../CHARACTER/body_features) |
| `body_leg_full_01.png`         |        4 | 24×144 | [Шаблон](CHARACTER/TEMPLATES/BODY_FEATURES/body_leg_full_TEMPLATE.png) | [body_features](../CHARACTER/body_features) |
| `item_hand_full_01.png`        |        4 | 32×160 | [Шаблон](CHARACTER/TEMPLATES/SPECIALS/item_full_TEMPLATE.png)          | [specials](../CHARACTER/specials)           |

<!-- character-categories:end -->
