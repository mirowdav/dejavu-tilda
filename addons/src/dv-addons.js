/*!
 * Dejavu Flowers — допы и допродажи для корзины Tilda (t706).
 *
 * Подключение в Tilda (T123, на всех страницах):
 *   <script src="https://cdn.jsdelivr.net/gh/mirowdav/dejavu-tilda@<tag>/addons/src/dv-addons.js" defer></script>
 *
 * Переопределить настройки можно до подключения скрипта:
 *   <script>window.DV_ADDONS_CONFIG = { dataUrl: 'https://.../addons.json' };</script>
 */
(function () {
  'use strict';

  if (window.__dvAddonsLoaded) return;
  window.__dvAddonsLoaded = true;

  var currentScript = document.currentScript;
  var BASE_URL = currentScript ? currentScript.src.replace(/src\/[^\/]*$/, '') : '';

  var CFG = Object.assign({
    // Допы — товары раздела каталога Tilda (en-сайт: раздел Add-ons). Пусто — берём файл dataUrl.
    tildaPart: '722035005904',
    tildaApi: 'https://store.tildaapi.com/api/getproductslist/',
    dataUrl: BASE_URL + 'data/addons.json',
    cssUrl: BASE_URL + 'src/dv-addons.css',
    // по префиксу артикула отличаем допы от основных товаров
    skuPrefix: 'DOP-',
    currency: 'AED',
    // показывать попап после добавления основного товара
    upsellPopup: false, // выключен по просьбе клиента (01.11.2026): допы и так в карточке и в корзине
    // полка «Complete your gift» в карточке товара; выключена 21.11.2026 — допы только в корзине
    productShelf: false,
    // подсказка размера под переключателем: { 'Size': { 'M — 51 pcs': '40 × 35 cm' } }
    variantHints: {},
    texts: {
      hint: 'Add balloons or sweets to your gift',
      shelfTitle: 'Complete your gift',
      cartTitle: 'Don’t forget to add',
      popupTitle: 'Added to cart. Complete your gift',
      toCheckout: 'Go to checkout',
      continueShopping: 'Continue shopping',
      view: 'View',
      toCart: 'Add to cart',
      inCart: 'In cart',
      from: 'from',
      soldOut: 'Sold out',
      digitsLabel: 'Digits',
      digitsPlaceholder: 'For example: 25',
      numberLabel: 'Number',
      digitLabel: 'Digit',
      digitOf: 'of',
      numbersField: 'Numbers',
      digitsRequired: 'Enter the digits',
      quantity: 'Quantity'
    }
  }, window.DV_ADDONS_CONFIG || {});
  CFG.texts = Object.assign({}, CFG.texts, (window.DV_ADDONS_CONFIG || {}).texts || {});

  var T = CFG.texts;
  // русские названия опций допов → английские (только подпись в окне допа)
  var OPT_NAMES = window.DV_OPTION_NAMES || { 'оформление': 'Style', 'размер': 'Size', 'цвет': 'Color' };
  var DATA = null;
  var SKU_MAP = {}; // артикул допа (и его вариантов) → id допа

  /* ---------- утилиты ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function formatPrice(n) {
    var v = Math.round(n * 100) / 100;
    return v.toLocaleString('ru-RU') + ' ' + CFG.currency;
  }

  function waitFor(check, cb, timeoutMs) {
    var started = Date.now();
    (function tick() {
      var v = check();
      if (v) return cb(v);
      if (Date.now() - started < (timeoutMs || 20000)) setTimeout(tick, 100);
    })();
  }

  function placeholderImg(color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3efe9"/>' +
      '<circle cx="50" cy="46" r="26" fill="' + (color || '#801124') + '" stroke="#00000022"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function cartProducts() {
    return (window.tcart && window.tcart.products) || [];
  }

  // у цифр к артикулу дописана метка номера: DOP-DIGITS-GOLD#k3f9/1/2
  function baseSku(sku) { return String(sku || '').split('#')[0]; }

  function addonIdBySku(sku) {
    var b = baseSku(sku);
    if (!b) return null;
    if (SKU_MAP[b]) return SKU_MAP[b];
    return b.indexOf(CFG.skuPrefix) === 0 ? b.slice(CFG.skuPrefix.length) : null;
  }

  function isAddonCartItem(p) {
    return !!(p && addonIdBySku(p.sku));
  }

  function inCartIds() {
    var ids = {};
    cartProducts().forEach(function (p) {
      var id = p && p.quantity > 0 && addonIdBySku(p.sku);
      if (id) ids[id] = true;
    });
    return ids;
  }

  function buildSkuMap() {
    SKU_MAP = {};
    DATA.products.forEach(function (pr) {
      SKU_MAP[CFG.skuPrefix + pr.id] = pr.id;
      if (pr.sku) SKU_MAP[pr.sku] = pr.id;
      (pr.editions || []).forEach(function (e) { if (e.sku) SKU_MAP[e.sku] = pr.id; });
    });
  }

  function cartSku(product, sel) {
    var e = editionFor(product, sel);
    return (e && e.sku) || product.sku || CFG.skuPrefix + product.id;
  }

  function isCartOpen() {
    var b = document.body.classList;
    return b.contains('t706__body_cartsidebarshowed') || b.contains('t706__body_cartpageshowed') || b.contains('t706__body_cartwinshowed');
  }

  /* ---------- данные из каталога Tilda ---------- */

  // API блока каталога Tilda; отвечает {redirectto: 'one'}, если проект живёт на другом домене API
  function fetchTildaPart(part) {
    function get(api) {
      return fetch(api + '?storepartuid=' + encodeURIComponent(part) + '&getoptions=true&slice=1&size=500')
        .then(function (r) { return r.json(); });
    }
    return get(CFG.tildaApi).then(function (d) {
      return d && d.redirectto ? get(CFG.tildaApi.replace(/tildaapi\.[a-z]+/, 'tildaapi.' + d.redirectto)) : d;
    });
  }

  function parseJson(s, def) {
    if (s && typeof s === 'object') return s;
    try { return s ? JSON.parse(s) : def; } catch (e) { return def; }
  }

  function qtyOf(q) { return q === '' || q == null ? null : +q; }

  // пока в Tilda у опции цвета не заданы цвета — красим кружки по названию
  var NAMED_COLORS = {
    red: '#c8102e', pink: '#f4a6c0', white: '#ffffff', gold: '#d4af37', silver: '#c0c0c0',
    'rose gold': '#e8b4a0', 'light blue': '#8ecae6', blue: '#8ecae6', black: '#111111', green: '#7a9e7e'
  };

  // Товар Tilda → модель допа. Цена, остаток, артикул и фото — у варианта (edition);
  // характеристики Type: digits / Max digits — шары-цифры с полем ввода.
  function fromTilda(resp) {
    var colors = {};
    (resp.options || []).forEach(function (o) {
      (o.values || []).forEach(function (v) { if (v.color) colors[o.title + '|' + v.value] = v.color; });
    });
    var products = (resp.products || []).map(function (p) {
      var charcs = {};
      (p.characteristics || []).forEach(function (c) { charcs[String(c.title).trim().toLowerCase()] = String(c.value).trim(); });
      var gallery = parseJson(p.gallery, []);
      var opts = parseJson(p.json_options, []).map(function (o) {
        var isColor = !!(o.params && o.params.hasColor);
        return {
          title: o.title,
          type: isColor ? 'color' : undefined,
          values: (o.values || []).map(function (v) { return { name: v, color: isColor ? colors[o.title + '|' + v] || NAMED_COLORS[String(v).toLowerCase()] || null : undefined }; })
        };
      });
      var product = {
        id: p.externalid || String(p.uid),
        uid: String(p.uid),
        title: p.title,
        // описание из карточки товара в Tilda: краткое, если нет — полное (HTML как в Tilda)
        descr: String(p.descr || p.text || '').trim(),
        price: parseFloat(p.price) || 0,
        img: gallery[0] && gallery[0].img,
        sku: p.sku || '',
        options: opts,
        stock: opts.length ? undefined : qtyOf(p.quantity)
      };
      if (opts.length) {
        product.editions = (p.editions || []).map(function (e) {
          var vals = {};
          opts.forEach(function (o) { vals[o.title] = e[o.title]; });
          return { uid: String(e.uid), vals: vals, price: parseFloat(e.price) || 0, qty: qtyOf(e.quantity), sku: e.sku || '', img: e.img || '' };
        });
      }
      if (charcs.type === 'digits') {
        product.type = 'digits';
        product.maxDigits = parseInt(charcs['max digits'], 10) || 4;
      }
      return product;
    });
    return { groups: [], products: products };
  }

  function loadData() {
    if (CFG.tildaPart) return fetchTildaPart(CFG.tildaPart).then(fromTilda);
    return fetch(CFG.dataUrl, { cache: 'no-cache' }).then(function (r) { return r.json(); });
  }

  /* ---------- модель товара-допа ---------- */

  // вариант Tilda для выбранных значений (null — такой комбинации нет)
  function editionFor(product, sel) {
    if (!product.editions) return null;
    var opts = product.options || [];
    for (var i = 0; i < product.editions.length; i++) {
      var e = product.editions[i];
      if (opts.every(function (o, k) { return e.vals[o.title] === o.values[sel[k]].name; })) return e;
    }
    return null;
  }

  function defaultSelection(product) {
    var sel = (product.options || []).map(function () { return 0; });
    // первая доступная комбинация
    for (var i = 0; i < sel.length; i++) {
      for (var v = 0; v < product.options[i].values.length; v++) {
        var probe = sel.slice(); probe[i] = v;
        if (stockFor(product, probe) !== 0) { sel[i] = v; break; }
      }
    }
    return sel;
  }

  function variantKey(product, sel) {
    return (product.options || []).map(function (o, i) { return o.values[sel[i]].name; }).join(' / ');
  }

  // null = остаток не ведётся
  function stockFor(product, sel) {
    if (product.editions) {
      var e = editionFor(product, sel);
      return e ? e.qty : 0;
    }
    if (product.stock == null) return null;
    if (typeof product.stock === 'number') return product.stock;
    var key = variantKey(product, sel);
    return Object.prototype.hasOwnProperty.call(product.stock, key) ? product.stock[key] : null;
  }

  // цена одной штуки (у шаров-цифр — одной цифры)
  function itemPrice(product, sel) {
    if (product.editions) {
      var e = editionFor(product, sel);
      return e ? e.price : product.price || 0;
    }
    var price = product.price || 0;
    (product.options || []).forEach(function (o, i) {
      var v = o.values[sel[i]];
      if (v.price != null) price = v.price;
      if (v.add != null) price += v.add;
    });
    return price;
  }

  function unitPrice(product, sel, digits) {
    var price = itemPrice(product, sel);
    if (product.type === 'digits') price *= Math.max(1, (digits || '').length);
    return price;
  }

  function productImg(product, sel) {
    var img = product.img, color = null;
    var ed = sel && editionFor(product, sel);
    if (ed && ed.img) img = ed.img;
    (product.options || []).forEach(function (o, i) {
      var v = o.values[sel ? sel[i] : 0];
      if (v.img) img = v.img;
      if (v.color && !color) color = v.color;
    });
    // относительный путь (img/heart.jpg) — от папки модуля, чтобы фото ехали тем же тегом
    if (img && !/^(https?:|data:|\/\/)/.test(img)) img = BASE_URL + img;
    return img || placeholderImg(color);
  }

  function minPrice(product) {
    if (product.editions && product.editions.length) {
      return Math.min.apply(null, product.editions.map(function (e) { return e.price; }));
    }
    var prices = [product.price || 0];
    (product.options || []).forEach(function (o) {
      o.values.forEach(function (v) { if (v.price != null) prices.push(v.price); });
    });
    return Math.min.apply(null, prices);
  }

  function hasChoice(product) {
    return product.type === 'digits' || (product.options || []).some(function (o) { return o.values.length > 1; });
  }

  function addToCart(product, sel, qty, digits) {
    var options = (product.options || []).map(function (o, i) {
      return { option: o.title, variant: o.values[sel[i]].name };
    });
    var stock = stockFor(product, sel);
    var items;

    if (product.type === 'digits') {
      // каждая цифра — отдельная строка; строки одного номера связаны меткой в артикуле,
      // в опциях — весь номер и позиция цифры (иначе Tilda склеит одинаковые цифры, как в «11»)
      var group = Math.random().toString(36).slice(2, 7);
      items = digits.split('').map(function (d, i) {
        return {
          name: product.title + ' «' + d + '»',
          price: itemPrice(product, sel),
          quantity: 1,
          img: productImg(product, sel),
          sku: cartSku(product, sel) + '#' + group + '/' + (i + 1) + '/' + digits.length,
          options: [
            { option: T.numberLabel, variant: digits },
            { option: T.digitLabel, variant: (i + 1) + ' ' + T.digitOf + ' ' + digits.length }
          ].concat(options)
        };
      });
    } else {
      var item = {
        name: product.title,
        price: unitPrice(product, sel, digits),
        quantity: qty,
        img: productImg(product, sel),
        sku: cartSku(product, sel)
      };
      if (options.length) item.options = options;
      if (stock != null) item.inv = stock;
      items = [item];
    }

    items.forEach(function (it) { window.tcart__addProduct(it); });
    // tcart__addProduct сам не перерисовывает открытую корзину
    if (isCartOpen()) {
      if (typeof window.tcart__reDrawProducts === 'function') window.tcart__reDrawProducts();
      if (typeof window.tcart__reDrawTotal === 'function') window.tcart__reDrawTotal();
    }
    refreshMarks();
  }

  /* ---------- полка допов ---------- */

  // все допы одной сеткой; группы в данных задают только порядок карточек
  function sortedProducts() {
    var order = {};
    (DATA.groups || []).forEach(function (g, i) { order[g.id] = i; });
    return DATA.products.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      var ga = order[a.p.group] != null ? order[a.p.group] : 1e9;
      var gb = order[b.p.group] != null ? order[b.p.group] : 1e9;
      return ga - gb || a.i - b.i;
    }).map(function (x) { return x.p; });
  }

  function renderShelf(title, mod) {
    var root = el(
      '<div class="dv-shelf ' + (mod ? 'dv-shelf_' + mod : '') + '">' +
        (title ? '<div class="dv-shelf__title">' + esc(title) + '</div>' : '') +
        '<div class="dv-shelf__list">' + sortedProducts().map(function (p) {
          return '<div class="dv-card" data-id="' + esc(p.id) + '">' +
              '<div class="dv-card__img" style="background-image:url(\'' + productImg(p, defaultSelection(p)) + '\')"></div>' +
              '<div class="dv-card__badge">' + esc(T.inCart) + '</div>' +
              '<div class="dv-card__title">' + esc(p.title) + '</div>' +
              '<div class="dv-card__price">' + (hasChoice(p) ? T.from + ' ' : '') + formatPrice(minPrice(p)) + '</div>' +
              '<button type="button" class="dv-btn dv-btn_sm dv-card__btn">' + esc(T.view) + '</button>' +
            '</div>';
        }).join('') + '</div>' +
      '</div>'
    );

    root.addEventListener('click', function (e) {
      var card = e.target.closest('.dv-card');
      if (!card) return;
      var product = findProduct(card.getAttribute('data-id'));
      // всегда открываем окно товара, даже без параметров: в корзину кладут оттуда
      if (product) openPicker(product);
    });

    return root;
  }

  function findProduct(id) {
    for (var i = 0; i < DATA.products.length; i++) if (DATA.products[i].id === id) return DATA.products[i];
    return null;
  }

  function refreshMarks() {
    var ids = inCartIds();
    document.querySelectorAll('.dv-card').forEach(function (card) {
      card.classList.toggle('dv-card_incart', !!ids[card.getAttribute('data-id')]);
    });
  }

  /* ---------- модалки ---------- */

  function openModal(content, mod) {
    var overlay = el('<div class="dv-modal ' + (mod ? 'dv-modal_' + mod : '') + '"><div class="dv-modal__box">' +
      '<button type="button" class="dv-modal__close" aria-label="Close">×</button></div></div>');
    overlay.querySelector('.dv-modal__box').appendChild(content);
    function close() {
      overlay.remove();
      document.removeEventListener('keyup', onKey);
      if (!document.querySelector('.dv-modal')) document.documentElement.classList.remove('dv-noscroll');
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('.dv-modal__close')) close();
    });
    document.addEventListener('keyup', onKey);
    document.body.appendChild(overlay);
    document.documentElement.classList.add('dv-noscroll');
    return close;
  }

  function openPicker(product) {
    var sel = defaultSelection(product);
    var qty = 1;
    var digits = '';

    var box = el('<div class="dv-picker">' +
      '<div class="dv-picker__img"></div>' +
      '<div class="dv-picker__body">' +
        '<div class="dv-picker__title">' + esc(product.title) + '</div>' +
        (product.descr ? '<div class="dv-picker__descr">' + product.descr + '</div>' : '') +
        '<div class="dv-picker__opts"></div>' +
        '<div class="dv-picker__row">' +
          '<div class="dv-qty"><button type="button" data-q="-1">−</button><span class="dv-qty__val">1</span><button type="button" data-q="1">+</button></div>' +
          '<div class="dv-picker__price"></div>' +
        '</div>' +
        '<div class="dv-picker__stock"></div>' +
        '<button type="button" class="dv-btn dv-picker__add">' + esc(T.toCart) + '</button>' +
      '</div></div>');

    var optsEl = box.querySelector('.dv-picker__opts');
    var addBtn = box.querySelector('.dv-picker__add');

    function renderOpts() {
      var html = '';
      if (product.type === 'digits') {
        html += '<div class="dv-opt"><div class="dv-opt__title">' + esc(T.digitsLabel) + '</div>' +
          '<input class="dv-digits" inputmode="numeric" maxlength="' + (product.maxDigits || 4) + '" placeholder="' + esc(T.digitsPlaceholder) + '" value="' + esc(digits) + '"></div>';
      }
      (product.options || []).forEach(function (o, i) {
        html += '<div class="dv-opt"><div class="dv-opt__title">' + esc(OPT_NAMES[String(o.title).trim().toLowerCase()] || o.title) + ': <b>' + esc(o.values[sel[i]].name) + '</b></div><div class="dv-opt__values">';
        o.values.forEach(function (v, vi) {
          var probe = sel.slice(); probe[i] = vi;
          var off = stockFor(product, probe) === 0;
          var cls = 'dv-chip' + (o.type === 'color' ? ' dv-chip_color' : '') + (vi === sel[i] ? ' dv-chip_active' : '') + (off ? ' dv-chip_off' : '');
          html += '<button type="button" class="' + cls + '" data-o="' + i + '" data-v="' + vi + '" title="' + esc(v.name) + (off ? ' — ' + esc(T.soldOut) : '') + '"' +
            (o.type === 'color' ? ' style="--dv-swatch:' + esc(v.color || '#ccc') + '"' : '') + '>' +
            (o.type === 'color' ? '' : esc(v.name)) + '</button>';
        });
        html += '</div></div>';
      });
      optsEl.innerHTML = html;
      var input = optsEl.querySelector('.dv-digits');
      if (input) input.addEventListener('input', function () {
        digits = input.value.replace(/\D/g, '');
        if (input.value !== digits) input.value = digits;
        update();
      });
      update();
    }

    function update() {
      var stock = stockFor(product, sel);
      if (stock != null && qty > stock) qty = Math.max(1, stock);
      box.querySelector('.dv-qty__val').textContent = qty;
      box.querySelector('.dv-qty').style.display = product.type === 'digits' ? 'none' : '';
      box.querySelector('.dv-picker__img').style.backgroundImage = "url('" + productImg(product, sel) + "')";
      box.querySelector('.dv-picker__price').textContent = formatPrice(unitPrice(product, sel, digits) * qty);
      box.querySelector('.dv-picker__stock').textContent = stock === 0 ? T.soldOut : '';
      addBtn.disabled = stock === 0 || (product.type === 'digits' && !digits);
    }

    box.addEventListener('click', function (e) {
      var chip = e.target.closest('.dv-chip');
      if (chip) {
        sel[+chip.getAttribute('data-o')] = +chip.getAttribute('data-v');
        renderOpts();
        return;
      }
      var q = e.target.closest('[data-q]');
      if (q) {
        var stock = stockFor(product, sel);
        qty = Math.max(1, qty + (+q.getAttribute('data-q')));
        if (stock != null) qty = Math.min(qty, Math.max(1, stock));
        update();
        return;
      }
      if (e.target.closest('.dv-picker__add') && !addBtn.disabled) {
        addToCart(product, sel, qty, digits);
        close();
      }
    });

    var close = openModal(box, 'picker');
    renderOpts();
  }

  function openUpsellPopup() {
    if (document.querySelector('.dv-modal_upsell')) return;
    var content = el('<div class="dv-upsell"><div class="dv-upsell__title">' + esc(T.popupTitle) + '</div></div>');
    content.appendChild(renderShelf(null, 'popup'));
    content.appendChild(el('<div class="dv-upsell__actions">' +
      '<button type="button" class="dv-btn dv-upsell__checkout">' + esc(T.toCheckout) + '</button>' +
      '<button type="button" class="dv-btn dv-btn_ghost dv-upsell__continue">' + esc(T.continueShopping) + '</button>' +
    '</div>'));
    var close = openModal(content, 'upsell');
    content.querySelector('.dv-upsell__continue').addEventListener('click', close);
    content.querySelector('.dv-upsell__checkout').addEventListener('click', function () {
      close();
      // сразу к форме: допы покупатель только что видел в попапе
      if (typeof window.tcart__openCartFullscreen === 'function') window.tcart__openCartFullscreen();
      else if (typeof window.tcart__openCart === 'function') window.tcart__openCart();
    });
  }

  /* ---------- карточка основного товара ---------- */

  // На сайте два вида блоков каталога: старый (t-store__) и новый (t-catalog__), разметка у них одинаковая
  function enhanceProductCards() {
    document.querySelectorAll('.t-store__prod-popup__btn-wrapper, .t-catalog__prod-popup__btn-wrapper').forEach(function (btnWrap) {
      var card = btnWrap.closest('.js-store-product, .js-catalog-product, .t-store__product-snippet, .t-catalog__product-snippet, .t-store__product-popup, .t-catalog__product-popup');
      if (!card || card.hasAttribute('data-dv-done')) return;
      card.setAttribute('data-dv-done', '1');

      // карточка самого допа: полку допов не показываем, у шаров-цифр — поле ввода цифр
      var addon = addonForCard(card);
      if (addon) {
        card.classList.add('dv-addon-card'); // артикул допа покупателю не нужен (CSS)
        if (addon.type === 'digits') enhanceDigitsCard(card, btnWrap, addon);
        return;
      }
      if (!CFG.productShelf) return;

      var hintsEl = el('<div class="dv-variant-hint"></div>');
      var plaque = el('<a href="#" class="dv-hint">' + esc(T.hint) + ' →</a>');
      btnWrap.parentNode.insertBefore(hintsEl, btnWrap);
      btnWrap.parentNode.insertBefore(plaque, btnWrap.nextSibling);

      var shelf = renderShelf(T.shelfTitle, 'product');
      shelf.id = 'dv-addons-' + Math.random().toString(36).slice(2, 8);
      var info = card.querySelector('.t-store__prod-popup__info, .t-catalog__prod-popup__info') || btnWrap.parentNode;
      info.appendChild(shelf);

      plaque.addEventListener('click', function (e) {
        e.preventDefault();
        shelf.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      // подсказка размера под переключателем варианта
      var updateHint = function () { hintsEl.textContent = variantHintText(card); };
      card.addEventListener('change', function () { setTimeout(updateHint, 0); });
      card.addEventListener('click', function () { setTimeout(updateHint, 0); });
      updateHint();
    });
  }

  function addonForCard(card) {
    // data-product-lid — товар; data-product-uid Tilda подменяет на uid выбранного варианта
    var uids = ['data-product-lid', 'data-product-uid'].map(function (a) { return card.getAttribute(a); }).filter(Boolean);
    for (var i = 0; i < DATA.products.length; i++) {
      var pr = DATA.products[i];
      var own = [pr.uid].concat((pr.editions || []).map(function (e) { return e.uid; }));
      if (uids.some(function (u) { return own.indexOf(u) > -1; })) return pr;
    }
    var skuEl = card.querySelector('.js-store-prod-sku, .js-product-sku');
    var sku = skuEl ? skuEl.textContent.replace(/^[^:]*:\s*/, '').trim() : '';
    if (sku.indexOf(CFG.skuPrefix) !== 0) return null;
    return findProduct(addonIdBySku(sku)) || { id: sku };
  }

  // выбор в опциях Tilda → индексы значений, как в окне допа
  function selectionFromCard(card, product) {
    return (product.options || []).map(function (o) {
      var value = '';
      card.querySelectorAll('.js-product-edition-option').forEach(function (optEl) {
        if ((optEl.getAttribute('data-edition-option-id') || '').trim() !== o.title) return;
        var checked = optEl.querySelector('input[type="radio"]:checked');
        var select = optEl.querySelector('select');
        value = checked ? checked.value : select ? select.value : '';
      });
      var idx = o.values.map(function (v) { return v.name; }).indexOf(value);
      return idx < 0 ? 0 : idx;
    });
  }

  // Страница «шары-цифры»: поле цифр над кнопкой Tilda, кнопка кладёт каждую цифру отдельной строкой
  function enhanceDigitsCard(card, btnWrap, product) {
    card.classList.add('dv-digits-card');
    var field = el('<div class="dv-opt dv-digits-field"><div class="dv-opt__title">' + esc(T.digitsLabel) + '</div>' +
      '<input class="dv-digits" inputmode="numeric" maxlength="' + (product.maxDigits || 4) + '" placeholder="' + esc(T.digitsPlaceholder) + '">' +
      '<div class="dv-digits-total"></div></div>');
    btnWrap.parentNode.insertBefore(field, btnWrap);
    var input = field.querySelector('.dv-digits');
    var total = field.querySelector('.dv-digits-total');

    function update() {
      var digits = input.value;
      var price = itemPrice(product, selectionFromCard(card, product));
      total.textContent = digits ? digits.length + ' × ' + formatPrice(price) + ' = ' + formatPrice(price * digits.length) : '';
    }
    input.addEventListener('input', function () {
      var v = input.value.replace(/\D/g, '');
      if (input.value !== v) input.value = v;
      field.classList.remove('dv-digits-field_error');
      update();
    });
    card.addEventListener('change', function () { setTimeout(update, 0); });
    card.addEventListener('click', function () { setTimeout(update, 0); });

    // перехват до обработчика Tilda: штатно кнопка положила бы один шар без цифр
    btnWrap.addEventListener('click', function (e) {
      if (!e.target.closest('a, button')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var digits = input.value;
      if (!digits) {
        field.classList.add('dv-digits-field_error');
        total.textContent = T.digitsRequired;
        input.focus();
        return;
      }
      var sel = selectionFromCard(card, product);
      if (stockFor(product, sel) === 0) return;
      addToCart(product, sel, 1, digits);
      input.value = '';
      update();
      if (typeof window.tcart__openCart === 'function' && !isCartOpen()) window.tcart__openCart();
    }, true);
  }

  // Разметка Tilda: .js-product-edition-option[data-edition-option-id="Размер"],
  // внутри скрытый <select> и видимые input[type=radio] (вид «кнопки»)
  function variantHintText(card) {
    var hints = CFG.variantHints || {};
    var out = [];
    card.querySelectorAll('.js-product-edition-option').forEach(function (optEl) {
      var title = (optEl.getAttribute('data-edition-option-id') ||
        (optEl.querySelector('.js-product-edition-option-name') || {}).textContent || '').trim();
      var checked = optEl.querySelector('input[type="radio"]:checked');
      var select = optEl.querySelector('select');
      var value = checked ? checked.value : select ? select.value : '';
      if (hints[title] && hints[title][value]) out.push(hints[title][value]);
    });
    return out.join(' · ');
  }

  /* ---------- корзина ---------- */

  function enhanceCart() {
    [['.t706__sidebar-products', 'sidebar'], ['.t706__cartpage-products', 'cartpage']].forEach(function (pair) {
      var list = document.querySelector(pair[0]);
      if (!list || (list.nextElementSibling && list.nextElementSibling.classList.contains('dv-cart'))) return;
      var block = el('<div class="dv-cart dv-cart_' + pair[1] + '"></div>');
      block.appendChild(renderShelf(T.cartTitle, 'cart'));
      list.parentNode.insertBefore(block, list.nextSibling);
    });
    if (fixDigitGroups()) return saveCart(); // перерисовка снова вызовет enhanceCart
    markDigitRows();
    syncNumbersField();
    hideAddonSku();
    refreshMarks();
  }

  /* ---------- шары-цифры в корзине ---------- */

  function digitGroup(p) {
    var m = p && String(p.sku || '').match(/#([a-z0-9]+)\/(\d+)\/(\d+)$/);
    return m ? { id: m[1], pos: +m[2], total: +m[3] } : null;
  }

  function saveCart() {
    if (typeof window.tcart__updateTotalProductsinCartObj === 'function') window.tcart__updateTotalProductsinCartObj();
    if (typeof window.tcart__saveLocalObj === 'function') window.tcart__saveLocalObj();
    if (typeof window.tcart__reDrawCartIcon === 'function') window.tcart__reDrawCartIcon();
    if (typeof window.tcart__reDrawProducts === 'function') window.tcart__reDrawProducts();
    if (typeof window.tcart__reDrawTotal === 'function') window.tcart__reDrawTotal();
  }

  // удаляем все цифры номера разом (половина номера никому не нужна)
  function removeDigitGroup(id) {
    window.tcart.products = cartProducts().filter(function (p) {
      var g = digitGroup(p);
      return !(g && g.id === id);
    });
    saveCart();
  }

  // номер всегда целый и по одной штуке каждой цифры
  function fixDigitGroups() {
    var groups = {}, changed = false;
    cartProducts().forEach(function (p) {
      var g = digitGroup(p);
      if (!g) return;
      (groups[g.id] = groups[g.id] || { total: g.total, items: [] }).items.push(p);
    });
    Object.keys(groups).forEach(function (id) {
      var g = groups[id];
      var alive = g.items.filter(function (p) { return p.quantity > 0; });
      if (alive.length && alive.length < g.total) {
        window.tcart.products = cartProducts().filter(function (p) { return g.items.indexOf(p) === -1; });
        changed = true;
        return;
      }
      alive.forEach(function (p) {
        if (+p.quantity !== 1) {
          p.quantity = 1;
          p.amount = p.price;
          changed = true;
        }
      });
    });
    return changed;
  }

  // скрытое поле в форме заказа: все номера целиком, например «25 (Gold); 30 (Silver)»
  function numbersSummary() {
    var seen = {}, out = [];
    cartProducts().forEach(function (p) {
      var g = digitGroup(p);
      if (!g || seen[g.id] || !(p.quantity > 0)) return;
      seen[g.id] = true;
      var opts = p.options || [];
      var num = (opts[0] || {}).variant || '';
      var rest = opts.slice(2).map(function (o) { return o.variant; }).join(', ');
      out.push(num + (rest ? ' (' + rest + ')' : ''));
    });
    return out.join('; ');
  }

  function syncNumbersField() {
    var value = numbersSummary();
    document.querySelectorAll('.t706 form').forEach(function (form) {
      var input = form.querySelector('input[data-dv-numbers]');
      if (!input) {
        if (!value) return;
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = T.numbersField;
        input.setAttribute('data-dv-numbers', '');
        form.appendChild(input);
      }
      input.value = value;
    });
  }

  // строки цифр: без «+/−», крестик удаляет весь номер
  function markDigitRows() {
    var products = cartProducts();
    document.querySelectorAll('.t706__product[data-cart-product-i]').forEach(function (row) {
      row.classList.toggle('dv-digit-row', !!digitGroup(products[+row.getAttribute('data-cart-product-i')]));
    });
  }

  document.addEventListener('click', function (e) {
    var del = e.target.closest && e.target.closest('.t706__product-del');
    if (!del) return;
    var row = del.closest('.t706__product[data-cart-product-i]');
    var g = row && digitGroup(cartProducts()[+row.getAttribute('data-cart-product-i')]);
    if (!g) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    removeDigitGroup(g.id);
  }, true);

  // Tilda печатает артикул под названием — для допов он служебный
  function hideAddonSku() {
    var products = cartProducts();
    document.querySelectorAll('.t706__product[data-cart-product-i]').forEach(function (row) {
      var p = products[+row.getAttribute('data-cart-product-i')];
      if (!isAddonCartItem(p)) return;
      row.querySelectorAll('.t706__product-title__option').forEach(function (o) {
        if (o.textContent.trim() === p.sku) o.style.display = 'none';
      });
    });
  }

  /* ---------- перехваты Tilda ---------- */

  function hookCart() {
    // NB: на сайте tcart__addProduct уже оборачивает модуль Nolim (NLM077) — оборачиваем по цепочке
    waitFor(function () { return typeof window.tcart__addProduct === 'function'; }, function () {
      var original = window.tcart__addProduct;
      window.tcart__addProduct = function (product) {
        var result = original.apply(this, arguments);
        if (CFG.upsellPopup && product && !isAddonCartItem(product) && !isCartOpen() && result !== false) {
          setTimeout(openUpsellPopup, 300);
        }
        return result;
      };
    });

    waitFor(function () { return typeof window.tcart__reDrawProducts === 'function'; }, function () {
      var original = window.tcart__reDrawProducts;
      window.tcart__reDrawProducts = function () {
        var result = original.apply(this, arguments);
        enhanceCart();
        return result;
      };
    });

    // Шаги оформления — штатные Tilda, свой шаг не добавляем:
    //  десктоп: боковая корзина (товары + допы) → «Оформить заказ» → страница с формой (допов там нет, см. CSS);
    //  мобильный: сразу страница корзины, форма спрятана за «Оформить заказ», допы над ней.
    document.addEventListener('fullscreenCartOpened', enhanceCart);
  }

  /* ---------- старт ---------- */

  function loadCss() {
    if (!CFG.cssUrl || document.querySelector('link[data-dv-addons]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CFG.cssUrl;
    link.setAttribute('data-dv-addons', '');
    document.head.appendChild(link);
  }

  function start(data) {
    DATA = data;
    buildSkuMap();
    hookCart();
    enhanceProductCards();
    enhanceCart();
    // карточка товара Tilda рисуется скриптом каталога, ждём её появления
    new MutationObserver(function () {
      enhanceProductCards();
    }).observe(document.body, { childList: true, subtree: true });
  }

  loadCss();
  loadData()
    .then(function (data) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(data); });
      else start(data);
    })
    .catch(function (err) { console.error('[dv-addons] не удалось загрузить допы', err); });

  window.dvAddons = { config: CFG, openUpsellPopup: openUpsellPopup, openPicker: function (id) { openPicker(findProduct(id)); } };
})();
