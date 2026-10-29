/* Dejavu: доп. разметка для карточки товара (крошки, размеры, преимущества, плашка с размерами). */
(function () {
  var PERKS = [
    ['Доставка в день заказа', '<path d="M3 7h11v8H3zM14 10h4l3 3v2h-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="7" cy="17" r="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="17" r="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ['Фото букета до отправки', '<rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 6l1.2-2h4.6l1.2 2" fill="none" stroke="currentColor" stroke-width="1.5"/>'],
    ['Открытка в подарок', '<rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 6.5L12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.5"/>']
  ];
  var CATALOG = { href: '/122222', title: 'Каталог' };

  // CSS лежит рядом со скриптом
  var self = document.currentScript || document.querySelector('script[src*="dv-product-ui.js"]');
  if (self && self.src && !document.getElementById('dv-product-ui-css')) {
    var l = document.createElement('link');
    l.id = 'dv-product-ui-css';
    l.rel = 'stylesheet';
    l.href = self.src.replace(/\.js(\?|$)/, '.css$1'); // метку ?t= из загрузчика тоже передаём
    document.head.appendChild(l);
  }
  var IMG = self && self.src ? self.src.replace(/dv-product-ui\.js(\?.*)?$/, 'img/') : '';

  // Плашка «Как выглядят размеры» с фото на весь экран. Переопределить: window.DV_SIZE_GUIDE = {...}, отключить: false
  var GUIDE = window.DV_SIZE_GUIDE !== undefined ? window.DV_SIZE_GUIDE : {
    title: 'Как выглядят размеры',
    text: 'Букеты и коробки в сравнении — нажмите, чтобы увеличить',
    img: IMG + 'sizes.jpg'
  };

  function init(root) {
    if (root.dataset.dvUi || !root.querySelector('.js-product-edition-option')) return;
    root.dataset.dvUi = '1';

    // Крошки над названием
    var tw = root.querySelector('.t-catalog__prod-popup__title-wrapper');
    var name = root.querySelector('.js-product-name');
    if (tw && name) {
      var c = document.createElement('div');
      c.className = 'dv-crumbs';
      c.innerHTML = '<a href="' + CATALOG.href + '">' + CATALOG.title + '</a> &nbsp;/&nbsp; ' + name.textContent.replace(/\s*\(\s*\)\s*$/, '');
      tw.insertBefore(c, tw.firstChild);
      name.textContent = name.textContent.replace(/\s*\(\s*\)\s*$/, '');
    }

    // Цены по размерам из описания: «S 25 шт. — 450 AED» (само описание скрыто в CSS)
    var text = root.querySelector('.js-catalog-prod-all-text');
    var prices = {};
    if (text) {
      text.innerHTML.split(/<br\s*\/?>/i).forEach(function (l) {
        var m = l.replace(/<[^>]+>|&nbsp;/g, ' ').trim().match(/^([SMLX]{1,3})\s+\d+\s*шт\.?\s*[—-]\s*([\d\s]+)\s*AED/i);
        if (m) prices[m[1].toUpperCase()] = m[2].trim();
      });
    }

    // Опции: значение рядом с заголовком, размер — в 3 строки
    root.querySelectorAll('.js-product-edition-option').forEach(function (opt) {
      var title = opt.querySelector('.js-product-edition-option-name');
      var isSize = /размер|size/i.test(opt.dataset.editionOptionId || '');
      if (isSize) {
        opt.classList.add('dv-size');
        opt.querySelectorAll('.t-product__option-title_buttons').forEach(function (s) {
          var m = s.textContent.match(/^\s*([A-Z]{1,3})\s*[—-]\s*(.+)$/);
          if (m) s.innerHTML = '<b>' + m[1] + '</b>' + m[2] + (prices[m[1]] ? '<i>' + prices[m[1]] + ' AED</i>' : '');
        });
      }
      var val = document.createElement('span');
      val.className = 'dv-opt-value';
      title.appendChild(val);
      var sync = function () {
        var a = opt.querySelector('.t-product__option-item_active input');
        val.textContent = isSize || !a ? '' : a.value;
      };
      opt.addEventListener('change', function () { setTimeout(sync, 0); });
      opt.addEventListener('click', function () { setTimeout(sync, 0); });
      sync();
    });

    // Преимущества под кнопкой
    var btns = root.querySelector('.t-catalog__prod-popup__btn-wrapper');
    if (btns) {
      var p = document.createElement('div');
      p.className = 'dv-perks';
      p.innerHTML = PERKS.map(function (x) {
        return '<div class="dv-perk"><svg viewBox="0 0 24 24">' + x[1] + '</svg>' + x[0] + '</div>';
      }).join('');
      btns.insertAdjacentElement('afterend', p);
    }

    buildGuide(root);
  }

  function buildGuide(root) {
    var anchor = root.querySelector('.dv-perks') || root.querySelector('.t-catalog__prod-popup__btn-wrapper');
    if (!GUIDE || !anchor || !root.querySelector('.dv-size')) return;
    var g = document.createElement('button');
    g.type = 'button';
    g.className = 'dv-guide';
    g.innerHTML = '<img src="' + GUIDE.img + '" alt="" loading="lazy">' +
      '<span class="dv-guide__txt"><b>' + GUIDE.title + '</b>' + GUIDE.text + '</span>' +
      '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    g.addEventListener('click', openZoom);
    anchor.insertAdjacentElement('afterend', g);
  }

  function openZoom() {
    var z = document.createElement('div');
    z.className = 'dv-zoom';
    z.innerHTML = '<img src="' + GUIDE.img + '" alt="' + GUIDE.title + '"><button type="button" aria-label="Закрыть">&times;</button>';
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

  function run() { document.querySelectorAll('.t-catalog__prod-snippet__container').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  // карточка дорисовывается Tilda асинхронно
  var tries = 0, t = setInterval(function () { run(); if (++tries > 20) clearInterval(t); }, 300);
})();
