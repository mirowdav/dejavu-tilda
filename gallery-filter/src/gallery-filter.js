/*
 * gallery-filter — фильтрация галереи товара Tilda по выбранным опциям.
 * В галерее остаются только фото, у которых alt содержит все выбранные значения опций
 * (например «Розовый;M — 51 шт.»). Подробности: gallery-filter/README.md
 *
 * Подключение (один раз на весь сайт):
 *   <script src="https://cdn.jsdelivr.net/gh/mirowdav/dejavu-tilda@main/gallery-filter/src/gallery-filter.js" defer></script>
 */
(function () {
if (window.__galleryFilterLoaded) return;
window.__galleryFilterLoaded = true;

console.log('%c[gallery-filter] Скрипт загружен и выполняется', 'color:#0a0;font-weight:bold;');

// Поддерживаются оба модуля Tilda: «Магазин» (t-store) и «Каталог» (t-catalog)
const SELECTORS = {
    container: '.t-store__prod-snippet__container, .t-catalog__prod-snippet__container',
    productRoot: '.js-store-product, .js-catalog-product',
    itemsWrapper: '.t-slds__items-wrapper',
    thumbsWrapper: '.t-slds__thumbsbullet-wrapper',
    optionInputs: '.t-product__option-input',
    optionSelects: 'select.js-product-edition-option-variants'
};

// Заглушка, когда под выбранную комбинацию опций нет ни одного фото.
// Пустая строка = заглушка отключена (галерея в этом случае не меняется).
const PLACEHOLDER_IMAGE = 'https://static.tildacdn.com/tild3530-3439-4039-b839-336533643132/Group_2087325963.svg';

let captionImages = [];
let currentRecid = null;

// Скоуп — конкретно открытый сейчас товар, а не весь блок магазина/каталога
// (блок включает в себя и каталожную сетку с опциями ДРУГИХ товаров — проверено логами)
function getScopeRoot() {
    const scoped = document.querySelector(SELECTORS.productRoot);
    if (scoped) return scoped;
    console.warn('[gallery-filter] корень товара не найден, скоуп = document (может быть неточным)');
    return document;
}

function getSelectedValues() {
    const scopeRoot = getScopeRoot();
    const values = [];
    scopeRoot.querySelectorAll('.js-product-edition-option').forEach(opt => {
        const checked = opt.querySelector(SELECTORS.optionInputs + ':checked');
        const select = opt.querySelector(SELECTORS.optionSelects);
        const val = checked ? checked.value : (select ? select.value : null);
        if (val) values.push(val);
    });
    console.log('[gallery-filter] getSelectedValues →', values);
    return values;
}

function getImagesForSelection() {
    const selected = getSelectedValues();
    if (!selected.length) {
        console.warn('[gallery-filter] getImagesForSelection: нет выбранных значений опций');
        return null;
    }
    console.log('[gallery-filter] captionImages для сравнения:', captionImages);
    const matchedGroups = captionImages.filter(g =>
        selected.every(v => g.caption.indexOf(v) !== -1)
    );
    console.log('[gallery-filter] matchedGroups:', matchedGroups);
    if (!matchedGroups.length) {
        console.warn('[gallery-filter] Ни одна caption-группа не подошла под выбранные значения:', selected, '→ показываем заглушку');
        return PLACEHOLDER_IMAGE ? [PLACEHOLDER_IMAGE] : null;
    }
    const seen = new Set();
    const images = [];
    matchedGroups.forEach(g => {
        g.images.forEach(img => {
            if (!seen.has(img)) { seen.add(img); images.push(img); }
        });
    });
    console.log('[gallery-filter] Итоговые изображения:', images);
    return images;
}

function buildCaptionImagesFromGallery(galleryRaw) {
    console.log('[gallery-filter] buildCaptionImagesFromGallery: сырые данные gallery →', galleryRaw);
    let gallery;
    try {
        gallery = typeof galleryRaw === 'string' ? JSON.parse(galleryRaw) : galleryRaw;
    } catch (e) {
        console.error('[gallery-filter] Ошибка парсинга gallery:', e);
        return [];
    }
    console.log('[gallery-filter] gallery после парсинга:', gallery);
    const byCaption = {};
    const result = [];
    gallery.forEach(item => {
        if (!item.alt || !item.img) {
            console.log('[gallery-filter] Пропущено фото без alt/img:', item);
            return;
        }
        if (!byCaption[item.alt]) {
            byCaption[item.alt] = { caption: item.alt, images: [] };
            result.push(byCaption[item.alt]);
        }
        if (!byCaption[item.alt].images.includes(item.img)) {
            byCaption[item.alt].images.push(item.img);
        }
    });
    console.log('[gallery-filter] captionImages построены из gallery:', result);
    return result;
}

function buildCaptionImagesFromDOM(slideItems) {
    console.log('[gallery-filter] buildCaptionImagesFromDOM: найдено слайдов →', slideItems.length);
    const byCaption = {};
    const result = [];
    slideItems.forEach(slideItem => {
        const slideCaption = slideItem.querySelector('meta[itemprop="caption"]')?.getAttribute('content');
        const slideImage = slideItem.querySelector('meta[itemprop="image"]')?.getAttribute('content');
        if (!slideCaption || !slideImage) return;
        if (!byCaption[slideCaption]) {
            byCaption[slideCaption] = { caption: slideCaption, images: [] };
            result.push(byCaption[slideCaption]);
        }
        if (!byCaption[slideCaption].images.includes(slideImage)) {
            byCaption[slideCaption].images.push(slideImage);
        }
    });
    console.log('[gallery-filter] captionImages построены из DOM:', result);
    return result;
}

function updateSliderImages(slideImages, isInitial = false) {
    console.log('[gallery-filter] updateSliderImages вызван, isInitial =', isInitial, 'images =', slideImages);

    const scopeRoot = getScopeRoot();
    const sliderItemsWrapper = scopeRoot.querySelector(SELECTORS.itemsWrapper);
    const thumbsBulletWrapper = scopeRoot.querySelector(SELECTORS.thumbsWrapper);
    const mainSlider = scopeRoot.querySelector('.t-slds__main');

    if (!sliderItemsWrapper || !mainSlider) {
        console.error('[gallery-filter] updateSliderImages: элемент слайдера НЕ найден', { sliderItemsWrapper, mainSlider });
        return;
    }
    if (!slideImages || !slideImages.length) {
        console.warn('[gallery-filter] updateSliderImages: список изображений пуст — выходим без изменений');
        return;
    }

    const currentHeight = mainSlider.offsetHeight;
    const currentWidth = mainSlider.offsetWidth;
    console.log('[gallery-filter] Текущие размеры слайдера:', currentWidth, 'x', currentHeight);

    if (!isInitial) {
        mainSlider.style.height = `${currentHeight}px`;
        mainSlider.style.width = `${currentWidth}px`;
        mainSlider.style.overflow = 'hidden';
    }

    sliderItemsWrapper.innerHTML = '';
    if (thumbsBulletWrapper) thumbsBulletWrapper.innerHTML = '';

    const lastSlideImage = slideImages[slideImages.length - 1];
    const lastSlide = document.createElement('div');
    lastSlide.classList.add('t-slds__item', 't-slds__item-loaded');
    lastSlide.setAttribute('data-slide-index', 0);
    lastSlide.setAttribute('aria-hidden', true);
    lastSlide.innerHTML = `<div class="t-slds__wrapper"><div class="t-slds__imgwrapper t-zoomable" data-zoom-target="0" data-img-zoom-url="${lastSlideImage}" data-zoomable="yes"><div class="t-slds__bgimg t-bgimg" data-original="${lastSlideImage}" style="padding-bottom: 100%; background-image: url('${lastSlideImage}');"></div></div></div>`;
    sliderItemsWrapper.appendChild(lastSlide);

    slideImages.forEach((slideImage, i) => {
        const slide = document.createElement('div');
        slide.classList.add('t-slds__item', 't-slds__item-loaded');
        slide.setAttribute('data-slide-index', i + 1);
        if (i === 0) slide.classList.add('t-slds__item_active');
        slide.innerHTML = `<div class="t-slds__wrapper"><div class="t-slds__imgwrapper t-zoomable" data-zoom-target="${i + 1}" data-img-zoom-url="${slideImage}" data-zoomable="yes"><div class="t-slds__bgimg t-bgimg" data-original="${slideImage}" style="padding-bottom: 100%; background-image: url('${slideImage}');"></div></div></div>`;
        sliderItemsWrapper.appendChild(slide);

        if (thumbsBulletWrapper) {
            const thumbsBullet = document.createElement('div');
            thumbsBullet.classList.add('t-slds__thumbsbullet', 't-slds__bullet');
            thumbsBullet.setAttribute('data-slide-bullet-for', i + 1);
            if (i === 0) thumbsBullet.classList.add('t-slds__bullet_active');
            thumbsBullet.innerHTML = `<div class="t-slds__bgimg t-bgimg" data-original="${slideImage}" style="padding-bottom: 100%; background-image: url('${slideImage}');"></div><div class="t-slds__thumbsbullet-border"></div>`;
            thumbsBulletWrapper.appendChild(thumbsBullet);
        }
    });

    const firstSlideImage = slideImages[0];
    const firstSlide = document.createElement('div');
    firstSlide.classList.add('t-slds__item', 't-slds__item-loaded');
    firstSlide.setAttribute('data-slide-index', slideImages.length + 1);
    firstSlide.setAttribute('aria-hidden', true);
    firstSlide.innerHTML = `<div class="t-slds__wrapper"><div class="t-slds__imgwrapper t-zoomable" data-zoom-target="${slideImages.length + 1}" data-img-zoom-url="${firstSlideImage}" data-zoomable="yes"><div class="t-slds__bgimg t-bgimg" data-original="${firstSlideImage}" style="padding-bottom: 100%; background-image: url('${firstSlideImage}');"></div></div></div>`;
    sliderItemsWrapper.appendChild(firstSlide);

    sliderItemsWrapper.setAttribute('data-slider-totalslides', slideImages.length);
    sliderItemsWrapper.setAttribute('data-slider-pos', 1);

    if (!isInitial) {
        sliderItemsWrapper.style.transform = `translateX(-${currentWidth}px)`;
        setTimeout(() => {
            mainSlider.style.height = '';
            mainSlider.style.width = '';
            mainSlider.style.overflow = '';
        }, 100);
    }

    console.log('[gallery-filter] updateSliderImages: слайдер перестроен успешно,', slideImages.length, 'фото');
}

function applyFilter(isInitial) {
    // у товара нет ни одного alt-тега — это обычный товар, фото не трогаем
    if (!captionImages.length) {
        console.log('[gallery-filter] applyFilter: у товара нет alt-тегов — фото не трогаем');
        return;
    }
    console.log('[gallery-filter] applyFilter вызван, isInitial =', isInitial);
    const images = getImagesForSelection();
    updateSliderImages(images, isInitial);
    console.log('[gallery-filter] currentRecid =', currentRecid, '| t_slds_updateSlider доступна:', typeof t_slds_updateSlider === 'function');
    if (currentRecid && typeof t_slds_updateSlider === 'function') {
        t_slds_updateSlider(currentRecid);
        console.log('[gallery-filter] t_slds_updateSlider вызвана с recid =', currentRecid);
    }
}

document.addEventListener('change', function (e) {
    const scopeRoot = getScopeRoot();
    if (!scopeRoot.contains(e.target)) return; // игнорируем опции ДРУГИХ карточек на странице каталога

    if (e.target.matches(SELECTORS.optionInputs)) {
        console.log('[gallery-filter] change событие на option input:', e.target.name, '=', e.target.value, 'checked =', e.target.checked);
        if (e.target.checked) applyFilter(false);
    } else if (e.target.matches(SELECTORS.optionSelects)) {
        console.log('[gallery-filter] change событие на select:', e.target.value);
        applyFilter(false);
    }
});

// Tilda вешает клики на конкретные миниатюры один раз при инициализации (t_slds_initSliderControls),
// а мы пересоздаём миниатюры — у новых обработчиков нет. Делегируем клик на document.
document.addEventListener('click', function (e) {
    const bullet = e.target.closest('.t-slds__bullet');
    if (!bullet) return;

    const scopeRoot = getScopeRoot();
    if (!scopeRoot.contains(bullet)) return;

    const wrapper = scopeRoot.querySelector(SELECTORS.itemsWrapper);
    if (!wrapper) return;

    const pos = parseInt(bullet.getAttribute('data-slide-bullet-for'), 10);
    // если оригинальный обработчик Tilda уже отработал (миниатюры не пересоздавались) — позиция совпадёт и мы ничего не делаем
    if (isNaN(pos) || parseInt(wrapper.getAttribute('data-slider-pos'), 10) === pos) return;

    const recid = currentRecid || scopeRoot.closest('.t-rec')?.id.replace(/\D/g, '');
    console.log('[gallery-filter] клик по миниатюре →', pos);

    wrapper.setAttribute('data-slider-pos', pos);
    t_slideMoveWithoutAnimation(recid, false);
    t_slds_updateSlider(recid);
});

function isDOMReady() {
    return document.readyState === 'complete' || document.readyState === 'interactive';
}

function initFromDOM(maxAttempts = 5, interval = 1000) {
    let attempts = 0;
    console.log('[gallery-filter] initFromDOM запущен (обычная загрузка страницы)');

    function tryInit() {
        attempts++;
        console.log(`[gallery-filter] initFromDOM: попытка ${attempts}/${maxAttempts}`);

        const container = document.querySelector(SELECTORS.container);
        const slideItems = container ? container.querySelectorAll('.t-slds__item') : [];
        const sliderItemsWrapper = container ? container.querySelector(SELECTORS.itemsWrapper) : null;

        console.log('[gallery-filter] initFromDOM: container найден:', !!container, '| slideItems:', slideItems.length, '| wrapper найден:', !!sliderItemsWrapper);

        if (!container || !slideItems.length || !sliderItemsWrapper) {
            if (attempts < maxAttempts) setTimeout(tryInit, interval);
            else console.log('[gallery-filter] initFromDOM: товар на странице не найден (вероятно каталог) — выходим');
            return;
        }

        const parentId = container.parentNode?.getAttribute('id');
        currentRecid = parentId ? parentId.replace(/\D/g, '') : null;
        console.log('[gallery-filter] initFromDOM: currentRecid =', currentRecid);

        captionImages = buildCaptionImagesFromDOM(Array.from(slideItems));
        if (captionImages.length) {
            applyFilter(true);
            console.log('[gallery-filter] initFromDOM: инициализация завершена успешно');
        } else {
            console.log('[gallery-filter] initFromDOM: у товара нет alt-тегов — товар не обрабатываем');
        }
    }

    if (isDOMReady()) tryInit();
    else document.addEventListener('DOMContentLoaded', tryInit);
}

function initFromPushState(productData) {
    console.log('%c[gallery-filter] initFromPushState вызван', 'color:#06c;font-weight:bold;', productData);

    captionImages = []; // сброс данных предыдущего товара

    const productObj = productData?.productObj;
    if (!productObj?.gallery) {
        console.warn('[gallery-filter] initFromPushState: productObj.gallery отсутствует', productObj);
        return;
    }

    currentRecid = productData.opts?.recid || productData.recid || currentRecid;
    console.log('[gallery-filter] initFromPushState: currentRecid =', currentRecid);

    captionImages = buildCaptionImagesFromGallery(productObj.gallery);
    if (!captionImages.length) {
        console.log('[gallery-filter] initFromPushState: у товара нет alt-тегов — товар не обрабатываем');
        return;
    }

    let attempts = 0;
    const maxAttempts = 20;
    function tryApply() {
        attempts++;
        const scopeRoot = getScopeRoot();
        const sliderItemsWrapper = scopeRoot.querySelector(SELECTORS.itemsWrapper);
        const optionInputsCount = scopeRoot.querySelectorAll(SELECTORS.optionInputs).length;
        console.log(`[gallery-filter] initFromPushState: попытка ${attempts}/${maxAttempts} | wrapper найден: ${!!sliderItemsWrapper} | опций найдено: ${optionInputsCount}`);

        if (!sliderItemsWrapper || !optionInputsCount) {
            if (attempts < maxAttempts) setTimeout(tryApply, 100);
            else console.error('[gallery-filter] initFromPushState: DOM попапа так и не появился за 2 секунды');
            return;
        }

        applyFilter(true);
        console.log('[gallery-filter] initFromPushState: инициализация завершена успешно, товар:', productObj.title);
    }
    tryApply();
}

(function hookHistory() {
    console.log('[gallery-filter] Устанавливаем хук на history.pushState/replaceState');
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    function handle(state) {
        console.log('[gallery-filter] handle() вызван, state:', state);
        if (state?.productData) {
            initFromPushState(state.productData);
        } else {
            console.log('[gallery-filter] handle(): в state нет productData — игнорируем');
        }
    }

    history.pushState = function (state, title, url) {
        console.log('[gallery-filter] history.pushState перехвачен, url:', url);
        const result = origPush.apply(this, arguments);
        handle(state);
        return result;
    };
    history.replaceState = function (state, title, url) {
        console.log('[gallery-filter] history.replaceState перехвачен, url:', url);
        const result = origReplace.apply(this, arguments);
        handle(state);
        return result;
    };
    console.log('[gallery-filter] Хук установлен, history.pushState теперь:', history.pushState);
})();

initFromDOM();
})();
