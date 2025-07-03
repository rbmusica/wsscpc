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
    const $descriptionFull = $('.wss-configurator-description-full');

    // **NUOVE VARIABILI PER GESTIRE LO STATO**
    let layoutInitialized = false;
    let isAdjusting = false;
    let adjustLayoutTimer = null;
	let scrollTimer = null;

    let frozenTriggerPoints = null;
    let isStickyActive = false;
	
    function calculateRotatedImageDimensions() {
        if (imageOrientation !== 'horizontal') return;
        
        const $container = configuratorWrapper.find('.wss-image-container');
        const $baseImage = $('#wss-configured-product-image-base');
        
        if (!$container.length || !$baseImage.length) return;
        
        const isMobile = $(window).width() < 768;
        const containerWidth = $container.width();
        
        if (isMobile) {
            const containerHeight = $container.height();
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
        
        // **CORREZIONE**: Calcolo più preciso dell'header
        if ($siteHeader.length && $siteHeader.is(':visible')) {
            const headerPosition = $siteHeader.css('position');
            const isHeaderFixed = (headerPosition === 'fixed' || headerPosition === 'sticky');
            
            if (isHeaderFixed) {
                siteHeaderHeight = $siteHeader.outerHeight();
            } else {
                const scrollTop = $(window).scrollTop();
                const headerBottom = $siteHeader.offset().top + $siteHeader.outerHeight();
                if (headerBottom > scrollTop) {
                    siteHeaderHeight = Math.max(0, headerBottom - scrollTop);
                }
            }
        }
        
        // **CORREZIONE**: Considera anche la descrizione full-width
        let descriptionHeight = 0;
        if (imageOrientation === 'vertical' && $descriptionFull.length && $descriptionFull.is(':visible')) {
            descriptionHeight = $descriptionFull.outerHeight();
        }
        
        fixedImageTopPosition = adminBarHeight + siteHeaderHeight;
        return { fixedImageTopPosition, descriptionHeight };
    }
    
    function getActualImageColumnWidthFromCSS() {
        if (imageOrientation === 'horizontal') {
            return '100%';
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

    // **FUNZIONE PRINCIPALE CORRETTA**
    function adjustLayout(isInitialCall = false) {
        // **PREVENZIONE RACE CONDITIONS**
        if (isAdjusting && !isInitialCall) {
            return;
        }
        
        isAdjusting = true;
        
        if (!mainLayout.length || !imageColumn.length || !optionsColumn.length) {
            isAdjusting = false;
            return;
        }

        const windowWidth = $(window).width();
        const { fixedImageTopPosition: topPos, descriptionHeight } = calculateFixedImageTop();
        fixedImageTopPosition = topPos;

        if (imageOrientation === 'horizontal') {
            // Layout orizzontale (invariato)
            if (windowWidth >= 768) {
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
                
                setTimeout(calculateRotatedImageDimensions, 50);
            } else {
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
                
                setTimeout(calculateRotatedImageDimensions, 50);
            }
        } else {
            // **LAYOUT VERTICALE CORRETTO**
            if (windowWidth >= 768) { 
                // **ASPETTA CHE TUTTI GLI ELEMENTI SIANO MISURABILI**
                const mainLayoutOffset = mainLayout.offset();
                if (!mainLayoutOffset || mainLayoutOffset.top === 0) {
                    if (isInitialCall) {
                        setTimeout(() => adjustLayout(true), 100);
                    }
                    isAdjusting = false;
                    return;
                }
                
                const mainLayoutOffsetLeft = mainLayoutOffset.left;
                const imageColumnTargetWidthPx = getActualImageColumnWidthFromCSS();
                
                if (imageColumnTargetWidthPx > 0) { 
                    // **CORREZIONE**: Considera la descrizione nel calcolo dell'altezza
                    const availableHeight = `calc(100vh - ${fixedImageTopPosition}px - 20px)`;
                    
                    imageColumn.css({
                        'position': 'relative', // **INIZIA SEMPRE COME RELATIVE**
                        'left': '',
                        'top': '',
                        'width': imageColumnTargetWidthPx + 'px', 
                        'height': availableHeight,
                        'max-width': 'none'
                    });

                    optionsColumn.css({
                        'margin-left': imageColumnTargetWidthPx + 'px',
                        'width': `calc(100% - ${imageColumnTargetWidthPx}px)`, 
                        'min-height': availableHeight, 
                        'position': 'relative', 
                        'top': '', 
                        'height': 'auto',
                        'padding-top': ''
                    });
                } else if (isInitialCall) {
                    setTimeout(() => adjustLayout(true), 200); 
                    isAdjusting = false;
                    return; 
                }
                
            } else { // Mobile
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
            }
        }
        
        if (isInitialCall) {
            layoutInitialized = true;
        }
        
        isAdjusting = false;
    }

    let lastKnownImageColumnWidthForAbsolute = 0; 

	function handleScrollDesktop() {
        if (!imageColumn.length || !optionsColumn.length || !mainLayout.length) return;
        if ($(window).width() < 768 || !layoutInitialized) return; 

        const { fixedImageTopPosition: topPos, descriptionHeight } = calculateFixedImageTop();
        fixedImageTopPosition = topPos;
        const scrollTop = $(window).scrollTop();
        
        // **DEBUG MIGLIORATO**
        console.log('WSS Debug: handleScrollDesktop called', {
            scrollTop: scrollTop,
            fixedImageTopPosition: fixedImageTopPosition,
            descriptionHeight: descriptionHeight,
            imageOrientation: imageOrientation,
            isStickyActive: isStickyActive
        });
        
        if (imageOrientation === 'horizontal') {
            // Comportamento scroll per orientamento orizzontale (invariato)
            const imageColumnOriginalOffset = mainLayout.offset().top;
            const imageColumnHeight = imageColumn.outerHeight();
            
            if (scrollTop > imageColumnOriginalOffset - fixedImageTopPosition) {
                productContainer.addClass('wss-image-fixed');
                imageColumn.css({
                    'position': 'fixed',
                    'top': fixedImageTopPosition + 'px',
                    'left': '0',
                    'right': '0',
                    'width': '100%',
                    'z-index': '1000'
                });
                
                optionsColumn.css('padding-top', imageColumnHeight + 'px');
            } else {
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
            // **COMPORTAMENTO VERTICALE CON TRIGGER POINTS CONGELATI**
            
            // **CALCOLA I TRIGGER POINTS SOLO SE NON SONO CONGELATI**
            if (!frozenTriggerPoints || !isStickyActive) {
                const mainLayoutOffsetTop = mainLayout.offset().top;
                const tabsOffsetTop = $tabsWrapper.length ? $tabsWrapper.offset().top : $(document).height();
                const baseImageContainer = imageColumn.find('.wss-image-container');
                const imageContainerTop = baseImageContainer.offset() ? baseImageContainer.offset().top : mainLayoutOffsetTop;
                
                const stickyTriggerPoint = imageContainerTop - fixedImageTopPosition;
                const optionsColumnHeight = optionsColumn[0].scrollHeight;
                const viewportHeight = $(window).height() - fixedImageTopPosition;
                
                let unstickyTriggerPoint = tabsOffsetTop - viewportHeight - 50;
                const needsInternalScroll = optionsColumnHeight > viewportHeight;
                
                if (needsInternalScroll) {
                    const maxInternalScroll = optionsColumnHeight - viewportHeight;
                    unstickyTriggerPoint = stickyTriggerPoint + maxInternalScroll + viewportHeight + 100;
                }
                
                if (unstickyTriggerPoint <= stickyTriggerPoint) {
                    unstickyTriggerPoint = stickyTriggerPoint + viewportHeight + 200;
                }
                
                // **CONGELA I TRIGGER POINTS**
                frozenTriggerPoints = {
                    stickyTriggerPoint: stickyTriggerPoint,
                    unstickyTriggerPoint: unstickyTriggerPoint,
                    viewportHeight: viewportHeight,
                    optionsColumnHeight: optionsColumnHeight,
                    needsInternalScroll: needsInternalScroll
                };
                
                console.log('WSS Debug: Trigger calculations (FROZEN)', {
                    stickyTriggerPoint: stickyTriggerPoint,
                    unstickyTriggerPoint: unstickyTriggerPoint,
                    scrollTop: scrollTop,
                    needsSticky: scrollTop > stickyTriggerPoint,
                    shouldBeSticky: scrollTop > stickyTriggerPoint && scrollTop < unstickyTriggerPoint,
                    viewportHeight: viewportHeight,
                    optionsColumnHeight: optionsColumnHeight,
                    needsInternalScroll: needsInternalScroll
                });
            }
            
            // **USA I TRIGGER POINTS CONGELATI**
            const triggerData = frozenTriggerPoints;
            
            // **GESTIONE STATI CON TRIGGER STABILI**
            if (scrollTop > triggerData.stickyTriggerPoint && scrollTop < triggerData.unstickyTriggerPoint) {
                console.log('WSS Debug: Should be sticky');
                
                // **STATO STICKY**
                if (!isStickyActive) {
                    console.log('WSS Debug: Activating sticky mode');
                    isStickyActive = true;
                    
                    productContainer.addClass('wss-sticky-container');
                    
                    if (!$('.wss-sticky-spacer').length) {
                        productContainer.after('<div class="wss-sticky-spacer"></div>');
                    }
                    
                    mainLayout.css({
                        'position': 'fixed',
                        'top': fixedImageTopPosition + 'px',
                        'left': '0',
                        'right': '0',
                        'width': '100%',
                        'height': `calc(100vh - ${fixedImageTopPosition}px)`,
                        'z-index': '1000',
                        'background': '#fff'
                    });
                    
                    imageColumn.css({
                        'position': 'relative',
                        'top': '',
                        'left': '',
                        'width': '',
                        'height': '',
                        'margin-left': ''
                    });
                    
                    optionsColumn.css({
                        'position': 'relative',
                        'top': '',
                        'margin-left': '',
                        'width': '',
                        'height': '',
                        'overflow-y': 'auto',
                        'min-height': ''
                    });
                }
                
                // **GESTIONE SCROLL INTERNO**
                if (triggerData.needsInternalScroll) {
                    const internalScrollProgress = scrollTop - triggerData.stickyTriggerPoint;
                    const maxInternalScroll = triggerData.optionsColumnHeight - triggerData.viewportHeight + 40;
                    const clampedInternalScroll = Math.min(internalScrollProgress, maxInternalScroll);
                    
                    optionsColumn.scrollTop(clampedInternalScroll);
                }
                
            } else if (scrollTop >= triggerData.unstickyTriggerPoint) {
                console.log('WSS Debug: Should unstick (bottom)');
                
                if (isStickyActive) {
                    isStickyActive = false;
                    frozenTriggerPoints = null; // **RESET TRIGGER POINTS**
                    
                    productContainer.removeClass('wss-sticky-container');
                    $('.wss-sticky-spacer').remove();
                    
                    const finalTopPosition = triggerData.unstickyTriggerPoint - triggerData.stickyTriggerPoint + triggerData.viewportHeight;
                    
                    mainLayout.css({
                        'position': 'absolute',
                        'top': finalTopPosition + 'px',
                        'left': '0',
                        'right': '',
                        'width': '100%',
                        'height': 'auto',
                        'z-index': ''
                    });
                    
                    optionsColumn.scrollTop(optionsColumn[0].scrollHeight);
                }
                
            } else {
                console.log('WSS Debug: Should be normal (before sticky)');
                
                if (isStickyActive) {
                    isStickyActive = false;
                    frozenTriggerPoints = null; // **RESET TRIGGER POINTS**
                    
                    productContainer.removeClass('wss-sticky-container');
                    $('.wss-sticky-spacer').remove();
                    
                    mainLayout.css({
                        'position': '',
                        'top': '',
                        'left': '',
                        'right': '',
                        'width': '',
                        'height': '',
                        'z-index': '',
                        'background': ''
                    });
                    
                    adjustLayout();
                    optionsColumn.scrollTop(0);
                }
            }
        }
    }
    
    function handleScrollMobile() {
        if (!imageColumn.length || !mainLayout.length) return;
        if ($(window).width() >= 768 || !layoutInitialized) { 
            if ($(window).width() >= 768 && layoutInitialized) {
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
                'max-width': '' 
            });
        }
    }

    // **DEBOUNCED ADJUST LAYOUT**
    function debouncedAdjustLayout(isInitial = false) {
        clearTimeout(adjustLayoutTimer);
        adjustLayoutTimer = setTimeout(() => {
            adjustLayout(isInitial);
        }, isInitial ? 50 : 150);
    }

    // --- Funzioni Core (invariate) ---
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
        
        if (imageOrientation === 'horizontal') {
            setTimeout(calculateRotatedImageDimensions, 100);
        }
    }
    
    function applyAllDependencies() { let changedByDependency = false; form.find('.wss-option-item, option[data-dependency-char]').each(function() { const $optionElement = $(this); const depCharSlug = $optionElement.data('dependency-char'); const depOptValue = String($optionElement.data('dependency-val')); if (depCharSlug && typeof $optionElement.data('dependency-val') !== 'undefined') { let isDependencyMet = false; const actualSelectedValueForDepChar = currentSelections[depCharSlug]; if (typeof actualSelectedValueForDepChar !== 'undefined' && actualSelectedValueForDepChar !== null && actualSelectedValueForDepChar !== '') { if (Array.isArray(actualSelectedValueForDepChar)) { if (actualSelectedValueForDepChar.includes(depOptValue)) { isDependencyMet = true; } } else { if (String(actualSelectedValueForDepChar) === depOptValue) { isDependencyMet = true; } } } const wasPreviouslyHidden = $optionElement.hasClass('wss-element-hidden'); if (isDependencyMet) { if(wasPreviouslyHidden) { $optionElement.removeClass('wss-element-hidden'); changedByDependency = true; } if ($optionElement.is('option')) $optionElement.prop('disabled', false); } else { if(!wasPreviouslyHidden) { $optionElement.addClass('wss-element-hidden'); changedByDependency = true; } else { $optionElement.addClass('wss-element-hidden'); } if ($optionElement.is('option')) { $optionElement.prop('disabled', true); if ($optionElement.is(':selected')) { $optionElement.parent('select').val(''); } } else if ($optionElement.find('input.wss-option-selector').is(':checked')) { $optionElement.find('input.wss-option-selector').prop('checked', false); const checkboxCharSlug = $optionElement.closest('.wss-characteristic-group').data('char-slug'); const checkboxValue = $optionElement.find('input.wss-option-selector').val(); if (currentSelections[checkboxCharSlug]) { if (Array.isArray(currentSelections[checkboxCharSlug])) { currentSelections[checkboxCharSlug] = currentSelections[checkboxCharSlug].filter(v => v !== checkboxValue); } else if (currentSelections[checkboxCharSlug] === checkboxValue) { currentSelections[checkboxCharSlug] = ''; } } } } } }); return changedByDependency; }
    
// **INIZIALIZZAZIONE CORRETTA CON DEBUG**
    if (configuratorWrapper.length && productConfig && productConfig.characteristics) {
        initializeConfigurator(); 
        
        baseImageElem.on('load', function() {
            if (imageOrientation === 'horizontal') {
                calculateRotatedImageDimensions();
            }
        });
        
        // **VARIABILI PER DEBUG E CONTROLLO**
        let initAttempts = 0;
        const maxInitAttempts = 10;
        
        // **FUNZIONE DI INIZIALIZZAZIONE ROBUSTA**
        function robustInitialization() {
            initAttempts++;
            
            console.log(`WSS Debug: Init attempt ${initAttempts}`, {
                windowWidth: $(window).width(),
                mainLayoutExists: mainLayout.length > 0,
                mainLayoutOffset: mainLayout.length > 0 ? mainLayout.offset() : null,
                imageOrientation: imageOrientation,
                layoutInitialized: layoutInitialized
            });
            
            // Verifica che tutti gli elementi essenziali siano pronti
            if (mainLayout.length === 0 || !mainLayout.offset() || mainLayout.offset().top === 0) {
                if (initAttempts < maxInitAttempts) {
                    setTimeout(robustInitialization, 200);
                    return;
                }
            }
            
            // Esegui layout iniziale
            debouncedAdjustLayout(true);
            
            // Verifica che il layout sia stato applicato correttamente
            setTimeout(function() {
                const afterLayoutCheck = {
                    layoutInitialized: layoutInitialized,
                    mainLayoutOffset: mainLayout.offset(),
                    imageColumnPosition: imageColumn.css('position'),
                    optionsColumnMargin: optionsColumn.css('margin-left')
                };
                
                console.log('WSS Debug: After layout check', afterLayoutCheck);
                
                // **FORZA ATTIVAZIONE SCROLL HANDLER**
                $(window).off('scroll.wss').on('scroll.wss', function() {
                    if (!layoutInitialized) return;
                    
                    clearTimeout(scrollTimer);
                    scrollTimer = setTimeout(function() {
                        console.log('WSS Debug: Scroll handler triggered', {
                            scrollTop: $(window).scrollTop(),
                            windowWidth: $(window).width(),
                            imageOrientation: imageOrientation
                        });
                        
                        if ($(window).width() >= 768) {
                            handleScrollDesktop();
                        } else {
                            handleScrollMobile();
                        }
                    }, 16);
                });
                
                // **TEST IMMEDIATO DELLO SCROLL**
                if ($(window).scrollTop() > 0) {
                    console.log('WSS Debug: Page already scrolled, triggering handler');
                    if ($(window).width() >= 768) {
                        handleScrollDesktop();
                    } else {
                        handleScrollMobile();
                    }
                }
                
            }, 300);
        }
        
        // **SEQUENZA DI INIZIALIZZAZIONE MULTIPLA**
        
        // 1. Primo tentativo al DOM ready (già siamo qui)
        setTimeout(robustInitialization, 100);
        
        // 2. Secondo tentativo al window.load
        $(window).on('load.wss', function() {
            console.log('WSS Debug: Window load event');
            setTimeout(robustInitialization, 200);
        });
        
        // 3. Terzo tentativo con delay maggiore (per contenuti dinamici)
        setTimeout(function() {
            console.log('WSS Debug: Delayed initialization attempt');
            robustInitialization();
        }, 1000);
        
        // **RESIZE HANDLER MIGLIORATO CON DEBUG**
        let resizeTimer;
        $(window).off('resize.wss').on('resize.wss', function() {
            console.log('WSS Debug: Window resize');
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                layoutInitialized = false;
                debouncedAdjustLayout(true);
                
                setTimeout(function() {
                    if ($(window).width() >= 768) {
                        handleScrollDesktop();
                    } else {
                        handleScrollMobile();
                    }
                    
                    if (imageOrientation === 'horizontal') {
                        calculateRotatedImageDimensions();
                    }
                }, 200);
            }, 250); 
        });

        // **HANDLER PER CAMBIO ORIENTAMENTO MOBILE**
        $(window).on('orientationchange.wss', function() {
            console.log('WSS Debug: Orientation change');
            setTimeout(robustInitialization, 500);
        });
        
        // **FALLBACK PER TEMI CHE MODIFICANO IL DOM DOPO IL LOAD**
        setTimeout(function() {
            if (!layoutInitialized) {
                console.log('WSS Debug: Final fallback initialization');
                robustInitialization();
            }
        }, 2000);
    }
});