# option-images — картинки в опциях товара

Добавляет картинку в кнопки выбора варианта на карточке товара Tilda (например, «Оформление»: Букет / Коробка / Корзина). Опции динамические: если опции или значения нет на странице либо нет в конфиге, она пропускается.

## Подключение (блок T123 или «Вставка кода → перед `</body>`»)

```html
<script>
  window.DV_OPTION_IMAGES = {
    'Оформление': {
      'Букет':   'https://static.tildacdn.one/.../bouquet.jpg',
      'Коробка': 'https://static.tildacdn.one/.../box.jpg',
      'Корзина': 'https://static.tildacdn.one/.../basket.jpg'
    }
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/mirowdav/dejavu-tilda@<tag>/option-images/src/dv-option-images.js" defer></script>
```

Название опции и значения сравниваются без учёта регистра и лишних пробелов. Скрипт следит за DOM, поэтому работает и после перерисовки блока каталога, и в попапах.
