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

    // Цены по размерам из описания: «S 25 шт. — 450 AED»
    var text = root.querySelector('.js-catalog-prod-all-text [data-customstyle], .js-catalog-prod-all-text');
    var prices = {};
    if (text) {
      var html = text.innerHTML;
      var rows = html.split(/<br\s*\/?>/i).map(function (l) { return l.replace(/<[^>]+>|&nbsp;/g, ' ').trim(); });
      var hits = rows.filter(function (l) { return /^([SMLX]{1,3})\s+(\d+)\s*шт\.?\s*[—-]\s*([\d\s]+)\s*AED/i.test(l); });
      if (hits.length) {
        var table = '<div class="dv-sizes">';
        hits.forEach(function (l) {
          var m = l.match(/^([SMLX]{1,3})\s+(\d+)\s*шт\.?\s*[—-]\s*([\d\s]+)\s*AED/i);
          prices[m[1].toUpperCase()] = m[3].trim();
          table += '<div data-size="' + m[1].toUpperCase() + '"><span>' + m[1].toUpperCase() + ' · ' + m[2] + ' цветков</span>' + m[3].trim() + ' AED</div>';
        });
        table += '</div>';
        // убираем строки прайса из текста (и лишние переносы перед ними)
        var keep = html.split(/<br\s*\/?>/i).filter(function (l, i) { return hits.indexOf(rows[i]) < 0; });
        while (keep.length && !keep[keep.length - 1].replace(/&nbsp;|\s/g, '')) keep.pop();
        text.innerHTML = keep.join('<br>');
        text.insertAdjacentHTML('afterend', table);
      }
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
        var v = a ? a.value : '';
        val.textContent = isSize ? '' : v;
        if (isSize) {
          var k = (v.match(/^\s*([A-Z]{1,3})/) || [])[1];
          root.querySelectorAll('.dv-sizes [data-size]').forEach(function (r) { r.classList.toggle('is-active', r.dataset.size === k); });
        }
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
  }

  function run() { document.querySelectorAll('.t-catalog__prod-snippet__container').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  // карточка дорисовывается Tilda асинхронно
  var tries = 0, t = setInterval(function () { run(); if (++tries > 20) clearInterval(t); }, 300);
})();
