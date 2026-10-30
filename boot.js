/* Dejavu: точка входа с сайта. Загрузчик в Tilda только находит последний тег и подключает этот файл,
   поэтому всё, что решает «что и когда включать», меняется здесь, без правки Tilda. */
(function () {
  // Новый вид карточки товара (+ допы) — только на странице с ?dvui=1 в адресе
  if (!/[?&]dvui=1(&|$)/.test(location.search)) return;

  var self = document.currentScript || document.querySelector('script[src*="/boot.js"]');
  if (!self || !self.src) return;
  var s = document.createElement('script');
  s.src = self.src.replace(/boot\.js(\?.*)?$/, 'product-ui/dv-product-ui.js');
  (document.body || document.head).appendChild(s);
})();
