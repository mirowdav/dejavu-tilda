/* Dejavu: доп. разметка для карточки товара (крошки, размеры, преимущества, плашка с размерами). */
(function () {
  var PERKS = [
    ['Same-day delivery', '<path d="M3 7h11v8H3zM14 10h4l3 3v2h-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="7" cy="17" r="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="17" r="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ['Photo of your bouquet before dispatch', '<rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 6l1.2-2h4.6l1.2 2" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ['Free greeting card', '<rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 6.5L12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.5"/>']
  ];

  var self = document.currentScript || document.querySelector('script[src*="dv-product-ui.js"]');
  var IMG = self && self.src ? self.src.replace(/dv-product-ui\.js(\?.*)?$/, 'img/') : '';

  function boot() {
    // CSS лежит рядом со скриптом
    if (self && self.src && !document.getElementById('dv-product-ui-css')) {
      var l = document.createElement('link');
      l.id = 'dv-product-ui-css';
      l.rel = 'stylesheet';
      l.href = self.src.replace(/\.js(\?|$)/, '.css$1'); // метку ?t= из загрузчика тоже передаём
      document.head.appendChild(l);
    }
    // Допы (модуль addons) из того же тега: полка в карточке, попап, блок в корзине. Отключить: window.DV_ADDONS_SKIP = true
    if (self && self.src && !window.DV_ADDONS_SKIP && !window.__dvAddonsLoaded && !document.querySelector('script[src*="dv-addons.js"]')) {
      var a = document.createElement('script');
      a.src = self.src.replace(/product-ui\/dv-product-ui\.js(\?.*)?$/, 'addons/src/dv-addons.js');
      (document.body || document.head).appendChild(a);
    }

    // только после разбора страницы: данные товара (var product) Tilda кладёт ниже разметки,
    // а скрипт может стоять в HEAD
    function start() {
      run();
      // карточка дорисовывается Tilda асинхронно
      var tries = 0, t = setInterval(function () { run(); if (++tries > 20) clearInterval(t); }, 300);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }

  // Плашка «Как выглядят размеры» с фото на весь экран. Фото — из характеристики товара «Size guide» (ссылка на картинку);
  // нет характеристики — нет плашки. Переопределить: window.DV_SIZE_GUIDE = {...} (img — одна картинка на все товары), отключить: false
  var GUIDE = window.DV_SIZE_GUIDE !== undefined ? window.DV_SIZE_GUIDE : {
    title: 'How the sizes look',
    text: 'Bouquets and boxes side by side — tap to enlarge',
    img: ''
  };
  var GUIDE_CHARC = /size\s*guide|как выглядят размеры/i;

  // Картинки опции оформления — одни на все товары (на en-сайте значения bouquet / box / basket).
  // Переопределить: window.DV_DESIGN_IMAGES = { 'bouquet': 'https://...' }
  var DESIGN_OPT = /оформление|design|packaging/i;
  // Фото лежат в репозитории (product-ui/img/). Нет фото у значения — пустая плашка того же размера.
  var DESIGN_IMAGES = window.DV_DESIGN_IMAGES || {
    'bouquet': IMG + 'bouquet.jpg',
    'box': IMG + 'box.jpg',
    'basket': IMG + 'basket.jpg',
    'букет': IMG + 'bouquet.jpg',
    'коробка': IMG + 'box.jpg',
    'корзина': IMG + 'basket.jpg'
  };

  // Русские названия опций → английские (только подпись на странице; в корзине Tilda остаётся название из каталога)
  var OPT_NAMES = window.DV_OPTION_NAMES || { 'оформление': 'Style', 'размер': 'Size', 'цвет': 'Color' };

  // Данные товара (варианты с ценами, характеристики) Tilda кладёт в код страницы товара: var product = {...};
  function productData() {
    // ищем скрипт, где строка — настоящие данные (во встроенной версии она есть и в нашем собственном коде)
    var scripts = document.scripts;
    for (var i = 0; i < scripts.length; i++) {
      var m = scripts[i].textContent.match(/var product = (\{[\s\S]*?\});\s*\n/);
      if (!m) continue;
      try { return JSON.parse(m[1]); } catch (e) { /* не JSON — ищем дальше */ }
    }
    return null;
  }

  // Два вида блока Tilda: новый каталог (t-catalog__) и старый магазин (t-store__), разметка одинаковая.
  // Работаем только в колонке самого товара: ниже бывают «похожие товары» со своими опциями.
  function init(box) {
    var root = box.querySelector('.t-catalog__prod-popup__info, .t-store__prod-popup__info');
    if (!root || root.dataset.dvUi || !root.querySelector('.js-product-edition-option')) return;
    root.dataset.dvUi = '1';

    var name = root.querySelector('.js-product-name');
    if (name) name.textContent = name.textContent.replace(/\s*\(\s*\)\s*$/, '');

    var data = productData() || {};
    var editions = data.editions || [];
    var cur = root.querySelector('.t-catalog__prod-popup__price-currency, .t-store__prod-popup__price-currency');
    cur = cur ? cur.textContent.trim() : 'AED';

    // Опции: размер — в 3 строки; выбранное значение подписываем только у цвета (у кружков нет текста)
    root.querySelectorAll('.js-product-edition-option').forEach(function (opt) {
      var title = opt.querySelector('.js-product-edition-option-name');
      // на en-сайте у части товаров опции названы по-русски — показываем английское название
      if (title && OPT_NAMES[title.textContent.trim().toLowerCase()]) title.textContent = OPT_NAMES[title.textContent.trim().toLowerCase()];
      var isSize = /размер|size/i.test(opt.dataset.editionOptionId || '');
      if (isSize) {
        opt.classList.add('dv-size');
        sizePrices(root, opt, editions, cur);
      }
      // картинки — у любой опции оформления, в т. ч. названной Style (по значениям box / bouquet / basket)
      if (isDesignOpt(opt)) designImages(opt);
      if (!opt.querySelector('.t-product__option-variants_color')) return;
      var val = document.createElement('span');
      val.className = 'dv-opt-value';
      title.appendChild(val);
      var sync = function () {
        var a = opt.querySelector('.t-product__option-item_active input');
        val.textContent = a ? a.value : '';
      };
      opt.addEventListener('change', function () { setTimeout(sync, 0); });
      opt.addEventListener('click', function () { setTimeout(sync, 0); });
      sync();
    });

    designFirst(root, editions);

    // Преимущества под кнопкой
    var btns =root.querySelector('.t-catalog__prod-popup__btn-wrapper, .t-store__prod-popup__btn-wrapper');
    if (btns) {
      var p = document.createElement('div');
      p.className = 'dv-perks';
      p.innerHTML = PERKS.map(function (x) {
        return '<div class="dv-perk"><svg viewBox="0 0 24 24">' + x[1] + '</svg>' + x[0] + '</div>';
      }).join('');
      btns.insertAdjacentElement('afterend', p);
    }

    buildGuide(root, guideImg(root, data));

    // Полку допов (её рисует addons в конце колонки, позже нас) ставим после опций, перед количеством/кнопкой
    if (btns) {
      var placeShelf = function () {
        var shelf = root.querySelector('.dv-shelf_product');
        if (shelf && shelf.nextElementSibling !== btns) btns.parentNode.insertBefore(shelf, btns);
      };
      new MutationObserver(placeShelf).observe(root, { childList: true });
      placeShelf();
    }
  }

  // Кнопки размера: буква, кол-во штук (если есть в названии варианта: «S — 25 pcs») и цена варианта из Tilda.
  // Цена берётся с учётом остальных выбранных опций (если цена зависит, например, от цвета) и обновляется при их смене.
  function sizePrices(root, opt, editions, cur) {
    var key = opt.dataset.editionOptionId;
    function price(size) {
      var other = {};
      root.querySelectorAll('.js-product-edition-option').forEach(function (o) {
        var a = o.querySelector('.t-product__option-item_active input');
        if (o !== opt && a) other[o.dataset.editionOptionId] = a.value;
      });
      var list = editions.filter(function (e) { return e[key] === size; });
      var e = list.find(function (e) {
        return Object.keys(other).every(function (k) { return e[k] === other[k]; });
      }) || list[0];
      return e && e.price ? e.price.replace(/[.,]00$/, '') : '';
    }
    function render() {
      opt.querySelectorAll('.t-product__option-item_buttons').forEach(function (it) {
        var input = it.querySelector('input'), t = it.querySelector('.t-product__option-title_buttons');
        if (!input || !t) return;
        var v = input.value, m = v.match(/^\s*(\S+)\s*[—–-]\s*(.+)$/), p = price(v);
        t.innerHTML = '<b>' + (m ? m[1] : v) + '</b>' + (m ? m[2] : '') + (p ? '<i>' + p + ' ' + cur + '</i>' : '');
      });
    }
    render();
    root.addEventListener('change', function () { setTimeout(render, 0); });
  }

  // Высота всех фото оформления — по самой низкой: пропорция (ширина / высота) самой «широкой» картинки
  function equalHeights(opt) {
    var imgs = [].slice.call(opt.querySelectorAll('img.dv-optimg'));
    function apply() {
      var ratios = imgs.filter(function (i) { return i.naturalWidth && i.naturalHeight; })
        .map(function (i) { return i.naturalWidth / i.naturalHeight; });
      if (ratios.length) opt.style.setProperty('--dv-optimg-ratio', String(Math.max.apply(null, ratios)));
    }
    // lazy-картинка может считаться complete ещё до загрузки — слушаем load у всех
    imgs.forEach(function (i) { i.addEventListener('load', apply); });
    apply();
  }

  // Оформление (box / bouquet / basket) — главная опция: всегда кликабельна, а у размера, цвета и т. п.
  // показываются только значения, которые есть в выбранном оформлении. Если текущего размера в новом
  // оформлении нет — сначала переключаем на ближайший доступный, потом выбираем оформление.
  var DESIGN_VALUES = /^(bouquet|box|basket|букет|коробка|корзина)$/i;
  function isDesignOpt(opt) {
    if (DESIGN_OPT.test(opt.dataset.editionOptionId || '')) return true;
    var inputs = opt.querySelectorAll('input[type="radio"]');
    return inputs.length > 0 && [].every.call(inputs, function (i) { return DESIGN_VALUES.test(i.value.trim()); });
  }

  function designFirst(root, editions) {
    var opts = [].slice.call(root.querySelectorAll('.js-product-edition-option'));
    var design = opts.filter(isDesignOpt)[0];
    if (!design || !editions.length) return;
    design.classList.add('dv-design');
    var dKey = design.dataset.editionOptionId;
    var others = opts.filter(function (o) { return o !== design; });
    var busy = false;

    function labels(opt) { return [].slice.call(opt.querySelectorAll('label.t-product__option-item')); }
    function labelOf(opt, v) { return labels(opt).filter(function (l) { var i = l.querySelector('input'); return i && i.value === v; })[0]; }
    function current(opt) {
      var a = opt.querySelector('.t-product__option-item_active input') || opt.querySelector('input:checked');
      return a ? a.value : null;
    }
    // варианты товара с этим оформлением
    function withDesign(d) { return editions.filter(function (e) { return e[dKey] === d; }); }

    function filter() {
      var list = withDesign(current(design));
      others.forEach(function (o) {
        var k = o.dataset.editionOptionId;
        labels(o).forEach(function (l) {
          var i = l.querySelector('input');
          var ok = !i || list.some(function (e) { return e[k] === i.value; });
          l.classList.toggle('dv-opt-hidden', !ok);
        });
      });
    }

    // лучший вариант в новом оформлении: совпадает с текущим выбором по максимуму опций,
    // при равенстве — ближайший по порядку кнопок размер
    function pick(d) {
      var size = others.filter(function (o) { return o.classList.contains('dv-size'); })[0];
      var sizeOrder = size ? labels(size).map(function (l) { return l.querySelector('input').value; }) : [];
      var curSize = size ? sizeOrder.indexOf(current(size)) : -1;
      var best = null, bestScore = -1e9;
      withDesign(d).forEach(function (e) {
        var score = 0;
        others.forEach(function (o) { if (e[o.dataset.editionOptionId] === current(o)) score += 1000; });
        if (size && curSize > -1) score -= Math.abs(sizeOrder.indexOf(e[size.dataset.editionOptionId]) - curSize);
        if (score > bestScore) { bestScore = score; best = e; }
      });
      return best;
    }

    design.addEventListener('click', function (ev) {
      if (busy) return;
      var l = ev.target.closest('label.t-product__option-item');
      var input = l && l.querySelector('input');
      if (!input || input.value === current(design)) return;
      var target = pick(input.value);
      if (!target) return;
      ev.preventDefault();
      ev.stopPropagation();
      busy = true;
      // сначала размер/цвет, которых нет в новом оформлении (иначе Tilda не даст его выбрать), потом само оформление
      others.forEach(function (o) {
        var v = target[o.dataset.editionOptionId];
        if (v != null && v !== current(o)) { var ol = labelOf(o, v); if (ol) ol.click(); }
      });
      busy = false;
      // клик по той же кнопке внутри её же клика браузер игнорирует — выбираем оформление следующим тактом
      setTimeout(function () {
        busy = true;
        l.click();
        busy = false;
        setTimeout(filter, 0);
      }, 30);
    }, true);

    root.addEventListener('change', function () { setTimeout(filter, 0); });
    filter();
  }

  // Картинки в кнопках «Оформления» (если их ещё не поставил скрипт option-images)
  function designImages(opt) {
    var used = false;
    opt.querySelectorAll('label.t-product__option-item').forEach(function (label) {
      if (label.querySelector('.dv-optimg')) { used = true; return; }
      var input = label.querySelector('input'), title = label.querySelector('.t-product__option-title');
      var url = input && DESIGN_IMAGES[input.value.trim().toLowerCase()];
      var img;
      if (url) {
        img = document.createElement('img');
        img.src = url;
        img.alt = input.value;
        img.loading = 'lazy';
        used = true;
      } else {
        // пустая плашка, чтобы кнопки без фото были той же высоты
        img = document.createElement('span');
        img.className = 'dv-optimg dv-optimg_empty';
      }
      img.className = img.className || 'dv-optimg';
      label.insertBefore(img, title || null);
      label.setAttribute('data-dv-optimg', '1');
    });
    // ни одного фото — оставляем обычные кнопки без плашек
    if (used) { opt.classList.add('dv-optimg-on'); equalHeights(opt); }
    else opt.querySelectorAll('.dv-optimg_empty').forEach(function (e) { e.remove(); });
  }

  // Картинка для плашки: из характеристики товара «Size guide»; саму характеристику на странице прячем
  function guideImg(root, data) {
    if (GUIDE && GUIDE.img) return GUIDE.img;
    var c = (data.characteristics || []).find(function (x) { return GUIDE_CHARC.test(x.title || ''); });
    var url = c && (c.value || '').trim();
    // сами характеристики на странице скрыты в CSS (.js-store-prod-charcs)
    return /^https?:\/\//i.test(url || '') ? url : '';
  }

  function buildGuide(root, img) {
    // сразу под кнопками размера
    var anchor = root.querySelector('.dv-size');
    if (!GUIDE || !img || !anchor) return;
    // блок только если по ссылке действительно картинка: битая ссылка — блока нет
    var probe = new Image();
    probe.onload = function () { if (!root.querySelector('.dv-guide')) insertGuide(anchor, img); };
    probe.src = img;
  }

  function insertGuide(anchor, img) {
    var g = document.createElement('button');
    g.type = 'button';
    g.className = 'dv-guide';
    g.innerHTML = '<img src="' + img + '" alt="" loading="lazy">' +
      '<span class="dv-guide__txt"><b>' + GUIDE.title + '</b>' + GUIDE.text + '</span>' +
      '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    g.addEventListener('click', function () { openZoom(img); });
    anchor.insertAdjacentElement('afterend', g);
  }

  function openZoom(img) {
    var z = document.createElement('div');
    z.className = 'dv-zoom';
    z.innerHTML = '<img src="' + img + '" alt="' + GUIDE.title + '"><button type="button" aria-label="Close">&times;</button>';
    var close = function () {
      z.remove();
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    z.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(z);
  }

  function run() { document.querySelectorAll('.t-catalog__prod-snippet__container, .t-store__prod-snippet__container').forEach(init); }

  // Подключается в Tilda прямой ссылкой на конкретный тег (…/dejavu-tilda@0.1.42/product-ui/dv-product-ui.js):
  // без загрузчика и сверки версий. Новая версия на сайте = новый тег + смена номера в ссылке в Tilda.
  boot();
})();
