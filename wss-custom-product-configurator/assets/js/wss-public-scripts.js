jQuery(document).ready(function($) {
    'use strict';

    if (typeof wss_configurator_data === 'undefined' || 
        !wss_configurator_data.product_id ||
        !wss_configurator_data.config_settings ||
        !wss_configurator_data.config_settings.characteristics) {
        return; 
    }

    const productId = wss_configurator_data.product_id;
    const configuratorWrapper = $('#wss-product-configurator-' + productId);
    const imageOrientation = wss_configurator_data.image_orientation || 'vertical';
    
    if (!configuratorWrapper.length) { return; }

    const form = configuratorWrapper.find('form.wss-configurator-form');
    const baseImageElem = $('#wss-configured-product-image-base');
    const priceDisplayContainer = configuratorWrapper.find('.wss-current-price');
    
    const imageColumn = configuratorWrapper.find('.wss-configurator-image-column');
    const optionsColumn = configuratorWrapper.find('.wss-configurator-options-column');
    const mainLayout = configuratorWrapper.find('.wss-configurator-main-layout');
    const productContainer = $('.wss-product-configurator-container');

    let productConfig = wss_configurator_data.config_settings;
    let baseProductPrice = parseFloat(wss_configurator_data.product_base_price);

    let currentSelections = {}; 
    let activeLayers = {};    

    let fixedImageTopPosition = 0; 
    const $siteHeader = $('header.site-header'); 
    const $wpAdminBar = $('#wpadminbar');
    const $tabsWrapper = $('.woocommerce-tabs.wc-tabs-wrapper');

    // INSERISCI QUI LA NUOVA FUNZIONE - DOPO LE VARIABILI E PRIMA DI calculateFixedImageTop
    function calculateRotatedImageDimensions() {
        if (imageOrientation !== 'horizontal') return;
        
        const $container = configuratorWrapper.find('.wss-image-container');
        const $baseImage = $('#wss-configured-product-image-base');
        
        if (!$container.length || !$baseImage.length) return;
        
        const isMobile = $(window).width() < 768;
        const containerWidth = $container.width();
        
        if (isMobile) {
            // Su mobile, lasciamo che il CSS gestisca le proporzioni con aspect-ratio
            // Calcoliamo solo le dimensioni dell'immagine per riempire il contenitore
            const containerHeight = $container.height();
            
            // L'immagine ruotata deve riempire il contenitore 3:1
            const imageWidth = containerHeight;
            const imageHeight = containerWidth;
            
            $baseImage.css({
                'width': imageWidth + 'px',
                'height': imageHeight + 'px'
            });
            
            $container.find('.wss-image-layer-dynamic img').css({
                'width': imageWidth + 'px',
                'height': imageHeight + 'px'
            });
        } else {
            // Desktop: manteniamo il comportamento esistente
            const maxAllowedHeight = $(window).height() * 0.7;
            
            let imageHeight = containerWidth;
            let imageWidth = containerWidth * 0.5;
            
            if (imageWidth > maxAllowedHeight) {
                const scaleFactor = maxAllowedHeight / imageWidth;
                imageWidth = maxAllowedHeight;
                imageHeight = imageHeight * scaleFactor;
            }
            
            $container.css('height', imageWidth + 'px');
            
            $baseImage.css({
                'width': imageWidth + 'px',
                'height': imageHeight + 'px'
            });
            
            $container.find('.wss-image-layer-dynamic img').css({
                'width': imageWidth + 'px',
                'height': imageHeight + 'px'
            });
        }
        
        $container.addClass('wss-dimensions-calculated');
    }

    function calculateFixedImageTop() {
        const adminBarHeight = $wpAdminBar.length && $wpAdminBar.is(':visible') ? $wpAdminBar.outerHeight() : 0;
        let siteHeaderHeight = 0;
        if ($siteHeader.length && $siteHeader.is(':visible')) {
            let isHeaderEffectivelyFixed = ($siteHeader.css('position') === 'fixed' || $siteHeader.css('position') === 'sticky');
            if (isHeaderEffectivelyFixed && $siteHeader.offset().top <= $(window).scrollTop() + adminBarHeight) {
                 siteHeaderHeight = $siteHeader.outerHeight();
            } else if (!isHeaderEffectivelyFixed && $(window).scrollTop() < $siteHeader.outerHeight()) { 
                siteHeaderHeight = $siteHeader.outerHeight() - $(window).scrollTop();
                if (siteHeaderHeight < 0) siteHeaderHeight = 0;
            }
        }
        fixedImageTopPosition = adminBarHeight + siteHeaderHeight;
    }
    
    function getActualImageColumnWidthFromCSS() {
        if (imageOrientation === 'horizontal') {
            return '100%'; // Per orientamento orizzontale, sempre 100%
        }
        
        const originalInlineStyle = imageColumn.attr('style') || "";
        imageColumn.css('width', ''); 
        
        let widthValueFromCSS = imageColumn.css('width'); 
        let calculatedWidthInPx;

        if (widthValueFromCSS.includes('%') && mainLayout.length && mainLayout.width() > 0) {
            const percentage = parseFloat(widthValueFromCSS) / 100;
            calculatedWidthInPx = mainLayout.width() * percentage;
        } else if (widthValueFromCSS) {
            calculatedWidthInPx = parseFloat(widthValueFromCSS);
        } else {
            if (mainLayout.length && mainLayout.width() > 0) {
                 calculatedWidthInPx = mainLayout.width() * ($(window).width() < 1200 && $(window).width() >=768 ? 0.4 : 0.5); 
            } else {
                calculatedWidthInPx = 300; 
            }
        }
        
        const maxWidthFromCSS = imageColumn.css('max-width');
        if (maxWidthFromCSS && maxWidthFromCSS !== 'none' && maxWidthFromCSS.includes('px')) {
            const maxWidthPx = parseFloat(maxWidthFromCSS);
            if (calculatedWidthInPx > maxWidthPx) {
                calculatedWidthInPx = maxWidthPx;
            }
        }
        imageColumn.attr('style', originalInlineStyle); 
        return calculatedWidthInPx;
    }

    let initialLayoutAdjusted = false; 

    function adjustLayout(isInitialCall = false) {
        if (!mainLayout.length || !imageColumn.length || !optionsColumn.length) return;

        const windowWidth = $(window).width();
        calculateFixedImageTop(); 

        if (imageOrientation === 'horizontal') {
            // Layout orizzontale
            if (windowWidth >= 768) {
                // Desktop orizzontale
                imageColumn.css({
                    'position': 'relative',
                    'width': '100%',
                    'height': 'auto',
                    'left': '',
                    'top': '',
                    'padding': '0'
                });

                optionsColumn.css({
                    'margin-left': '',
                    'width': '100%',
                    'min-height': '',
                    'position': 'relative',
                    'top': '',
                    'height': 'auto',
                    'padding-top': ''
                });
                
                // AGGIUNGI QUESTA CHIAMATA DOPO AVER IMPOSTATO IL LAYOUT
                setTimeout(calculateRotatedImageDimensions, 50);
            } else {
                // Mobile orizzontale
                imageColumn.css({ 
                    'position': 'relative',
                    'left': '',
                    'top': '',
                    'width': '100%',
                    'height': '',
                    'margin-left': '',
                    'max-width': 'none'
                });
                optionsColumn.css({
                    'margin-left': '',
                    'width': '100%',
                    'min-height': '',
                    'height': 'auto',
                    'padding-top': ''
                });
                
                // AGGIUNGI ANCHE QUI PER MOBILE
                setTimeout(calculateRotatedImageDimensions, 50);
            }
        } else {
            // Layout verticale (comportamento originale)
            if (windowWidth >= 768) { 
                const mainLayoutOffsetLeft = mainLayout.offset().left;
                const imageColumnTargetWidthPx = getActualImageColumnWidthFromCSS();
                
                if (imageColumnTargetWidthPx > 0) { 
                    imageColumn.css({
                        'left': mainLayoutOffsetLeft + 'px',
                        'top': fixedImageTopPosition + 'px',
                        'width': imageColumnTargetWidthPx + 'px', 
                        'height': `calc(100vh - ${fixedImageTopPosition}px - 20px)`,
                    });

                    optionsColumn.css({
                        'margin-left': imageColumnTargetWidthPx + 'px',
                        'width': `calc(100% - ${imageColumnTargetWidthPx}px)`, 
                        'min-height': `calc(100vh - ${fixedImageTopPosition}px - 20px)`, 
                        'position': 'relative', 'top': '', 'height': 'auto',
                        'padding-top': ''
                    });
                } else if (isInitialCall) {
                    setTimeout(function() { adjustLayout(true); }, 350); 
                    return; 
                }
                
            } else { // Mobile
                imageColumn.css({ 
                    'position': 'relative', 'left': '', 'top': '',
                    'width': '100%', 'height': '',
                    'margin-left': '', 'max-width': 'none'
                });
                optionsColumn.css({
                    'margin-left': '', 'width': '100%',
                    'min-height': '', 'height': 'auto',
                    'padding-top': ''
                });
            }
        }
        
        if (isInitialCall) {
            initialLayoutAdjusted = true;
        }
    }

    let lastKnownImageColumnWidthForAbsolute = 0; 

    function handleScrollDesktop() {
        if (!imageColumn.length || !optionsColumn.length || !mainLayout.length) return;
        if ($(window).width() < 768 || !initialLayoutAdjusted) return; 

        calculateFixedImageTop(); 
        const scrollTop = $(window).scrollTop();
        
        if (imageOrientation === 'horizontal') {
            // Comportamento scroll per orientamento orizzontale
            const imageColumnOriginalOffset = mainLayout.offset().top;
            const imageColumnHeight = imageColumn.outerHeight();
            
            if (scrollTop > imageColumnOriginalOffset - fixedImageTopPosition) {
                // Fissa l'immagine
                productContainer.addClass('wss-image-fixed');
                imageColumn.css({
                    'position': 'fixed',
                    'top': fixedImageTopPosition + 'px',
                    'left': '0',
                    'right': '0',
                    'width': '100%',
                    'z-index': '1000'
                });
                
                // Aggiungi padding-top alle opzioni per compensare
                optionsColumn.css('padding-top', imageColumnHeight + 'px');
            } else {
                // Rimuovi fixed
                productContainer.removeClass('wss-image-fixed');
                imageColumn.css({
                    'position': 'relative',
                    'top': '',
                    'left': '',
                    'right': '',
                    'width': '100%',
                    'z-index': ''
                });
                optionsColumn.css('padding-top', '');
            }
        } else {
            // Comportamento originale per orientamento verticale
            const mainLayoutOffsetTop = mainLayout.offset().top;
            const tabsOffsetTop = $tabsWrapper.length ? $tabsWrapper.offset().top : $(document).height();
            const imageColumnHeight = imageColumn.outerHeight();
            
            const targetImageContentWidth = getActualImageColumnWidthFromCSS();
            const imageColumnLeftPosition = mainLayout.offset().left + 'px';

            const unstickPoint = tabsOffsetTop - imageColumnHeight - fixedImageTopPosition - 20; 
            const restickPoint = mainLayoutOffsetTop - fixedImageTopPosition; 
            
            const currentImageColumnPosition = imageColumn.css('position');

            if (currentImageColumnPosition === 'fixed') {
                lastKnownImageColumnWidthForAbsolute = imageColumn.width(); 
                
                if (Math.abs(imageColumn.width() - targetImageContentWidth) > 1) {
                    imageColumn.css('width', targetImageContentWidth + 'px');
                }
                if (imageColumn.css('left') !== imageColumnLeftPosition) {
                    imageColumn.css('left', imageColumnLeftPosition);
                }
                if (imageColumn.css('top') !== fixedImageTopPosition + 'px') {
                    imageColumn.css('top', fixedImageTopPosition + 'px');
                }
                const targetHeightFixed = `calc(100vh - ${fixedImageTopPosition}px - 20px)`;
                if(imageColumn.css('height') !== targetHeightFixed) {
                    imageColumn.css('height', targetHeightFixed);
                }
            }

            if (scrollTop > unstickPoint && unstickPoint > restickPoint) { 
                if (currentImageColumnPosition !== 'absolute') { 
                    if (lastKnownImageColumnWidthForAbsolute === 0 || Math.abs(imageColumn.width() - lastKnownImageColumnWidthForAbsolute) > 1) {
                        lastKnownImageColumnWidthForAbsolute = imageColumn.width();
                    }
                    imageColumn.css({
                        'position': 'absolute',
                        'top': (tabsOffsetTop - mainLayoutOffsetTop - imageColumnHeight - 20) + 'px',
                        'left': '0px', 
                        'width': lastKnownImageColumnWidthForAbsolute + 'px', 
                        'height': imageColumnHeight + 'px' 
                    });
                } else { 
                     if (Math.abs(imageColumn.width() - lastKnownImageColumnWidthForAbsolute) > 1) {
                        imageColumn.css('width', lastKnownImageColumnWidthForAbsolute + 'px');
                     }
                }
            } else { 
                if (currentImageColumnPosition !== 'fixed') { 
                    imageColumn.css({
                        'position': 'fixed',
                        'top': fixedImageTopPosition + 'px',
                        'left': imageColumnLeftPosition,
                        'width': targetImageContentWidth + 'px', 
                        'height': `calc(100vh - ${fixedImageTopPosition}px - 20px)`
                    });
                } 
            }
        }
    }
    
    function handleScrollMobile() {
        if (!imageColumn.length || !mainLayout.length) return;
        if ($(window).width() >= 768 || !initialLayoutAdjusted) { 
            if ($(window).width() >= 768 && initialLayoutAdjusted) {
                imageColumn.css({'height': '', 'max-height': '', 'min-height': ''}); 
                optionsColumn.css({'padding-top': ''});
                adjustLayout(); 
                handleScrollDesktop(); 
            }
            return;
        }

        const scrollTop = $(window).scrollTop();
        const adminBarHeight = $wpAdminBar.length && $wpAdminBar.is(':visible') ? $wpAdminBar.outerHeight() : 0;
        const mobileFixedTop = adminBarHeight; 
        const imageColumnNaturalTopInDocument = mainLayout.offset().top; 
        const tabsOffsetTop = $tabsWrapper.length ? $tabsWrapper.offset().top : $(document).height();
        
        // Per layout orizzontale, usa l'altezza effettiva del contenitore
        let imageEffectiveHeightForCalc;
        if (imageOrientation === 'horizontal') {
            imageEffectiveHeightForCalc = imageColumn.find('.wss-image-container').outerHeight();
        } else {
            imageEffectiveHeightForCalc = parseFloat(imageColumn.css('height'));
            if (isNaN(imageEffectiveHeightForCalc) || imageEffectiveHeightForCalc <=0 ) {
                imageEffectiveHeightForCalc = $(window).height() * 0.6;
            }
        }

        const stickTriggerPoint = imageColumnNaturalTopInDocument - mobileFixedTop;
        const unstickTriggerPoint = tabsOffsetTop - imageEffectiveHeightForCalc - mobileFixedTop - 20;

        imageColumn.css({'max-width': 'none'}); 

        if (scrollTop > stickTriggerPoint) { 
            optionsColumn.css('padding-top', imageEffectiveHeightForCalc + 'px');

            if (scrollTop > unstickTriggerPoint && unstickTriggerPoint > 0) { 
                imageColumn.css({
                    'position': 'absolute',
                    'top': (tabsOffsetTop - imageColumnNaturalTopInDocument - imageEffectiveHeightForCalc - 20) + 'px',
                    'left': '0', 'width': '100%', 'z-index': '10',
                    'height': imageOrientation === 'horizontal' ? 'auto' : imageEffectiveHeightForCalc + 'px', 
                });
            } else { 
                imageColumn.css({
                    'position': 'fixed', 'top': mobileFixedTop + 'px',
                    'left': mainLayout.offset().left + 'px', 
                    'width': mainLayout.width() + 'px',    
                    'height': imageOrientation === 'horizontal' ? 'auto' : imageEffectiveHeightForCalc + 'px', 
                    'z-index': '1000' 
                });
            }
        } else { 
            optionsColumn.css('padding-top', '');
            imageColumn.css({
                'position': 'relative', 'top': '', 'left': '', 'width': '100%', 'z-index': '10',
                'height': '',
                'max-height': '' 
            });
        }
    }

    // --- Funzioni Core ---
    function initializeConfigurator() {
        if (!productConfig || !productConfig.characteristics) { return; }
        productConfig.characteristics.forEach(char => { 
            const charSlug = char.slug; const $optionsGroup = form.find('#wss-char-group-' + charSlug);
            if (char.type === 'radio') { const $checkedRadio = $optionsGroup.find('input[type="radio"]:checked'); if ($checkedRadio.length) { currentSelections[charSlug] = $checkedRadio.val(); } } 
            else if (char.type === 'select') { const $select = $optionsGroup.find('select.wss-option-selector'); const selectedValue = $select.val(); if (selectedValue && selectedValue !== '') { currentSelections[charSlug] = selectedValue; } } 
            else if (char.type === 'checkbox') { currentSelections[charSlug] = []; $optionsGroup.find('input[type="checkbox"]:checked').each(function() { currentSelections[charSlug].push($(this).val()); }); }
        });
        applyAllDependencies(); 
        updateConfigurationState(); 
    }
    
    form.on('change', 'input.wss-option-selector, select.wss-option-selector', function(event) {
        const $selectedElement = $(this); const $characteristicGroup = $selectedElement.closest('.wss-characteristic-group'); const charSlug = $characteristicGroup.data('char-slug');
        const characteristicDefinition = productConfig.characteristics.find(c => c.slug === charSlug); if (!characteristicDefinition) return; const charType = characteristicDefinition.type;
        if (charType === 'checkbox') { currentSelections[charSlug] = []; $characteristicGroup.find('input[type="checkbox"].wss-option-selector:checked').each(function() { if (!$(this).closest('.wss-option-item').hasClass('wss-element-hidden')) { currentSelections[charSlug].push($(this).val()); } }); } 
        else { if ($selectedElement.is('select') && ($selectedElement.find('option:selected').hasClass('wss-element-hidden') || $selectedElement.val() === '')) { currentSelections[charSlug] = ''; } else if ($selectedElement.is('input[type="radio"]') && $selectedElement.closest('.wss-option-item').hasClass('wss-element-hidden')) { currentSelections[charSlug] = ''; } else { currentSelections[charSlug] = $selectedElement.val(); } }
        applyAllDependencies(); updateConfigurationState();
    });
    
    function updateConfigurationState() { 
        let currentTotalPrice = baseProductPrice; activeLayers = {}; 
        let currentBaseImageUrl = (productConfig && productConfig.base_image_default) ? productConfig.base_image_default : (wss_configurator_data.placeholder_image_url || '');
        if (!productConfig || !productConfig.characteristics) return;
        productConfig.characteristics.forEach(char => {
            const charSlug = char.slug; const selectedValueOrValues = currentSelections[charSlug]; 
            if (selectedValueOrValues && selectedValueOrValues.length > 0) { 
                const processOption = (optValue) => {
                    const optionData = findOptionData(charSlug, optValue); 
                    if (optionData) { if (optionData.price_adjustment) { currentTotalPrice += parseFloat(optionData.price_adjustment); }
                        if (char.has_visual_impact) { if (char.is_base_switcher) { if (optionData.layer_image) { if (productConfig && productConfig[optionData.layer_image]) { currentBaseImageUrl = productConfig[optionData.layer_image]; } else { currentBaseImageUrl = optionData.layer_image; } } } 
                        else { if (optionData.layer_image) { activeLayers[charSlug + '_' + optValue] = { url: optionData.layer_image, z_index: optionData.layer_z_index || 1 }; } } } } };
                if (Array.isArray(selectedValueOrValues)) { selectedValueOrValues.forEach(optValue => processOption(optValue)); } else { processOption(selectedValueOrValues); } } });
        updatePriceDisplay(currentTotalPrice); updateProductImage(currentBaseImageUrl, activeLayers);
    }
    
    function findOptionData(charSlug, optValue) { if (!productConfig || !productConfig.characteristics) return null; const characteristic = productConfig.characteristics.find(c => c.slug === charSlug); if (characteristic && characteristic.options) { return characteristic.options.find(opt => String(opt.value) === String(optValue)); } return null; }
    
    function updatePriceDisplay(newPrice) { if (!priceDisplayContainer.length) { return; } if (typeof wss_configurator_data === 'undefined' || typeof wss_configurator_data.wc_price_args === 'undefined' || typeof wss_configurator_data.wc_price_args.currency_symbol === 'undefined' || typeof wss_configurator_data.wc_price_args.decimal_separator === 'undefined' || typeof wss_configurator_data.wc_price_args.thousand_separator === 'undefined' || typeof wss_configurator_data.wc_price_args.decimals === 'undefined') { priceDisplayContainer.html(`<p class="price"><span class="woocommerce-Price-amount amount">${Number(newPrice).toFixed(2)}</span></p>`); return; } const args = wss_configurator_data.wc_price_args; const priceHtml = `<p class="price"><span class="woocommerce-Price-amount amount"><bdi>${formatPriceNumber(newPrice, args)}</bdi></span><span class="woocommerce-Price-currencySymbol">${args.currency_symbol}</span></p>`; priceDisplayContainer.html(priceHtml); }
    
    function formatPriceNumber(number, args) { const num = Number(number); const decimals = args.decimals || 2; const decPoint = args.decimal_separator || '.'; const thousandsSep = args.thousand_separator || ','; let n = !isFinite(num) ? 0 : num; let prec = !isFinite(decimals) ? 0 : Math.abs(decimals); let toFixedFix = function (val, precision) { let k = Math.pow(10, precision); return '' + (Math.round(val * k) / k).toFixed(precision); }; let s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.'); if (s[0].length > 3) { s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, thousandsSep); } if ((s[1] || '').length < prec) { s[1] = s[1] || ''; s[1] += new Array(prec - s[1].length + 1).join('0'); } return s.join(decPoint); }
    
    function updateProductImage(baseImageUrl, layers) { 
        if (baseImageElem.attr('src') !== baseImageUrl) { 
            baseImageElem.attr('src', baseImageUrl || wss_configurator_data.placeholder_image_url || ''); 
        } 
        
        configuratorWrapper.find('.wss-image-layer-dynamic').remove(); 
        const imageContainer = baseImageElem.parent(); 
        
        if (layers && typeof layers === 'object' && Object.keys(layers).length > 0) { 
            const sortedLayers = Object.entries(layers).map(([slug, data]) => ({ slug, ...data })).sort((a, b) => (parseInt(a.z_index) || 0) - (parseInt(b.z_index) || 0)); 
            sortedLayers.forEach(layer => { 
                if (layer.url) { 
                    const $layerDiv = $('<div>').addClass('wss-image-layer-dynamic').css('z-index', layer.z_index || 1); 
                    const $layerImg = $('<img>').attr('src', layer.url).attr('alt', 'Layer ' + layer.slug); 
                    $layerDiv.append($layerImg); 
                    imageContainer.append($layerDiv); 
                } 
            }); 
        }
        
        // AGGIUNGI QUESTA CHIAMATA QUANDO L'IMMAGINE CAMBIA
        if (imageOrientation === 'horizontal') {
            setTimeout(calculateRotatedImageDimensions, 100);
        }
    }
    
    function applyAllDependencies() { let changedByDependency = false; form.find('.wss-option-item, option[data-dependency-char]').each(function() { const $optionElement = $(this); const depCharSlug = $optionElement.data('dependency-char'); const depOptValue = String($optionElement.data('dependency-val')); if (depCharSlug && typeof $optionElement.data('dependency-val') !== 'undefined') { let isDependencyMet = false; const actualSelectedValueForDepChar = currentSelections[depCharSlug]; if (typeof actualSelectedValueForDepChar !== 'undefined' && actualSelectedValueForDepChar !== null && actualSelectedValueForDepChar !== '') { if (Array.isArray(actualSelectedValueForDepChar)) { if (actualSelectedValueForDepChar.includes(depOptValue)) { isDependencyMet = true; } } else { if (String(actualSelectedValueForDepChar) === depOptValue) { isDependencyMet = true; } } } const wasPreviouslyHidden = $optionElement.hasClass('wss-element-hidden'); if (isDependencyMet) { if(wasPreviouslyHidden) { $optionElement.removeClass('wss-element-hidden'); changedByDependency = true; } if ($optionElement.is('option')) $optionElement.prop('disabled', false); } else { if(!wasPreviouslyHidden) { $optionElement.addClass('wss-element-hidden'); changedByDependency = true; } else { $optionElement.addClass('wss-element-hidden'); } if ($optionElement.is('option')) { $optionElement.prop('disabled', true); if ($optionElement.is(':selected')) { $optionElement.parent('select').val(''); } } else if ($optionElement.find('input.wss-option-selector').is(':checked')) { $optionElement.find('input.wss-option-selector').prop('checked', false); const checkboxCharSlug = $optionElement.closest('.wss-characteristic-group').data('char-slug'); const checkboxValue = $optionElement.find('input.wss-option-selector').val(); if (currentSelections[checkboxCharSlug]) { if (Array.isArray(currentSelections[checkboxCharSlug])) { currentSelections[checkboxCharSlug] = currentSelections[checkboxCharSlug].filter(v => v !== checkboxValue); } else if (currentSelections[checkboxCharSlug] === checkboxValue) { currentSelections[checkboxCharSlug] = ''; } } } } } }); return changedByDependency; }
    
    if (configuratorWrapper.length && productConfig && productConfig.characteristics) {
        initializeConfigurator(); 
        
        // AGGIUNGI QUESTO EVENT LISTENER PER QUANDO L'IMMAGINE BASE VIENE CARICATA
        baseImageElem.on('load', function() {
            if (imageOrientation === 'horizontal') {
                calculateRotatedImageDimensions();
            }
        });
        
        $(window).on('load', function() {
            setTimeout(function() { 
                adjustLayout(true); 
                if ($(window).width() >= 768) { handleScrollDesktop(); } else { handleScrollMobile(); }
                
                setTimeout(function() { 
                    adjustLayout(true);
                    if ($(window).width() >= 768) { handleScrollDesktop(); } else { handleScrollMobile(); }
                }, 400); 
            }, 150); 
        });
        
        let resizeTimer;
        $(window).on('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                adjustLayout(true); 
                if ($(window).width() >= 768) { handleScrollDesktop(); } else { handleScrollMobile(); }
                // AGGIUNGI QUESTA CHIAMATA AL RESIZE
                if (imageOrientation === 'horizontal') {
                    calculateRotatedImageDimensions();
                }
            }, 150); 
        });

        let scrollTimer; 
        $(window).on('scroll', function() {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function() {
                if ($(window).width() >= 768) {
                    handleScrollDesktop();
                } else {
                    handleScrollMobile();
                }
            }, 30); 
        });
    }
});