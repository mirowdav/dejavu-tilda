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
      porCart();
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

  // Фиксированный набор размеров у каждого оформления. Размеры, которых нет в Tilda, дорисовываются
  // с «Price on request» и кладутся в корзину без цены (артикул POR-…); размеры вне набора остаются.
  var SIZE_SETS = window.DV_SIZE_SETS || {
    'basket': ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    'bouquet': ['S', 'M', 'L'],
    'box': ['S', 'M', 'L', 'XL']
  };
  SIZE_SETS['корзина'] = SIZE_SETS['корзина'] || SIZE_SETS.basket;
  SIZE_SETS['букет'] = SIZE_SETS['букет'] || SIZE_SETS.bouquet;
  SIZE_SETS['коробка'] = SIZE_SETS['коробка'] || SIZE_SETS.box;
  var SIZE_RANK = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];
  var POR = { button: 'On request', price: 'Price on request', option: 'Price', variant: 'on request', sku: 'POR-' };
  // способы оплаты, которые прячем, если в корзине есть позиция «по запросу»
  var POR_BLOCK_PAY = window.DV_POR_BLOCK_PAY || ['stripe'];

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
    porSizes(root, data, editions);

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

    // после «В корзину» сразу открываем предпросмотр корзины (боковая панель; на телефоне Tilda — страница корзины),
    // только если товар действительно добавился (Tilda могла не добавить: не выбрана опция, нет в наличии)
    if (btns) {
      btns.addEventListener('click', function (ev) {
        if (!ev.target.closest('.t-catalog__prod-popup__btn, .t-store__prod-popup__btn, [href="#order"]')) return;
        var before = cartCount();
        setTimeout(function () {
          var shown = /t706__body_cart(sidebar|page|win)showed/.test(document.body.className);
          if (!shown && cartCount() > before && typeof window.tcart__openCart === 'function') window.tcart__openCart();
        }, 300);
      });
    }

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
        t.innerHTML = '<b>' + (m ? m[1] : v) + '</b>' + (m ? m[2] : '') + (p ? '<i>' + p.replace(/\s/g, ' ') + ' ' + cur + '</i>' : '');
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
      // близость размеров — по букве (S, M, L…): у разных оформлений значения разные («S — 11 pcs» / «S — 25 pcs»)
      var sizeOrder = size ? labels(size).map(function (l) { return l.querySelector('input').value; }) : [];
      var rank = function (v) { return sizeRank(sizeLetter(v), sizeOrder.indexOf(v)); };
      var curSize = size && current(size) ? rank(current(size)) : -1;
      // выбран дорисованный размер «по запросу» — ближайший ищем к нему
      var por = root.dataset.dvPorSize;
      if (size && por) curSize = sizeRank(por, 0);
      var best = null, bestScore = -1e9;
      withDesign(d).forEach(function (e) {
        var score = 0;
        others.forEach(function (o) {
          if (por && o === size) return;
          if (e[o.dataset.editionOptionId] === current(o)) score += 1000;
        });
        if (size && curSize > -1) score -= Math.abs(rank(e[size.dataset.editionOptionId]) - curSize);
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

  // Фиксированные наборы: у цветочного товара всегда три оформления (STYLES), у каждого — свой набор
  // размеров (SIZE_SETS). Что заведено в Tilda — остаётся как есть; чего нет — дорисовываем «On request».
  // Tilda про дорисованное не знает: её выбор варианта не меняется, а «В корзину» кладёт позицию без цены
  // (артикул POR-…, опция Price: on request) через tcart__addProduct. Допы (раздел Add-ons) не трогаем.
  var STYLES = ['bouquet', 'box', 'basket'];
  var STYLE_ALIAS = { 'букет': 'bouquet', 'коробка': 'box', 'корзина': 'basket' };
  // у товара без опции оформления его варианты из Tilda считаем этим оформлением
  var DEFAULT_STYLE = window.DV_DEFAULT_STYLE || 'bouquet';
  var ADDON_PART = '722035005904';
  function styleKey(v) { v = String(v || '').trim().toLowerCase(); return STYLE_ALIAS[v] || v; }
  function sizeLetter(v) { return String(v || '').trim().split(/\s+/)[0].toUpperCase(); }
  function sizeRank(letter, fallback) { var i = SIZE_RANK.indexOf(letter); return i > -1 ? i : 50 + fallback; }
  function optName(key) { return OPT_NAMES[String(key).toLowerCase()] || key; }
  function isAddonProduct(data, editions) {
    return (data.partuids || []).map(String).indexOf(ADDON_PART) > -1 ||
      editions.some(function (e) { return /^DOP-/.test(e.sku || ''); });
  }
  function nearestLetter(set, letter) {
    var r = sizeRank(letter, 0), best = set[0];
    set.forEach(function (l) { if (Math.abs(sizeRank(l, 0) - r) < Math.abs(sizeRank(best, 0) - r)) best = l; });
    return best;
  }

  // своя опция «Style» для товара, у которого её нет в Tilda (разметка — как у опций Tilda, но без js-классов)
  function buildStyleOpt(size, opts) {
    var o = document.createElement('div');
    o.className = 't-product__option dv-design dv-style-fake';
    var title = size.querySelector('.js-product-edition-option-name');
    var t = document.createElement('div');
    t.className = title ? title.className.replace('js-product-edition-option-name', '').trim() : 't-product__option-title';
    t.textContent = 'Style';
    var f = size.querySelector('.t-product__option-variants_buttons').cloneNode(false);
    o.appendChild(t);
    o.appendChild(f);
    var last = opts[opts.length - 1];
    last.parentNode.insertBefore(o, last.nextSibling);
    return o;
  }

  function fakeItem(template, html) {
    var el = template.cloneNode(true);
    el.querySelectorAll('input, .dv-optimg').forEach(function (x) { x.remove(); });
    // без класса t-product__option-item — обработчики Tilda и наш designFirst её не видят
    el.className = 't-product__option-item_buttons t-product__option-item_simple dv-por-item';
    el.removeAttribute('style');
    el.removeAttribute('data-dv-optimg');
    var t = el.querySelector('.t-product__option-title_buttons') || el.querySelector('.t-product__option-title') || el;
    t.innerHTML = html;
    return el;
  }

  function porSizes(root, data, editions) {
    var opts = [].slice.call(root.querySelectorAll('.js-product-edition-option'));
    var size = root.querySelector('.dv-size');
    var form = size && size.querySelector('.t-product__option-variants_buttons');
    if (!form || isAddonProduct(data, editions)) return;
    var real = [].slice.call(form.querySelectorAll('label.t-product__option-item'));
    if (!real.length) return;
    var design = opts.filter(isDesignOpt)[0];
    var dOpt = design || buildStyleOpt(size, opts);
    var dForm = dOpt.querySelector('.t-product__option-variants_buttons');
    if (!dForm) return;
    var dReal = design ? [].slice.call(dForm.querySelectorAll('label.t-product__option-item')) : [];
    var fake = {}, styleItems = {}, picked = null, fakeStyle = null, cur = null, curStyle = null;

    function current(opt) {
      var a = opt.querySelector('.t-product__option-item_active input') || opt.querySelector('input:checked');
      return a ? a.value : null;
    }
    function realStyle() { return design ? styleKey(current(design)) : DEFAULT_STYLE; }
    function visibleReal(letter) {
      if (fakeStyle) return null;
      return real.filter(function (l) {
        var i = l.querySelector('input');
        return i && sizeLetter(i.value) === letter && !l.classList.contains('dv-opt-hidden');
      })[0];
    }
    function makeFake(letter) {
      var el = fakeItem(real[0], '<b>' + letter + '</b><i>' + POR.button + '</i>');
      el.addEventListener('click', function (ev) { ev.preventDefault(); picked = letter; update(); });
      form.appendChild(el);
      return el;
    }

    // кнопки оформлений, которых нет в Tilda (у товара без опции — все три, «родное» — DEFAULT_STYLE)
    var have = dReal.map(function (l) { return styleKey(l.querySelector('input').value); });
    STYLES.forEach(function (s) {
      if (have.indexOf(s) > -1) return;
      var el = fakeItem(dReal[0] || real[0], s);
      var url = DESIGN_IMAGES[s];
      var img = document.createElement(url ? 'img' : 'span');
      if (url) { img.src = url; img.alt = s; img.loading = 'lazy'; img.className = 'dv-optimg'; }
      else img.className = 'dv-optimg dv-optimg_empty';
      el.insertBefore(img, el.firstChild);
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        var keep = picked || (current(size) ? sizeLetter(current(size)) : null);
        fakeStyle = (!design && s === DEFAULT_STYLE) ? null : s;
        if (fakeStyle) picked = keep;
        update();
      });
      dForm.appendChild(el);
      styleItems[s] = el;
    });
    dOpt.classList.add('dv-optimg-on');
    equalHeights(dOpt);

    function update() {
      var st = fakeStyle || realStyle();
      var set = SIZE_SETS[st] || [];
      real.forEach(function (l) { l.classList.toggle('dv-por-hide', !!fakeStyle); });
      if (fakeStyle) {
        // у дорисованного оформления все размеры «по запросу»
        if (!picked || set.indexOf(picked) === -1) picked = set.length ? nearestLetter(set, picked || 'M') : null;
      } else {
        if (picked && set.indexOf(picked) === -1) picked = null;
        var rl = picked && visibleReal(picked);
        if (rl) {
          picked = null;
          if (!rl.classList.contains('t-product__option-item_active')) setTimeout(function () { rl.click(); }, 0);
        }
      }
      Object.keys(fake).forEach(function (k) { fake[k].classList.add('dv-opt-hidden'); });
      set.forEach(function (letter) {
        if (visibleReal(letter)) return;
        var f = fake[letter] || (fake[letter] = makeFake(letter));
        f.classList.remove('dv-opt-hidden');
      });
      // порядок: размеры S → XXXL, оформления bouquet / box / basket
      real.forEach(function (l, i) { l.style.order = sizeRank(sizeLetter(l.querySelector('input').value), i); });
      Object.keys(fake).forEach(function (k) {
        fake[k].style.order = sizeRank(k, 0);
        fake[k].classList.toggle('dv-por-active', k === picked);
      });
      dReal.forEach(function (l, i) {
        var k = STYLES.indexOf(styleKey(l.querySelector('input').value));
        l.style.order = k > -1 ? k : 10 + i;
      });
      Object.keys(styleItems).forEach(function (s) {
        styleItems[s].style.order = STYLES.indexOf(s);
        styleItems[s].classList.toggle('dv-por-active', s === st);
      });
      root.classList.toggle('dv-por-style', !!fakeStyle);
      root.classList.toggle('dv-por-on', !!picked);
      root.dataset.dvPorSize = picked || '';
      cur = picked;
      curStyle = st;
    }

    // цена «Price on request» вместо цены варианта
    var priceBox = root.querySelector('.t-catalog__prod-popup__price, .t-store__prod-popup__price');
    if (priceBox && !priceBox.querySelector('.dv-por-price')) {
      var pp = document.createElement('span');
      pp.className = 'dv-por-price';
      pp.textContent = POR.price;
      priceBox.appendChild(pp);
    }

    // клик по настоящему размеру снимает дорисованный, по настоящему оформлению — дорисованное оформление
    form.addEventListener('click', function (ev) {
      // при дорисованном оформлении настоящие размеры скрыты — их кликает только designFirst при смене оформления
      if (ev.target.closest('label.t-product__option-item') && picked && !fakeStyle) { picked = null; update(); }
    }, true);
    // на самой опции: designFirst слушает её же и останавливает всплытие дальше
    dOpt.addEventListener('click', function (ev) {
      if (ev.target.closest('label.t-product__option-item') && fakeStyle) {
        fakeStyle = null;
        // то же оформление, что выбрано в Tilda, — события change не будет
        setTimeout(update, 50);
      }
    }, true);
    root.addEventListener('change', function () { setTimeout(update, 0); });

    // «В корзину» при дорисованном размере — своя позиция без цены
    root.addEventListener('click', function (ev) {
      if (!cur) return;
      var btn = ev.target.closest('.t-catalog__prod-popup__btn, .t-store__prod-popup__btn, .js-store-prod-popup-buy-btn, [href="#order"]');
      if (!btn || !root.contains(btn)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      addPor(root, data, editions, opts, design, size, curStyle, cur);
    }, true);

    update();
  }

  function addPor(root, data, editions, opts, design, size, style, letter) {
    if (typeof window.tcart__addProduct !== 'function') return;
    var sel = {};
    opts.forEach(function (o) {
      var a = o.querySelector('.t-product__option-item_active input') || o.querySelector('input:checked');
      if (a) sel[o.dataset.editionOptionId] = a.value;
    });
    var dKey = design ? design.dataset.editionOptionId : null, sKey = size.dataset.editionOptionId;
    // фото — варианта с тем же цветом и оформлением; нет такого — с тем же цветом; иначе любое
    var withImg = editions.filter(function (e) { return e.img; });
    var match = function (skip) {
      return withImg.filter(function (e) {
        return Object.keys(sel).every(function (k) { return skip.indexOf(k) > -1 || e[k] === sel[k]; });
      })[0];
    };
    var best = match([sKey]) || match([sKey, dKey]) || withImg[0];
    if (dKey) sel[dKey] = style;
    sel[sKey] = letter;
    var name = root.querySelector('.js-product-name');
    var qtyInput = root.querySelector('input[class*="quantity-input"], .t-store__prod__quantity input, .t-catalog__prod__quantity input');
    var qty = Math.max(1, parseInt(qtyInput && qtyInput.value, 10) || 1);
    var options = opts.map(function (o) {
      var k = o.dataset.editionOptionId;
      return sel[k] != null ? { option: optName(k), variant: sel[k] } : null;
    }).filter(Boolean);
    if (!dKey) options.push({ option: 'Style', variant: style });
    options.push({ option: POR.option, variant: POR.variant });
    window.tcart__addProduct({
      name: name ? name.textContent.trim() : (data.title || ''),
      price: 0,
      quantity: qty,
      img: best ? best.img : '',
      sku: POR.sku + (data.uid || '') + '-' + style + '-' + letter,
      url: location.href.split('#')[0].split('?')[0],
      options: options
    });
    if (typeof window.tcart__openCart === 'function') window.tcart__openCart();
  }

  // Корзина (на всех страницах): у позиций «по запросу» вместо пустой цены — «Price on request»,
  // и пока они в корзине, Stripe скрыт и выбрана оплата наличными. Скрытие — через ту же проверку,
  // которой Tilda отключает способы оплаты для доставки (tcart__isPaymentUnavailable).
  function cartCount() {
    return ((window.tcart && window.tcart.products) || []).reduce(function (n, p) {
      return n + (p && p.deleted !== 'yes' ? (+p.quantity || 0) : 0);
    }, 0);
  }
  function isPor(p) { return !!p && p.deleted !== 'yes' && String(p.sku || '').indexOf(POR.sku) === 0; }
  function cartHasPor() { return ((window.tcart && window.tcart.products) || []).some(isPor); }

  function porCart() {
    if (window.__dvPorCart) return;
    window.__dvPorCart = true;
    var syncing = false, forced = false;

    function labelRows() {
      var products = (window.tcart && window.tcart.products) || [];
      document.querySelectorAll('.t706__product[data-cart-product-i]').forEach(function (row) {
        if (!isPor(products[+row.getAttribute('data-cart-product-i')])) return;
        row.classList.add('dv-por-row');
        row.querySelectorAll('.t706__product-amount').forEach(function (a) {
          if (a.textContent.trim() !== POR.price) a.textContent = POR.price;
        });
        // служебный артикул под названием не показываем
        row.querySelectorAll('.t706__product-title__option').forEach(function (o) {
          if (o.textContent.trim().indexOf(POR.sku) === 0) o.style.display = 'none';
        });
      });
    }
    function syncPay() {
      if (syncing || typeof window.tcart__syncPaymentMethodsForDelivery !== 'function') return;
      var blocked = document.querySelector('.t706 .t-radio__wrapper-payment input[data-payment-variant-system="' + POR_BLOCK_PAY[0] + '"]');
      if (!blocked) return;
      var por = cartHasPor();
      // пересчитываем, только если видимость не совпадает с тем, что нужно
      if (por === blocked.disabled) return;
      syncing = true;
      try {
        window.tcart__syncPaymentMethodsForDelivery();
        // позицию «по запросу» убрали — возвращаем выбор по умолчанию (Stripe), а не оставленные нами наличные
        if (!por && forced && !blocked.disabled && !blocked.checked) {
          blocked.click();
        }
        forced = por;
      } finally { syncing = false; }
    }
    function refresh() { labelRows(); syncPay(); }
    function wrap(name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig.__dvPor) return typeof orig === 'function';
      var w = function () { var r = orig.apply(this, arguments); try { refresh(); } catch (e) { /* корзина важнее */ } return r; };
      w.__dvPor = true;
      window[name] = w;
      return true;
    }

    var tries = 0;
    (function hook() {
      var orig = window.tcart__isPaymentUnavailable;
      if (typeof orig === 'function' && !orig.__dvPor) {
        var w = function (sys) {
          if (POR_BLOCK_PAY.indexOf(sys) > -1 && cartHasPor()) return true;
          return orig.apply(this, arguments);
        };
        w.__dvPor = true;
        window.tcart__isPaymentUnavailable = w;
      }
      var ok = typeof orig === 'function';
      ['tcart__reDrawProducts', 'tcart__reDrawTotal'].forEach(function (n) { ok = wrap(n) && ok; });
      if (ok) refresh();
      else if (++tries < 40) setTimeout(hook, 250);
    })();
    document.addEventListener('fullscreenCartOpened', function () { setTimeout(refresh, 0); });
  }

  // Картинки в кнопках «Оформления» (если их ещё не поставил скрипт option-images)
  function designImages(opt) {
    var used = false;
    opt.querySelectorAll('label.t-product__option-item').forEach(function (label, n) {
      // порядок всегда bouquet → box → basket, как бы ни были заведены варианты в Tilda
      var iv = label.querySelector('input');
      var k = iv ? STYLES.indexOf(styleKey(iv.value)) : -1;
      label.style.order = k > -1 ? k : 10 + n;
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
