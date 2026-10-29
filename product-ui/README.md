# product-ui

Редизайн карточки товара (`/tproduct/...`, блок `t-catalog__prod-snippet`): галерея со скруглениями, крупные заголовок и цена, «Оформление» карточками с фото, «Размер» кнопками с ценой, широкая кнопка покупки (на мобиле липкая), преимущества под кнопкой. Описание товара скрыто, вместо него блок «Как выглядят размеры».

CSS подтягивается скриптом сам, из той же папки. Картинки вариантов — модуль option-images (класс `dv-optimg-on`).

Цены в кнопках размера берутся из описания товара, строки вида `S 25 шт. — 450 AED`. Тексты преимуществ и ссылка на каталог — в начале `dv-product-ui.js` (`PERKS`, `CATALOG`).

## Как выглядят размеры

Фото в `img/` (нарезка с общей картинки, красные розы): вкладки «Букет» (11/25/51) и «Коробка» (25/51/101/201). Фото в ряду одной высоты, поэтому масштаб честный. Вкладка выбирается по «Оформлению», подсвечивается фото с тем же числом цветов, что в выбранном размере; клик по фото выбирает этот размер. Блок показывается только у товаров с опцией «Размер».

Свои фото или отключение — до подключения скрипта:

```js
window.DV_SIZE_GUIDE = false; // или { title, groups: [{ name, match: /букет/i, items: [{ img, label, count, w, h }] }] }
```

## Тест на боевом сайте

«Настройки сайта → Вставка кода → перед `</body>`». Включается только у того, кто открыл сайт с `?dvui=1`, выключить — `?dvui=0`.

```html
<script>
(function () {
  try {
    if (/[?&]dvui=1/.test(location.search)) localStorage.setItem('dvui', '1');
    if (/[?&]dvui=0/.test(location.search)) localStorage.removeItem('dvui');
    if (!localStorage.getItem('dvui')) return;
  } catch (e) { return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/mirowdav/dejavu-tilda@v0.1.6/product-ui/dv-product-ui.js';
  (document.body || document.head).appendChild(s);
})();
</script>
```

Локальная проверка: `before.html` / `after.html` (копии страницы, в git не входят).
