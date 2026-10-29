# product-ui

Редизайн карточки товара (`/tproduct/...`, блок `t-catalog__prod-snippet`): галерея со скруглениями, крупные заголовок и цена, «Оформление» карточками с фото, «Размер» кнопками с ценой, широкая кнопка покупки (на мобиле липкая), преимущества под кнопкой, цены по размерам из описания — табличкой.

CSS подтягивается скриптом сам, из той же папки. Картинки вариантов — модуль option-images (класс `dv-optimg-on`).

Цены в кнопках размера берутся из описания товара, строки вида `S 25 шт. — 450 AED`. Тексты преимуществ и ссылка на каталог — в начале `dv-product-ui.js` (`PERKS`, `CATALOG`).

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
  s.src = 'https://cdn.jsdelivr.net/gh/mirowdav/dejavu-tilda@v0.1.5/product-ui/dv-product-ui.js';
  document.body.appendChild(s);
})();
</script>
```

Локальная проверка: `before.html` / `after.html` (копии страницы, в git не входят).
