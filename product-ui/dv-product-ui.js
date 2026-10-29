/* Dejavu: доп. разметка для карточки товара (крошки, размеры, преимущества, таблица цен). */
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
    l.href = self.src.replace(/\.js(\?.*)?$/, '.css');
    document.head.appendChild(l);
  }
  var IMG = self && self.src ? self.src.replace(/dv-product-ui\.js(\?.*)?$/, 'img/') : '';

  // Фото для сравнения размеров. Переопределить: window.DV_SIZE_GUIDE = {...}, отключить: false
  var GUIDE = window.DV_SIZE_GUIDE !== undefined ? window.DV_SIZE_GUIDE : {
    title: 'Как выглядят размеры',
    groups: [
      { name: 'Букет', match: /букет/i, items: [
        { img: 'bouquet-11.jpg', label: '11 шт.', count: 11, w: 285, h: 478 },
        { img: 'bouquet-25.jpg', label: '25 шт.', count: 25, w: 268, h: 478 },
        { img: 'bouquet-51.jpg', label: '51 шт.', count: 51, w: 338, h: 478 }
      ] },
      { name: 'Коробка', match: /короб/i, items: [
        { img: 'box-25.jpg', label: 'S · 25 шт.', count: 25, w: 184, h: 443 },
        { img: 'box-51.jpg', label: 'M · 51 шт.', count: 51, w: 186, h: 443 },
        { img: 'box-101.jpg', label: 'L · 101 шт.', count: 101, w: 224, h: 443 },
        { img: 'box-201.jpg', label: 'XL · 201 шт.', count: 201, w: 298, h: 443 }
      ] }
    ]
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
        syncGuide(root);
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

  // Блок «Как выглядят размеры»: ряды фото одной высоты, чтобы масштаб был честным
  function buildGuide(root) {
    var sizeOpt = root.querySelector('.dv-size');
    var anchor = root.querySelector('.dv-perks') || root.querySelector('.t-catalog__prod-popup__btn-wrapper');
    if (!GUIDE || !sizeOpt || !anchor) return;
    var g = document.createElement('div');
    g.className = 'dv-guide';
    g.innerHTML = '<div class="dv-guide__head"><div class="dv-guide__title">' + GUIDE.title + '</div>' +
      '<div class="dv-guide__tabs">' + GUIDE.groups.map(function (gr, i) {
        return '<button type="button" data-tab="' + i + '"' + (i ? '' : ' class="is-active"') + '>' + gr.name + '</button>';
      }).join('') + '</div></div>' +
      GUIDE.groups.map(function (gr, i) {
        return '<div class="dv-guide__row" data-row="' + i + '"' + (i ? ' hidden' : '') + '>' + gr.items.map(function (it) {
          return '<figure class="dv-guide__item" data-count="' + it.count + '" style="flex-grow:' + (it.w / it.h).toFixed(3) + '">' +
            '<img src="' + IMG + it.img + '" alt="' + gr.name + ' ' + it.label + '" loading="lazy" width="' + it.w + '" height="' + it.h + '">' +
            '<figcaption>' + it.label + '</figcaption></figure>';
        }).join('') + '</div>';
      }).join('');
    anchor.insertAdjacentElement('afterend', g);

    g.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) { g.dataset.manual = '1'; showTab(g, +tab.dataset.tab); return; }
      // клик по фото выбирает такой же размер в опциях
      var it = e.target.closest('.dv-guide__item');
      if (!it) return;
      var lbl = [].filter.call(sizeOpt.querySelectorAll('label'), function (l) {
        return countOf(l.querySelector('input').value) === +it.dataset.count;
      })[0];
      if (lbl) lbl.click();
    });
    syncGuide(root);
  }

  function showTab(g, i) {
    g.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('is-active', +b.dataset.tab === i); });
    g.querySelectorAll('[data-row]').forEach(function (r) { r.hidden = +r.dataset.row !== i; });
  }

  function countOf(v) { return +((String(v).match(/(\d+)\s*шт/) || [])[1] || 0); }

  // Вкладка — по «Оформлению» (пока юзер не переключил сам), подсветка — по числу цветов в размере
  function syncGuide(root) {
    var g = root.querySelector('.dv-guide');
    if (!g) return;
    var form = root.querySelector('.dv-optimg-on .t-product__option-item_active input, [data-edition-option-id="Оформление"] .t-product__option-item_active input');
    if (form && !g.dataset.manual) {
      GUIDE.groups.forEach(function (gr, i) { if (gr.match.test(form.value)) showTab(g, i); });
    }
    var size = root.querySelector('.dv-size .t-product__option-item_active input');
    var n = size ? countOf(size.value) : 0;
    g.querySelectorAll('.dv-guide__item').forEach(function (it) { it.classList.toggle('is-active', +it.dataset.count === n); });
  }

  function run() { document.querySelectorAll('.t-catalog__prod-snippet__container').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  // карточка дорисовывается Tilda асинхронно
  var tries = 0, t = setInterval(function () { run(); if (++tries > 20) clearInterval(t); }, 300);
})();
