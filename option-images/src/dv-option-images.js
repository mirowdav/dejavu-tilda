/* Dejavu Flowers — картинки в опциях товара (кнопки выбора варианта Tilda).
 *
 * Конфиг (до подключения скрипта):
 *   window.DV_OPTION_IMAGES = {
 *     'Оформление': { 'Букет': 'https://.../bouquet.jpg', 'Корзина': 'https://.../basket.jpg' }
 *   };
 * Опция или значение, которых нет в конфиге (или нет на странице), пропускаются.
 * Блоки каталога Tilda перерисовываются на лету, поэтому следим за DOM. */
(function () {
  'use strict';
  if (window.__dvOptionImages) return;
  window.__dvOptionImages = true;

  var MAP = window.DV_OPTION_IMAGES || {};
  var DONE = 'data-dv-optimg';

  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  var index = {};
  Object.keys(MAP).forEach(function (opt) {
    var vals = {};
    Object.keys(MAP[opt] || {}).forEach(function (v) { vals[norm(v)] = MAP[opt][v]; });
    index[norm(opt)] = vals;
  });

  function injectStyle() {
    if (document.getElementById('dv-optimg-style')) return;
    var st = document.createElement('style');
    st.id = 'dv-optimg-style';
    st.textContent =
      '.dv-optimg-on .t-product__option-item_buttons{display:inline-flex;flex-direction:column;align-items:center;gap:6px;padding:6px;height:auto}' +
      '.dv-optimg{display:block;width:64px;height:64px;border-radius:8px;object-fit:cover}' +
      '@media(max-width:640px){.dv-optimg{width:52px;height:52px}}';
    document.head.appendChild(st);
  }

  function apply(root) {
    root.querySelectorAll('.js-product-edition-option').forEach(function (optEl) {
      var name = norm((optEl.querySelector('.js-product-edition-option-name') || {}).textContent ||
                      optEl.getAttribute('data-edition-option-id'));
      var vals = index[name];
      if (!vals) return;
      var used = false;
      optEl.querySelectorAll('label.t-product__option-item').forEach(function (label) {
        if (label.hasAttribute(DONE)) { used = true; return; }
        var input = label.querySelector('input');
        var title = label.querySelector('.t-product__option-title');
        var url = vals[norm(input ? input.value : '')] || vals[norm(title ? title.textContent : '')];
        if (!url) return;
        var img = document.createElement('img');
        img.className = 'dv-optimg';
        img.src = url;
        img.alt = title ? title.textContent.trim() : '';
        img.loading = 'lazy';
        label.insertBefore(img, title || null);
        label.setAttribute(DONE, '1');
        used = true;
      });
      if (used) { injectStyle(); optEl.classList.add('dv-optimg-on'); }
    });
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; apply(document); });
  }

  function start() {
    apply(document);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
