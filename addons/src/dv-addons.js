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
    dataUrl: BASE_URL + 'data/addons.json',
    cssUrl: BASE_URL + 'src/dv-addons.css',
    // по префиксу артикула отличаем допы от основных товаров
    skuPrefix: 'DOP-',
    currency: 'AED',
    // показывать попап после добавления основного товара
    upsellPopup: true,
    // на десктопе прятать форму на странице корзины, пока не нажата «Перейти к оформлению»
    twoStepDesktop: true,
    // подсказка размера под переключателем: { 'Размер': { 'M — 51 шт.': '40 × 35 см' } }
    variantHints: {},
    texts: {
      hint: 'Добавьте шары или сладости к подарку',
      shelfTitle: 'Дополните подарок',
      cartTitle: 'Не забудьте добавить',
      popupTitle: 'Товар добавлен. Дополните подарок',
      toCheckout: 'Перейти к оформлению',
      continueShopping: 'Продолжить покупки',
      choose: 'Выбрать',
      add: 'Добавить',
      added: 'Добавлено',
      inCart: 'В корзине',
      from: 'от',
      soldOut: 'Нет в наличии',
      digitsLabel: 'Цифры',
      digitsPlaceholder: 'Например, 25',
      quantity: 'Количество'
    }
  }, window.DV_ADDONS_CONFIG || {});
  CFG.texts = Object.assign({}, CFG.texts, (window.DV_ADDONS_CONFIG || {}).texts || {});

  var T = CFG.texts;
  var DATA = null;

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

  function isAddonCartItem(p) {
    return !!(p && p.sku && String(p.sku).indexOf(CFG.skuPrefix) === 0);
  }

  function inCartIds() {
    var ids = {};
    cartProducts().forEach(function (p) {
      if (isAddonCartItem(p) && p.quantity > 0) ids[String(p.sku).slice(CFG.skuPrefix.length)] = true;
    });
    return ids;
  }

  function isCartOpen() {
    var b = document.body.classList;
    return b.contains('t706__body_cartsidebarshowed') || b.contains('t706__body_cartpageshowed') || b.contains('t706__body_cartwinshowed');
  }

  /* ---------- модель товара-допа ---------- */

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
    if (product.stock == null) return null;
    if (typeof product.stock === 'number') return product.stock;
    var key = variantKey(product, sel);
    return Object.prototype.hasOwnProperty.call(product.stock, key) ? product.stock[key] : null;
  }

  function unitPrice(product, sel, digits) {
    var price = product.price || 0;
    (product.options || []).forEach(function (o, i) {
      var v = o.values[sel[i]];
      if (v.price != null) price = v.price;
      if (v.add != null) price += v.add;
    });
    if (product.type === 'digits') price *= Math.max(1, (digits || '').length);
    return price;
  }

  function productImg(product, sel) {
    var img = product.img, color = null;
    (product.options || []).forEach(function (o, i) {
      var v = o.values[sel ? sel[i] : 0];
      if (v.img) img = v.img;
      if (v.color && !color) color = v.color;
    });
    return img || placeholderImg(color);
  }

  function minPrice(product) {
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
    if (product.type === 'digits') options.unshift({ option: T.digitsLabel, variant: digits });

    var item = {
      name: product.title,
      price: unitPrice(product, sel, digits),
      quantity: qty,
      img: productImg(product, sel),
      sku: CFG.skuPrefix + product.id
    };
    if (options.length) item.options = options;
    var stock = stockFor(product, sel);
    if (stock != null) item.inv = stock;

    window.tcart__addProduct(item);
    // tcart__addProduct сам не перерисовывает открытую корзину
    if (isCartOpen()) {
      if (typeof window.tcart__reDrawProducts === 'function') window.tcart__reDrawProducts();
      if (typeof window.tcart__reDrawTotal === 'function') window.tcart__reDrawTotal();
    }
    refreshMarks();
  }

  /* ---------- полка допов ---------- */

  function renderShelf(title, mod) {
    var groups = DATA.groups.filter(function (g) {
      return DATA.products.some(function (p) { return p.group === g.id; });
    });
    var root = el(
      '<div class="dv-shelf ' + (mod ? 'dv-shelf_' + mod : '') + '">' +
        (title ? '<div class="dv-shelf__title">' + esc(title) + '</div>' : '') +
        '<div class="dv-shelf__tabs">' + groups.map(function (g, i) {
          return '<button type="button" class="dv-tab' + (i === 0 ? ' dv-tab_active' : '') + '" data-group="' + esc(g.id) + '">' + esc(g.title) + '</button>';
        }).join('') + '</div>' +
        '<div class="dv-shelf__list"></div>' +
      '</div>'
    );
    var list = root.querySelector('.dv-shelf__list');

    function show(groupId) {
      list.innerHTML = DATA.products.filter(function (p) { return p.group === groupId; }).map(function (p) {
        return '<div class="dv-card" data-id="' + esc(p.id) + '">' +
            '<div class="dv-card__img" style="background-image:url(\'' + productImg(p, defaultSelection(p)) + '\')"></div>' +
            '<div class="dv-card__badge">' + esc(T.inCart) + '</div>' +
            '<div class="dv-card__title">' + esc(p.title) + '</div>' +
            '<div class="dv-card__price">' + (hasChoice(p) ? T.from + ' ' : '') + formatPrice(minPrice(p)) + '</div>' +
            '<button type="button" class="dv-btn dv-btn_sm dv-card__btn">' + esc(hasChoice(p) ? T.choose : T.add) + '</button>' +
          '</div>';
      }).join('');
      refreshMarks();
    }

    root.addEventListener('click', function (e) {
      var tab = e.target.closest('.dv-tab');
      if (tab) {
        root.querySelectorAll('.dv-tab').forEach(function (t) { t.classList.toggle('dv-tab_active', t === tab); });
        show(tab.getAttribute('data-group'));
        return;
      }
      var card = e.target.closest('.dv-card');
      if (!card) return;
      var product = findProduct(card.getAttribute('data-id'));
      if (!product) return;
      if (hasChoice(product)) {
        openPicker(product);
      } else {
        addToCart(product, defaultSelection(product), 1);
        flash(card.querySelector('.dv-card__btn'));
      }
    });

    show(groups.length ? groups[0].id : null);
    return root;
  }

  function flash(btn) {
    if (!btn) return;
    var text = btn.textContent;
    btn.textContent = T.added;
    btn.disabled = true;
    setTimeout(function () { btn.textContent = text; btn.disabled = false; }, 1200);
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
      '<button type="button" class="dv-modal__close" aria-label="Закрыть">×</button></div></div>');
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
        '<div class="dv-picker__opts"></div>' +
        '<div class="dv-picker__row">' +
          '<div class="dv-qty"><button type="button" data-q="-1">−</button><span class="dv-qty__val">1</span><button type="button" data-q="1">+</button></div>' +
          '<div class="dv-picker__price"></div>' +
        '</div>' +
        '<div class="dv-picker__stock"></div>' +
        '<button type="button" class="dv-btn dv-picker__add">' + esc(T.add) + '</button>' +
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
        html += '<div class="dv-opt"><div class="dv-opt__title">' + esc(o.title) + ': <b>' + esc(o.values[sel[i]].name) + '</b></div><div class="dv-opt__values">';
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
      if (typeof window.tcart__openCart === 'function') window.tcart__openCart();
    });
  }

  /* ---------- карточка основного товара ---------- */

  // На сайте два вида блоков каталога: старый (t-store__) и новый (t-catalog__), разметка у них одинаковая
  function enhanceProductCards() {
    document.querySelectorAll('.t-store__prod-popup__btn-wrapper, .t-catalog__prod-popup__btn-wrapper').forEach(function (btnWrap) {
      var card = btnWrap.closest('.js-store-product, .js-catalog-product, .t-store__product-snippet, .t-catalog__product-snippet, .t-store__product-popup, .t-catalog__product-popup');
      if (!card || card.hasAttribute('data-dv-done')) return;
      card.setAttribute('data-dv-done', '1');

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
      if (pair[1] === 'cartpage' && CFG.twoStepDesktop) {
        var next = el('<button type="button" class="dv-btn dv-cart__next">' + esc(T.toCheckout) + '</button>');
        next.addEventListener('click', openCheckoutStep);
        block.appendChild(next);
      }
      list.parentNode.insertBefore(block, list.nextSibling);
    });
    hideAddonSku();
    refreshMarks();
  }

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

  function setCheckoutStep(isFormStep) {
    var page = document.querySelector('.t706__cartpage');
    if (page) page.classList.toggle('dv-step1', !isFormStep);
  }

  function openCheckoutStep() {
    setCheckoutStep(true);
    // то же, что делает Tilda на мобильном по кнопке «Оформить заказ»
    window.tcart_issecondstep = true;
    if (typeof window.tcart__updateDelivery === 'function') window.tcart__updateDelivery();
    var form = document.querySelector('.t706__cartpage-form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    // полноэкранная страница корзины — шаг 1: допы, шаг 2: форма
    document.addEventListener('fullscreenCartOpened', function () {
      enhanceCart();
      if (CFG.twoStepDesktop && !window.tcart_isMobile) setCheckoutStep(false);
    });
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
    hookCart();
    enhanceProductCards();
    enhanceCart();
    // карточка товара Tilda рисуется скриптом каталога, ждём её появления
    new MutationObserver(function () {
      enhanceProductCards();
    }).observe(document.body, { childList: true, subtree: true });
  }

  loadCss();
  fetch(CFG.dataUrl, { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(data); });
      else start(data);
    })
    .catch(function (err) { console.error('[dv-addons] не удалось загрузить допы', err); });

  window.dvAddons = { config: CFG, openUpsellPopup: openUpsellPopup, openPicker: function (id) { openPicker(findProduct(id)); } };
})();
