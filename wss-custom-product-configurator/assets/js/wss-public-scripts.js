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
    
    // **SISTEMA DI DEBUG AVANZATO**
	// Legge l'impostazione debug dal backend
    let debugMode = typeof wss_configurator_data.debug_panel_enabled !== 'undefined' ? 
                   wss_configurator_data.debug_panel_enabled : false;
    let debugPanel = null;
    let debugLog = [];
    
    function createDebugPanel() {
        if (!debugMode || debugPanel) return;
        
		debugPanel = $(`
            <div id="wss-debug-panel" style="
                position: fixed; 
                top: 10px; 
                right: 10px; 
                width: 350px; 
                max-height: 400px; 
                background: rgba(0,0,0,0.9); 
                color: #00ff00; 
                font-family: monospace; 
                font-size: 11px; 
                padding: 10px; 
                z-index: 9999; 
                overflow-y: auto;
                border: 1px solid #333;
                border-radius: 3px;
            ">
                <div style="color: #fff; margin-bottom: 10px; font-weight: bold;">WSS Debug Panel</div>
                <div style="margin-bottom: 10px;">
                    <button id="wss-debug-clear" style="padding: 3px 6px; margin-right: 3px; font-size: 10px;">Clear</button>
                    <button id="wss-debug-export" style="padding: 3px 6px; margin-right: 3px; font-size: 10px;">Export</button>
                    <button id="wss-debug-copy" style="padding: 3px 6px; font-size: 10px;">Copy</button>
                </div>
                <div id="wss-debug-content"></div>
                <div style="margin-top: 10px;">
                    <button id="wss-debug-clear-bottom" style="padding: 3px 6px; margin-right: 3px; font-size: 10px;">Clear</button>
                    <button id="wss-debug-export-bottom" style="padding: 3px 6px; margin-right: 3px; font-size: 10px;">Export</button>
                    <button id="wss-debug-copy-bottom" style="padding: 3px 6px; font-size: 10px;">Copy</button>
                </div>
            </div>
        `);
        
        $('body').append(debugPanel);
        
        $('#wss-debug-clear').on('click', function() {
            debugLog = [];
            $('#wss-debug-content').html('');
        });
        
        $('#wss-debug-export').on('click', function() {
            console.log('WSS Debug Export:', debugLog);
            alert('Debug log exported to browser console');
        });

        
        // **HANDLER PER BOTTONI COPIA - NUOVO**
        function copyDebugContent() {
            // **METODO CORRETTO**: Usa innerHTML e converte
            const debugContentElement = document.getElementById('wss-debug-content');
            if (!debugContentElement || !debugContentElement.innerHTML.trim()) {
                alert('No debug content to copy');
                return;
            }
            
            // Converte HTML in testo leggibile
            const textContent = debugContentElement.innerText || debugContentElement.textContent;
            const fullDebugText = `=== WSS DEBUG PANEL ===\n${textContent}\n\n=== LOGS ARRAY ===\n${JSON.stringify(debugLog, null, 2)}`;
            
            // **METODO ROBUSTO** per copiare
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(fullDebugText).then(function() {
                    alert('Debug content copied to clipboard');
                }).catch(function(err) {
                    console.error('Clipboard API failed:', err);
                    fallbackCopy(fullDebugText);
                });
            } else {
                fallbackCopy(fullDebugText);
            }
        }
        
        function fallbackCopy(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    alert('Debug content copied to clipboard (fallback method)');
                } else {
                    alert('Copy failed. Please copy manually from console.');
                    console.log('DEBUG CONTENT TO COPY:', text);
                }
            } catch (err) {
                console.error('Fallback copy failed:', err);
                alert('Copy failed. Content logged to console.');
                console.log('DEBUG CONTENT TO COPY:', text);
            }
            document.body.removeChild(textArea);
        }
        
        $('#wss-debug-copy, #wss-debug-copy-bottom').on('click', copyDebugContent);
        
        // **HANDLER PER BOTTONI DUPLICATI**
        $('#wss-debug-clear-bottom').on('click', function() {
            debugLog = [];
            $('#wss-debug-content').html('');
        });
        
        $('#wss-debug-export-bottom').on('click', function() {
            console.log('WSS Debug Export:', debugLog);
            alert('Debug log exported to browser console');
        });
		
    }
    
    function debugMessage(message, data = null, level = 'info') {
        if (!debugMode) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            level,
            message,
            data: data ? JSON.parse(JSON.stringify(data)) : null
        };
        
        debugLog.push(logEntry);
        
        // Mantieni solo gli ultimi 100 log
        if (debugLog.length > 100) {
            debugLog.shift();
        }
        
        // Colore basato sul livello
        const colors = {
            info: '#00ff00',
            warn: '#ffaa00', 
            error: '#ff0000',
            success: '#00ff88'
        };
        
        const color = colors[level] || '#00ff00';
        
        if (!debugPanel) createDebugPanel();
        
        const debugContent = $('#wss-debug-content');
        const logHtml = `
            <div style="color: ${color}; margin-bottom: 5px; border-bottom: 1px dotted #333; padding-bottom: 3px;">
                <span style="color: #888;">[${timestamp}]</span> 
                <strong>${message}</strong>
                ${data ? `<br><span style="color: #ccc; font-size: 10px;">${JSON.stringify(data, null, 2)}</span>` : ''}
            </div>
        `;
        
        debugContent.append(logHtml);
        debugContent.scrollTop(debugContent[0].scrollHeight);
        
        console.log(`WSS ${level.toUpperCase()}: ${message}`, data);
    }
    
    function calculateRotatedImageDimensions() {
        if (imageOrientation !== 'horizontal') return;
        
        debugMessage('Calculating rotated image dimensions', {
            orientation: imageOrientation,
            windowWidth: $(window).width()
        });
        
        const $container = configuratorWrapper.find('.wss-image-container');
        const $baseImage = $('#wss-configured-product-image-base');
        
        if (!$container.length || !$baseImage.length) {
            debugMessage('Missing container or base image', {
                containerExists: $container.length > 0,
                baseImageExists: $baseImage.length > 0
            }, 'warn');
            return;
        }
        
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
            
            debugMessage('Applied mobile rotated dimensions', {
                containerWidth,
                containerHeight,
                imageWidth,
                imageHeight
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
            
            debugMessage('Applied desktop rotated dimensions', {
                containerWidth,
                maxAllowedHeight,
                finalImageWidth: imageWidth,
                finalImageHeight: imageHeight
            });
        }
        
        $container.addClass('wss-dimensions-calculated');
    }

    function calculateFixedImageTop() {
        const adminBarHeight = $wpAdminBar.length && $wpAdminBar.is(':visible') ? $wpAdminBar.outerHeight() : 0;
        let siteHeaderHeight = 0;
        
        debugMessage('Calculating fixed image top position', {
            adminBarHeight,
            headerExists: $siteHeader.length > 0,
            headerVisible: $siteHeader.is(':visible')
        });
        
        // **CALCOLO HEADER MIGLIORATO**
        if ($siteHeader.length && $siteHeader.is(':visible')) {
            const headerPosition = $siteHeader.css('position');
            const isHeaderFixed = (headerPosition === 'fixed' || headerPosition === 'sticky');
            
            debugMessage('Header analysis', {
                headerPosition,
                isHeaderFixed,
                headerOffset: $siteHeader.offset(),
                headerHeight: $siteHeader.outerHeight()
            });
            
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
        
        // **CALCOLO DESCRIZIONE MIGLIORATO**
        let descriptionHeight = 0;
        if (imageOrientation === 'vertical' && $descriptionFull.length && $descriptionFull.is(':visible')) {
            descriptionHeight = $descriptionFull.outerHeight();
            
            debugMessage('Description analysis', {
                descriptionExists: $descriptionFull.length > 0,
                descriptionVisible: $descriptionFull.is(':visible'),
                descriptionHeight,
                descriptionOffset: $descriptionFull.offset()
            });
        }
        
        fixedImageTopPosition = adminBarHeight + siteHeaderHeight;
        
        debugMessage('Fixed top calculation result', {
            adminBarHeight,
            siteHeaderHeight,
            descriptionHeight,
            finalFixedImageTopPosition: fixedImageTopPosition
        }, 'success');
        
        return { fixedImageTopPosition, descriptionHeight };
    }
    
	function getActualImageColumnWidthFromCSS() {
        if (imageOrientation === 'horizontal') {
            return '100%';
        }
        
        debugMessage('Getting image column width from CSS');
		
		// **DEBUG ESTESO PER LARGHEZZA COLONNA**
        const debugInfo = {
            windowWidth: $(window).width(),
            mainLayoutWidth: mainLayout.width(),
            imageColumnCurrentWidth: imageColumn.width(),
            imageColumnCurrentCss: imageColumn.css('width'),
            imageColumnCurrentStyle: imageColumn.attr('style'),
            customWidthSetting: wss_configurator_data.image_column_width,
            customWidthUnit: wss_configurator_data.image_column_width_unit
        };
        
        debugMessage('Width calculation debug info', debugInfo);		
        
		// **CORREZIONE**: Usa le impostazioni personalizzate se disponibili
        if (typeof wss_configurator_data.image_column_width !== 'undefined' && 
            typeof wss_configurator_data.image_column_width_unit !== 'undefined') {
            
            const customWidth = parseFloat(wss_configurator_data.image_column_width);
            const customUnit = wss_configurator_data.image_column_width_unit;
            
            debugMessage('Using custom width settings', {
                width: customWidth,
                unit: customUnit,
                combined: customWidth + customUnit,
                mainLayoutWidth: mainLayout.width()
            });
            
            if (customUnit === 'px') {
                debugMessage('Applying pixel width', { finalWidth: customWidth });
                return customWidth;
            } else {
                // Percentuale - calcola rispetto al main layout
                if (mainLayout.length && mainLayout.width() > 0) {
                    const percentage = customWidth / 100;
                    const calculatedWidth = mainLayout.width() * percentage;
                    debugMessage('Applying percentage width', { 
                        percentage: customWidth, 
                        mainLayoutWidth: mainLayout.width(),
                        calculatedWidth: calculatedWidth
                    });
                    return calculatedWidth;
                } else {
                    debugMessage('Main layout width not available, using fallback', null, 'warn');
                    return 400; // Fallback
                }
            }
        }
        
        // Fallback al comportamento originale
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
        
        debugMessage('Image column width calculation', {
            originalInlineStyle,
            widthValueFromCSS,
            calculatedWidthInPx,
            maxWidthFromCSS,
            windowWidth: $(window).width(),
            mainLayoutWidth: mainLayout.width()
        });
        
        return calculatedWidthInPx;
    }
	
    // **FUNZIONE PRINCIPALE CORRETTA CON DEBUG ESTESO**
    function adjustLayout(isInitialCall = false) {
        debugMessage(`adjustLayout called`, {
            isInitialCall,
            isAdjusting,
            layoutInitialized,
            windowWidth: $(window).width(),
            imageOrientation
        });
        
        // **PREVENZIONE RACE CONDITIONS**
        if (isAdjusting && !isInitialCall) {
            debugMessage('Skipping adjustLayout due to race condition');
            return;
        }
        
        isAdjusting = true;
        
        if (!mainLayout.length || !imageColumn.length || !optionsColumn.length) {
            debugMessage('Missing required elements', {
                mainLayoutExists: mainLayout.length > 0,
                imageColumnExists: imageColumn.length > 0,
                optionsColumnExists: optionsColumn.length > 0
            }, 'error');
            isAdjusting = false;
            return;
        }

        const windowWidth = $(window).width();
        const { fixedImageTopPosition: topPos, descriptionHeight } = calculateFixedImageTop();
        fixedImageTopPosition = topPos;

        if (imageOrientation === 'horizontal') {
            debugMessage('Applying horizontal layout');
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
            debugMessage('Applying vertical layout');
            // **LAYOUT VERTICALE CORRETTO**
            if (windowWidth >= 768) { 
                // **ASPETTA CHE TUTTI GLI ELEMENTI SIANO MISURABILI**
                const mainLayoutOffset = mainLayout.offset();
                
                debugMessage('Main layout offset check', {
                    mainLayoutOffset,
                    offsetIsZero: !mainLayoutOffset || mainLayoutOffset.top === 0,
                    isInitialCall
                });
                
                if (!mainLayoutOffset || mainLayoutOffset.top === 0) {
                    if (isInitialCall) {
                        debugMessage('Retrying layout calculation after delay', null, 'warn');
                        setTimeout(() => adjustLayout(true), 100);
                    }
                    isAdjusting = false;
                    return;
                }
                
                const mainLayoutOffsetLeft = mainLayoutOffset.left;
                const imageColumnTargetWidthPx = getActualImageColumnWidthFromCSS();
                
                debugMessage('Layout calculations', {
                    mainLayoutOffsetLeft,
                    imageColumnTargetWidthPx,
                    fixedImageTopPosition,
                    descriptionHeight
                });
                
                if (imageColumnTargetWidthPx > 0) { 
                    // **CORREZIONE: Considera la descrizione nel calcolo dell'altezza**
                    const availableHeight = `calc(100vh - ${fixedImageTopPosition}px - 20px)`;
                    
					const imageColumnStyles = {
                        'position': 'relative', // **INIZIA SEMPRE COME RELATIVE**
                        'left': '',
                        'top': '',
                        'width': imageColumnTargetWidthPx + 'px', 
                        'height': availableHeight,
                        'max-width': 'none',
                        'flex-shrink': '0' // **PREVIENE IL RIMPICCIOLIMENTO**
                    };

                    const optionsColumnStyles = {
                        'margin-left': '0', // **RIMUOVI MARGIN-LEFT**
                        'width': 'auto', // **LASCIA CHE FLEX GESTISCA LA LARGHEZZA**
                        'min-height': availableHeight, 
                        'position': 'relative', 
                        'top': '', 
                        'height': 'auto',
                        'padding-top': '',
                        'flex-grow': '1' // **USA FLEXBOX**
                    };
                    
                    debugMessage('Applying desktop vertical styles', {
                        imageColumnStyles,
                        optionsColumnStyles
                    });
                    
                    imageColumn.css(imageColumnStyles);
                    optionsColumn.css(optionsColumnStyles);
                } else if (isInitialCall) {
                    debugMessage('Image column width is 0, retrying', null, 'warn');
                    setTimeout(() => adjustLayout(true), 200); 
                    isAdjusting = false;
                    return; 
                }
                
            } else { // Mobile
                debugMessage('Applying mobile vertical layout');
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
            debugMessage('Layout initialized successfully', null, 'success');
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
        
        debugMessage('handleScrollDesktop execution', {
            scrollTop,
            fixedImageTopPosition,
            descriptionHeight,
            imageOrientation,
            isStickyActive,
            frozenTriggerPoints: frozenTriggerPoints ? 'exists' : 'null'
        });
        
        if (imageOrientation === 'horizontal') {
            debugMessage('Processing horizontal scroll');
            // Comportamento scroll per orientamento orizzontale (invariato)
            const imageColumnOriginalOffset = mainLayout.offset().top;
            const imageColumnHeight = imageColumn.outerHeight();
            
            debugMessage('Horizontal scroll calculations', {
                imageColumnOriginalOffset,
                imageColumnHeight,
                triggerPoint: imageColumnOriginalOffset - fixedImageTopPosition,
                shouldBeFixed: scrollTop > imageColumnOriginalOffset - fixedImageTopPosition
            });
            
            if (scrollTop > imageColumnOriginalOffset - fixedImageTopPosition) {
                debugMessage('Activating horizontal fixed image');
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
                debugMessage('Deactivating horizontal fixed image');
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
            debugMessage('Processing vertical scroll');
            // **COMPORTAMENTO VERTICALE CON TRIGGER POINTS CONGELATI**
            
// **CALCOLA I TRIGGER POINTS SOLO SE NON SONO CONGELATI**
                if (!frozenTriggerPoints || !isStickyActive) {
                    debugMessage('Calculating new trigger points');
                    
                    const mainLayoutOffsetTop = mainLayout.offset().top;
                    const documentHeight = $(document).height();
                    
                    // **CORREZIONE: Calcolo più robusto del punto finale**
                    let tabsOffsetTop;
                    if ($tabsWrapper.length && $tabsWrapper.is(':visible')) {
                        tabsOffsetTop = $tabsWrapper.offset().top;
                        debugMessage('Tabs wrapper found', { 
                            tabsOffsetTop, 
                            mainLayoutOffsetTop,
                            tabsIsBeforeMainLayout: tabsOffsetTop < mainLayoutOffsetTop 
                        });
                        
                        // **PROBLEMA IDENTIFICATO**: Se i tabs sono SOPRA il main layout, 
                        // significa che il configuratore è posizionato male nel DOM
                        if (tabsOffsetTop < mainLayoutOffsetTop) {
                            debugMessage('CRITICAL: Tabs are above main layout - DOM positioning issue detected', {
                                tabsOffsetTop,
                                mainLayoutOffsetTop,
                                difference: mainLayoutOffsetTop - tabsOffsetTop
                            }, 'error');
                            
                            // Usa un punto di fine più logico
                            tabsOffsetTop = mainLayoutOffsetTop + mainLayout.outerHeight() + 500;
                        }
                    } else {
                        // Fallback: usa la fine del documento meno un margine
                        tabsOffsetTop = documentHeight - 200;
                        debugMessage('No tabs wrapper, using document end', { 
                            documentHeight, 
                            calculatedTabsOffsetTop: tabsOffsetTop 
                        });
                    }
                    
                    const baseImageContainer = imageColumn.find('.wss-image-container');
                    const imageContainerTop = baseImageContainer.offset() ? baseImageContainer.offset().top : mainLayoutOffsetTop;
                    
                    // **CORREZIONE: Considera la descrizione nel calcolo del trigger**
                    const descriptionOffset = $descriptionFull.length && $descriptionFull.is(':visible') ? $descriptionFull.offset().top : mainLayoutOffsetTop;
                    const actualStartPoint = Math.min(descriptionOffset, imageContainerTop, mainLayoutOffsetTop);
                    
                    const stickyTriggerPoint = actualStartPoint - fixedImageTopPosition;
                    const optionsColumnHeight = optionsColumn[0].scrollHeight;
                    const viewportHeight = $(window).height() - fixedImageTopPosition;
                    
                    // **CORREZIONE: Calcolo migliorato dell'unsticky point**
                    let unstickyTriggerPoint;
                    const needsInternalScroll = optionsColumnHeight > viewportHeight;
                    
                    if (needsInternalScroll) {
                        // Se serve scroll interno, calcola basandoti sul contenuto
                        const maxInternalScroll = optionsColumnHeight - viewportHeight;
                        unstickyTriggerPoint = stickyTriggerPoint + maxInternalScroll + viewportHeight + 100;
                    } else {
                        // Se non serve scroll interno, usa la posizione dei tabs o fine contenuto
                        const contentEndPoint = Math.min(
                            tabsOffsetTop - viewportHeight - 50,
                            stickyTriggerPoint + viewportHeight * 2
                        );
                        
                        unstickyTriggerPoint = Math.max(
                            contentEndPoint,
                            stickyTriggerPoint + viewportHeight + 200
                        );
                    }
                    
                    // **VALIDAZIONE FINALE**
                    if (unstickyTriggerPoint <= stickyTriggerPoint) {
                        unstickyTriggerPoint = stickyTriggerPoint + viewportHeight + 300;
                        debugMessage('Applied fallback unsticky calculation', null, 'warn');
                    }
                    
                    // **AGGIUNTA: Verifica se il configuratore è posizionato ragionevolmente**
                    const configPosition = stickyTriggerPoint / documentHeight;
                    if (configPosition > 0.7) {
                        debugMessage('WARNING: Configurator positioned very low on page', {
                            positionPercentage: (configPosition * 100).toFixed(1) + '%',
                            stickyTriggerPoint,
                            documentHeight,
                            suggestion: 'Consider moving configurator higher in page layout'
                        }, 'error');
                    }
                    
                    // **CONGELA I TRIGGER POINTS**
                    frozenTriggerPoints = {
                        stickyTriggerPoint: stickyTriggerPoint,
                        unstickyTriggerPoint: unstickyTriggerPoint,
                        viewportHeight: viewportHeight,
                        optionsColumnHeight: optionsColumnHeight,
                        needsInternalScroll: needsInternalScroll,
                        mainLayoutOffsetTop,
                        tabsOffsetTop,
                        imageContainerTop,
                        descriptionOffset,
                        actualStartPoint,
                        documentHeight,
                        configPositionPercentage: (configPosition * 100).toFixed(1)
                    };
                    
                    debugMessage('Trigger calculations (FROZEN) - IMPROVED', frozenTriggerPoints, 'success');
                }

            
            // **USA I TRIGGER POINTS CONGELATI**
            const triggerData = frozenTriggerPoints;
            
            // **GESTIONE STATI CON TRIGGER STABILI**
            if (scrollTop > triggerData.stickyTriggerPoint && scrollTop < triggerData.unstickyTriggerPoint) {
                debugMessage('Should be sticky', {
                    scrollTop,
                    stickyTriggerPoint: triggerData.stickyTriggerPoint,
                    unstickyTriggerPoint: triggerData.unstickyTriggerPoint,
                    currentlySticky: isStickyActive
                });
                
                // **STATO STICKY**
                if (!isStickyActive) {
                    debugMessage('Activating sticky mode', null, 'success');
                    isStickyActive = true;
                    
                    productContainer.addClass('wss-sticky-container');
                    
                    if (!$('.wss-sticky-spacer').length) {
                        productContainer.after('<div class="wss-sticky-spacer"></div>');
                    }
                    
                    const stickyStyles = {
                        'position': 'fixed',
                        'top': fixedImageTopPosition + 'px',
                        'left': '0',
                        'right': '0',
                        'width': '100%',
                        'height': `calc(100vh - ${fixedImageTopPosition}px)`,
                        'z-index': '1000',
                        'background': '#fff'
                    };
                    
                    debugMessage('Applying sticky styles', stickyStyles);
                    
                    mainLayout.css(stickyStyles);
                    
                    // **CORREZIONE LAYOUT STICKY - USA FLEXBOX**
                    const imageColumnTargetWidthPx = getActualImageColumnWidthFromCSS();
                    
                    debugMessage('Sticky layout correction', {
                        imageColumnTargetWidthPx,
                        beforeImageColumnCSS: imageColumn.css(['width', 'margin-left', 'position']),
                        beforeOptionsColumnCSS: optionsColumn.css(['width', 'margin-left', 'position'])
                    });
                    
                    imageColumn.css({
                        'position': 'relative',
                        'top': '',
                        'left': '',
                        'width': imageColumnTargetWidthPx + 'px',
                        'height': 'calc(100vh - 0px)',
                        'margin-left': '0',
                        'flex-shrink': '0' // **IMPEDISCE RIDIMENSIONAMENTO**
                    });
                    
                    optionsColumn.css({
                        'position': 'relative',
                        'top': '',
                        'margin-left': '0', // **RIMUOVI MARGIN-LEFT**
                        'width': 'auto', // **LASCIA CHE FLEX GESTISCA**
                        'height': 'calc(100vh - 0px)',
                        'overflow-y': 'auto',
                        'min-height': '',
                        'flex-grow': '1' // **PRENDE SPAZIO RIMANENTE**
                    });
                    
                    debugMessage('Applied sticky layout correction', {
                        imageColumnTargetWidthPx,
                        afterImageColumnCSS: imageColumn.css(['width', 'margin-left', 'position', 'flex-shrink']),
                        afterOptionsColumnCSS: optionsColumn.css(['width', 'margin-left', 'position', 'flex-grow'])
                    }, 'success');
                    
                    debugMessage('Applied dynamic sticky layout', {
                        imageColumnWidth: imageColumnTargetWidthPx,
                        optionsColumnMarginLeft: imageColumnTargetWidthPx,
                        optionsColumnWidth: `calc(100% - ${imageColumnTargetWidthPx}px)`
                    });
                }
                
                // **GESTIONE SCROLL INTERNO**
                if (triggerData.needsInternalScroll) {
                    const internalScrollProgress = scrollTop - triggerData.stickyTriggerPoint;
                    const maxInternalScroll = triggerData.optionsColumnHeight - triggerData.viewportHeight + 40;
                    const clampedInternalScroll = Math.min(internalScrollProgress, maxInternalScroll);
                    
                    debugMessage('Internal scroll calculation', {
                        internalScrollProgress,
                        maxInternalScroll,
                        clampedInternalScroll
                    });
                    
                    optionsColumn.scrollTop(clampedInternalScroll);
                }
                
			} else if (scrollTop >= triggerData.unstickyTriggerPoint) {
                // **CORREZIONE**: Quando si raggiunge il punto di unsticky, 
                // riporta il configuratore alla sua posizione normale invece di absolute
                
                if (isStickyActive) {
                    isStickyActive = false;
                    frozenTriggerPoints = null;
                    
                    productContainer.removeClass('wss-sticky-container');
                    $('.wss-sticky-spacer').remove();
                    
                    // **FIX**: Ripristina il layout normale invece di posizionamento assoluto
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
                    
                    // **FIX**: Ripristina il layout normale
                    adjustLayout();
                    optionsColumn.scrollTop(0);
                }


                
            } else {
                debugMessage('Should be normal (before sticky)', {
                    scrollTop,
                    stickyTriggerPoint: triggerData.stickyTriggerPoint
                });
                
                if (isStickyActive) {
                    debugMessage('Deactivating sticky (top)', null, 'warn');
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
        
        debugMessage('Mobile scroll calculation - CORRECTED', {
            scrollTop,
            adminBarHeight,
            mobileFixedTop,
            imageColumnNaturalTopInDocument,
            tabsOffsetTop,
            windowWidth: $(window).width(),
            imageColumnCurrentCSS: imageColumn.css(['position', 'top', 'left', 'width', 'height', 'z-index'])
        });
        
        let imageEffectiveHeightForCalc;
        if (imageOrientation === 'horizontal') {
            imageEffectiveHeightForCalc = imageColumn.find('.wss-image-container').outerHeight();
        } else {
            imageEffectiveHeightForCalc = parseFloat(imageColumn.css('height'));
            if (isNaN(imageEffectiveHeightForCalc) || imageEffectiveHeightForCalc <= 0) {
                imageEffectiveHeightForCalc = $(window).height() * 0.6;
            }
        }

        const stickTriggerPoint = imageColumnNaturalTopInDocument - mobileFixedTop;
        
        // **CORREZIONE TRIGGER POINT**: Calcola basandoti sulla fine del contenuto
        let unstickTriggerPoint;
        if (tabsOffsetTop > imageColumnNaturalTopInDocument) {
            // Caso normale: tabs dopo il configuratore
            unstickTriggerPoint = tabsOffsetTop - imageEffectiveHeightForCalc - mobileFixedTop - 20;
        } else {
            // **CASO PROBLEMATICO**: tabs prima del configuratore - usa fine documento
            unstickTriggerPoint = $(document).height() - imageEffectiveHeightForCalc - 100;
        }

        debugMessage('Mobile trigger points - FIXED', {
            imageEffectiveHeightForCalc,
            stickTriggerPoint,
            unstickTriggerPoint,
            tabsOffsetTop,
            imageColumnNaturalTopInDocument,
            documentHeight: $(document).height(),
            shouldStick: scrollTop > stickTriggerPoint,
            shouldUnstick: scrollTop > unstickTriggerPoint && unstickTriggerPoint > stickTriggerPoint,
            triggerLogicValid: unstickTriggerPoint > stickTriggerPoint
        });

        if (scrollTop > stickTriggerPoint) { 
            optionsColumn.css('padding-top', imageEffectiveHeightForCalc + 'px');

            if (scrollTop > unstickTriggerPoint && unstickTriggerPoint > stickTriggerPoint) {
                debugMessage('Mobile unstick position - FIXED');
                
                // **CORREZIONE**: Calcola posizione relativa al main layout, non assoluta
                let relativeTop;
                if (tabsOffsetTop > imageColumnNaturalTopInDocument) {
                    relativeTop = tabsOffsetTop - imageColumnNaturalTopInDocument - imageEffectiveHeightForCalc - 20;
                } else {
                    // Se tabs sono sopra, posiziona alla fine del main layout
                    relativeTop = mainLayout.height() - imageEffectiveHeightForCalc;
                }
                
                // **ASSICURA CHE NON SIA NEGATIVO**
                relativeTop = Math.max(0, relativeTop);
                
                imageColumn.css({
                    'position': 'absolute',
                    'top': relativeTop + 'px',
                    'left': '0', 
                    'right': '0',
                    'width': 'auto',
                    'z-index': '1000',
                    'height': imageOrientation === 'horizontal' ? 'auto' : imageEffectiveHeightForCalc + 'px',
                    'max-width': 'none',
                    'margin-left': '0',
                    'margin-right': '0'
                });
                
                debugMessage('Applied mobile unstick styles - FIXED', {
                    position: 'absolute',
                    calculatedTop: relativeTop,
                    finalTop: relativeTop,
                    height: imageEffectiveHeightForCalc,
                    tabsOffsetTop,
                    imageColumnNaturalTopInDocument,
                    mainLayoutHeight: mainLayout.height()
                });
            } else { 
                debugMessage('Mobile fixed position - FIXED');
                
                debugMessage('Applied mobile unstick styles', {
                    position: 'absolute',
                    top: absoluteTop,
                    height: imageEffectiveHeightForCalc
                });
            } else { 
                debugMessage('Mobile fixed position - CORRECTED');
                const mainLayoutOffset = mainLayout.offset();
                const mainLayoutWidth = mainLayout.width();
                
                imageColumn.css({
                    'position': 'fixed', 
                    'top': mobileFixedTop + 'px',
                    'left': mainLayoutOffset.left + 'px', 
                    'right': 'auto', // **SPECIFICA right**
                    'width': mainLayoutWidth + 'px',    
                    'height': imageOrientation === 'horizontal' ? 'auto' : imageEffectiveHeightForCalc + 'px', 
                    'z-index': '1000', // **Z-INDEX ALTO**
                    'max-width': 'none',
                    'margin-left': '0', // **RIMUOVI QUALSIASI MARGIN**
                    'margin-right': '0',
                    'background-color': '#fff' // **AGGIUNTO BACKGROUND**
                });
                
                debugMessage('Applied mobile fixed styles', {
                    position: 'fixed',
                    top: mobileFixedTop,
                    left: mainLayoutOffset.left,
                    width: mainLayoutWidth,
                    height: imageEffectiveHeightForCalc,
                    zIndex: 1000
                });
            }
        } else { 
            debugMessage('Mobile normal position - CORRECTED');
            optionsColumn.css('padding-top', '');
            imageColumn.css({
                'position': 'relative', 
                'top': '', 
                'left': '', 
                'right': '', // **RIMUOVI RIGHT**
                'width': '100%', 
                'z-index': '10',
                'height': '',
                'max-width': '',
                'margin-left': '', // **RIPRISTINA MARGIN**
                'margin-right': '',
                'background-color': '' // **RIMUOVI BACKGROUND**
            });
            
            debugMessage('Applied mobile normal styles');
        }
    }

// **DEBOUNCED ADJUST LAYOUT CON DEBUG**
    function debouncedAdjustLayout(isInitial = false) {
        debugMessage('Debounced adjust layout called', { 
            isInitial, 
            timer: adjustLayoutTimer ? 'exists' : 'null' 
        });
        
        clearTimeout(adjustLayoutTimer);
        adjustLayoutTimer = setTimeout(() => {
            debugMessage('Executing debounced layout adjustment');
            adjustLayout(isInitial);
        }, isInitial ? 50 : 150);
    }

    // --- Funzioni Core (invariate) ---
    function initializeConfigurator() {
        debugMessage('Initializing configurator', {
            hasConfig: !!(productConfig && productConfig.characteristics),
            characteristicsCount: productConfig?.characteristics?.length || 0
        });
        
        if (!productConfig || !productConfig.characteristics) { 
            debugMessage('No valid product configuration found', null, 'error');
            return; 
        }
        
        productConfig.characteristics.forEach(char => { 
            const charSlug = char.slug; 
            const $optionsGroup = form.find('#wss-char-group-' + charSlug);
            
            debugMessage(`Processing characteristic: ${char.name}`, {
                slug: charSlug,
                type: char.type,
                optionsGroupFound: $optionsGroup.length > 0
            });
            
            if (char.type === 'radio') { 
                const $checkedRadio = $optionsGroup.find('input[type="radio"]:checked'); 
                if ($checkedRadio.length) { 
                    currentSelections[charSlug] = $checkedRadio.val(); 
                    debugMessage(`Radio selection found for ${charSlug}`, { value: $checkedRadio.val() });
                } 
            } 
            else if (char.type === 'select') { 
                const $select = $optionsGroup.find('select.wss-option-selector'); 
                const selectedValue = $select.val(); 
                if (selectedValue && selectedValue !== '') { 
                    currentSelections[charSlug] = selectedValue; 
                    debugMessage(`Select selection found for ${charSlug}`, { value: selectedValue });
                } 
            } 
            else if (char.type === 'checkbox') { 
                currentSelections[charSlug] = []; 
                $optionsGroup.find('input[type="checkbox"]:checked').each(function() { 
                    currentSelections[charSlug].push($(this).val()); 
                });
                debugMessage(`Checkbox selections found for ${charSlug}`, { values: currentSelections[charSlug] });
            }
        });
        
        debugMessage('Current selections after initialization', currentSelections, 'success');
        
        applyAllDependencies(); 
        updateConfigurationState(); 
    }
    
    form.on('change', 'input.wss-option-selector, select.wss-option-selector', function(event) {
        const $selectedElement = $(this); 
        const $characteristicGroup = $selectedElement.closest('.wss-characteristic-group'); 
        const charSlug = $characteristicGroup.data('char-slug');
        
        debugMessage('Option changed', {
            charSlug,
            elementType: $selectedElement.prop('tagName'),
            inputType: $selectedElement.attr('type'),
            newValue: $selectedElement.val()
        });
        
        const characteristicDefinition = productConfig.characteristics.find(c => c.slug === charSlug); 
        if (!characteristicDefinition) {
            debugMessage('Characteristic definition not found', { charSlug }, 'error');
            return; 
        }
        
        const charType = characteristicDefinition.type;
        
        if (charType === 'checkbox') { 
            currentSelections[charSlug] = []; 
            $characteristicGroup.find('input[type="checkbox"].wss-option-selector:checked').each(function() { 
                if (!$(this).closest('.wss-option-item').hasClass('wss-element-hidden')) { 
                    currentSelections[charSlug].push($(this).val()); 
                } 
            }); 
            debugMessage('Updated checkbox selections', { charSlug, values: currentSelections[charSlug] });
        } 
        else { 
            if ($selectedElement.is('select') && ($selectedElement.find('option:selected').hasClass('wss-element-hidden') || $selectedElement.val() === '')) { 
                currentSelections[charSlug] = ''; 
                debugMessage('Cleared selection (hidden or empty)', { charSlug });
            } else if ($selectedElement.is('input[type="radio"]') && $selectedElement.closest('.wss-option-item').hasClass('wss-element-hidden')) { 
                currentSelections[charSlug] = ''; 
                debugMessage('Cleared radio selection (hidden)', { charSlug });
            } else { 
                currentSelections[charSlug] = $selectedElement.val(); 
                debugMessage('Updated selection', { charSlug, value: $selectedElement.val() });
            } 
        }
        
        applyAllDependencies(); 
        updateConfigurationState();
    });
    
    function updateConfigurationState() { 
        debugMessage('Updating configuration state');
        
        let currentTotalPrice = baseProductPrice; 
        activeLayers = {}; 
        let currentBaseImageUrl = (productConfig && productConfig.base_image_default) ? productConfig.base_image_default : (wss_configurator_data.placeholder_image_url || '');
        
        if (!productConfig || !productConfig.characteristics) {
            debugMessage('No configuration available for state update', null, 'warn');
            return;
        }
        
        productConfig.characteristics.forEach(char => {
            const charSlug = char.slug; 
            const selectedValueOrValues = currentSelections[charSlug]; 
            
            if (selectedValueOrValues && selectedValueOrValues.length > 0) { 
                const processOption = (optValue) => {
                    const optionData = findOptionData(charSlug, optValue); 
                    if (optionData) { 
                        if (optionData.price_adjustment) { 
                            currentTotalPrice += parseFloat(optionData.price_adjustment); 
                            debugMessage('Price adjustment applied', {
                                charSlug,
                                optValue,
                                adjustment: optionData.price_adjustment,
                                newTotal: currentTotalPrice
                            });
                        }
                        
                        if (char.has_visual_impact) { 
                            if (char.is_base_switcher) { 
                                if (optionData.layer_image) { 
                                    if (productConfig && productConfig[optionData.layer_image]) { 
                                        currentBaseImageUrl = productConfig[optionData.layer_image]; 
                                    } else { 
                                        currentBaseImageUrl = optionData.layer_image; 
                                    }
                                    debugMessage('Base image switched', {
                                        charSlug,
                                        optValue,
                                        newBaseImage: currentBaseImageUrl
                                    });
                                } 
                            } 
                            else { 
                                if (optionData.layer_image) { 
                                    activeLayers[charSlug + '_' + optValue] = { 
                                        url: optionData.layer_image, 
                                        z_index: optionData.layer_z_index || 1 
                                    }; 
                                    debugMessage('Layer added', {
                                        charSlug,
                                        optValue,
                                        layerKey: charSlug + '_' + optValue,
                                        layerData: activeLayers[charSlug + '_' + optValue]
                                    });
                                } 
                            } 
                        } 
                    } 
                };
                
                if (Array.isArray(selectedValueOrValues)) { 
                    selectedValueOrValues.forEach(optValue => processOption(optValue)); 
                } else { 
                    processOption(selectedValueOrValues); 
                } 
            } 
        });
        
        debugMessage('Configuration state updated', {
            totalPrice: currentTotalPrice,
            baseImageUrl: currentBaseImageUrl,
            activeLayersCount: Object.keys(activeLayers).length,
            activeLayers
        }, 'success');
        
        updatePriceDisplay(currentTotalPrice); 
        updateProductImage(currentBaseImageUrl, activeLayers);
    }
    
    function findOptionData(charSlug, optValue) { 
        if (!productConfig || !productConfig.characteristics) return null; 
        const characteristic = productConfig.characteristics.find(c => c.slug === charSlug); 
        if (characteristic && characteristic.options) { 
            return characteristic.options.find(opt => String(opt.value) === String(optValue)); 
        } 
        return null; 
    }
    
    function updatePriceDisplay(newPrice) { 
        debugMessage('Updating price display', { newPrice });
        
        if (!priceDisplayContainer.length) { 
            debugMessage('Price display container not found', null, 'warn');
            return; 
        } 
        
        if (typeof wss_configurator_data === 'undefined' || typeof wss_configurator_data.wc_price_args === 'undefined' || typeof wss_configurator_data.wc_price_args.currency_symbol === 'undefined' || typeof wss_configurator_data.wc_price_args.decimal_separator === 'undefined' || typeof wss_configurator_data.wc_price_args.thousand_separator === 'undefined' || typeof wss_configurator_data.wc_price_args.decimals === 'undefined') { 
            priceDisplayContainer.html(`<p class="price"><span class="woocommerce-Price-amount amount">${Number(newPrice).toFixed(2)}</span></p>`); 
            debugMessage('Applied fallback price formatting');
            return; 
        } 
        
        const args = wss_configurator_data.wc_price_args; 
        const priceHtml = `<p class="price"><span class="woocommerce-Price-amount amount"><bdi>${formatPriceNumber(newPrice, args)}</bdi></span><span class="woocommerce-Price-currencySymbol">${args.currency_symbol}</span></p>`; 
        priceDisplayContainer.html(priceHtml);
        
        debugMessage('Price display updated successfully', { formattedPrice: priceHtml });
    }
    
    function formatPriceNumber(number, args) { 
        const num = Number(number); 
        const decimals = args.decimals || 2; 
        const decPoint = args.decimal_separator || '.'; 
        const thousandsSep = args.thousand_separator || ','; 
        let n = !isFinite(num) ? 0 : num; 
        let prec = !isFinite(decimals) ? 0 : Math.abs(decimals); 
        let toFixedFix = function (val, precision) { 
            let k = Math.pow(10, precision); 
            return '' + (Math.round(val * k) / k).toFixed(precision); 
        }; 
        let s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.'); 
        if (s[0].length > 3) { 
            s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, thousandsSep); 
        } 
        if ((s[1] || '').length < prec) { 
            s[1] = s[1] || ''; 
            s[1] += new Array(prec - s[1].length + 1).join('0'); 
        } 
        return s.join(decPoint); 
    }
    
    function updateProductImage(baseImageUrl, layers) { 
        debugMessage('Updating product image', {
            baseImageUrl,
            layersCount: layers ? Object.keys(layers).length : 0,
            layers
        });
        
        if (baseImageElem.attr('src') !== baseImageUrl) { 
            baseImageElem.attr('src', baseImageUrl || wss_configurator_data.placeholder_image_url || ''); 
            debugMessage('Base image updated', { newSrc: baseImageUrl });
        } 
        
        configuratorWrapper.find('.wss-image-layer-dynamic').remove(); 
        const imageContainer = baseImageElem.parent(); 
        
        if (layers && typeof layers === 'object' && Object.keys(layers).length > 0) { 
            const sortedLayers = Object.entries(layers).map(([slug, data]) => ({ slug, ...data })).sort((a, b) => (parseInt(a.z_index) || 0) - (parseInt(b.z_index) || 0)); 
            
            debugMessage('Processing sorted layers', { sortedLayers });
            
            sortedLayers.forEach(layer => { 
                if (layer.url) { 
                    const $layerDiv = $('<div>').addClass('wss-image-layer-dynamic').css('z-index', layer.z_index || 1); 
                    const $layerImg = $('<img>').attr('src', layer.url).attr('alt', 'Layer ' + layer.slug); 
                    $layerDiv.append($layerImg); 
                    imageContainer.append($layerDiv); 
                    
                    debugMessage('Layer added to DOM', {
                        slug: layer.slug,
                        url: layer.url,
                        zIndex: layer.z_index
                    });
                } 
            }); 
        }
        
        if (imageOrientation === 'horizontal') {
            setTimeout(calculateRotatedImageDimensions, 100);
        }
    }
    
    function applyAllDependencies() { 
        debugMessage('Applying all dependencies');
        
        let changedByDependency = false; 
        let dependencyCount = 0;
        
        form.find('.wss-option-item, option[data-dependency-char]').each(function() { 
            const $optionElement = $(this); 
            const depCharSlug = $optionElement.data('dependency-char'); 
            const depOptValue = String($optionElement.data('dependency-val')); 
            
            if (depCharSlug && typeof $optionElement.data('dependency-val') !== 'undefined') { 
                dependencyCount++;
                
                let isDependencyMet = false; 
                const actualSelectedValueForDepChar = currentSelections[depCharSlug]; 
                
                if (typeof actualSelectedValueForDepChar !== 'undefined' && actualSelectedValueForDepChar !== null && actualSelectedValueForDepChar !== '') { 
                    if (Array.isArray(actualSelectedValueForDepChar)) { 
                        if (actualSelectedValueForDepChar.includes(depOptValue)) { 
                            isDependencyMet = true; 
                        } 
                    } else { 
                        if (String(actualSelectedValueForDepChar) === depOptValue) { 
                            isDependencyMet = true; 
                        } 
                    } 
                } 
                
                const wasPreviouslyHidden = $optionElement.hasClass('wss-element-hidden'); 
                
                debugMessage('Dependency check', {
                    depCharSlug,
                    depOptValue,
                    actualSelectedValue: actualSelectedValueForDepChar,
                    isDependencyMet,
                    wasPreviouslyHidden,
                    optionText: $optionElement.find('.wss-option-text').text() || $optionElement.text()
                });
                
                if (isDependencyMet) { 
                    if(wasPreviouslyHidden) { 
                        $optionElement.removeClass('wss-element-hidden'); 
                        changedByDependency = true; 
                        debugMessage('Dependency met - showing option', { depCharSlug, depOptValue });
                    } 
                    if ($optionElement.is('option')) $optionElement.prop('disabled', false); 
                } else { 
                    if(!wasPreviouslyHidden) { 
                        $optionElement.addClass('wss-element-hidden'); 
                        changedByDependency = true; 
                        debugMessage('Dependency not met - hiding option', { depCharSlug, depOptValue });
                    } else { 
                        $optionElement.addClass('wss-element-hidden'); 
                    } 
                    
                    if ($optionElement.is('option')) { 
                        $optionElement.prop('disabled', true); 
                        if ($optionElement.is(':selected')) { 
                            $optionElement.parent('select').val(''); 
                            debugMessage('Cleared selected disabled option');
                        } 
                    } else if ($optionElement.find('input.wss-option-selector').is(':checked')) { 
                        $optionElement.find('input.wss-option-selector').prop('checked', false); 
                        const checkboxCharSlug = $optionElement.closest('.wss-characteristic-group').data('char-slug'); 
                        const checkboxValue = $optionElement.find('input.wss-option-selector').val(); 
                        
                        if (currentSelections[checkboxCharSlug]) { 
                            if (Array.isArray(currentSelections[checkboxCharSlug])) { 
                                currentSelections[checkboxCharSlug] = currentSelections[checkboxCharSlug].filter(v => v !== checkboxValue); 
                            } else if (currentSelections[checkboxCharSlug] === checkboxValue) { 
                                currentSelections[checkboxCharSlug] = ''; 
                            } 
                        }
                        
                        debugMessage('Unchecked hidden option', { checkboxCharSlug, checkboxValue });
                    } 
                } 
            } 
        }); 
        
        debugMessage('Dependencies applied', {
            totalDependencies: dependencyCount,
            changedByDependency
        }, changedByDependency ? 'warn' : 'info');
        
        return changedByDependency; 
    }
    
// **INIZIALIZZAZIONE CORRETTA CON DEBUG ESTESO**
    if (configuratorWrapper.length && productConfig && productConfig.characteristics) {
        debugMessage('Starting configurator initialization', {
            configuratorWrapperExists: configuratorWrapper.length > 0,
            productConfigExists: !!productConfig,
            characteristicsCount: productConfig.characteristics.length,
            imageOrientation
        }, 'success');
        
        initializeConfigurator(); 
        
        baseImageElem.on('load', function() {
            debugMessage('Base image loaded', { src: baseImageElem.attr('src') });
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
            
            debugMessage(`Robust initialization attempt ${initAttempts}`, {
                windowWidth: $(window).width(),
                mainLayoutExists: mainLayout.length > 0,
                mainLayoutOffset: mainLayout.length > 0 ? mainLayout.offset() : null,
                imageOrientation: imageOrientation,
                layoutInitialized: layoutInitialized,
                descriptionFullExists: $descriptionFull.length > 0,
                descriptionFullVisible: $descriptionFull.is(':visible'),
                descriptionFullOffset: $descriptionFull.length > 0 ? $descriptionFull.offset() : null
            });
            
            // Verifica che tutti gli elementi essenziali siano pronti
            if (mainLayout.length === 0 || !mainLayout.offset() || mainLayout.offset().top === 0) {
                if (initAttempts < maxInitAttempts) {
                    debugMessage(`Retrying initialization in 200ms (attempt ${initAttempts + 1}/${maxInitAttempts})`, null, 'warn');
                    setTimeout(robustInitialization, 200);
                    return;
                } else {
                    debugMessage('Max initialization attempts reached', null, 'error');
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
                    optionsColumnMargin: optionsColumn.css('margin-left'),
                    descriptionPosition: $descriptionFull.length > 0 ? {
                        offset: $descriptionFull.offset(),
                        height: $descriptionFull.outerHeight(),
                        visible: $descriptionFull.is(':visible')
                    } : 'not found'
                };
                
                debugMessage('After layout check', afterLayoutCheck, 'success');
                
                // **FORZA ATTIVAZIONE SCROLL HANDLER**
                $(window).off('scroll.wss').on('scroll.wss', function() {
                    if (!layoutInitialized) return;
                    
                    clearTimeout(scrollTimer);
                    scrollTimer = setTimeout(function() {
                        if ($(window).width() >= 768) {
                            handleScrollDesktop();
                        } else {
                            handleScrollMobile();
                        }
                    }, 16);
                });
                
                // **TEST IMMEDIATO DELLO SCROLL**
                if ($(window).scrollTop() > 0) {
                    debugMessage('Page already scrolled, triggering handler', { scrollTop: $(window).scrollTop() });
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
            debugMessage('Window load event triggered');
            setTimeout(robustInitialization, 200);
        });
        
        // 3. Terzo tentativo con delay maggiore (per contenuti dinamici)
        setTimeout(function() {
            debugMessage('Delayed initialization attempt (1 second)');
            robustInitialization();
        }, 1000);
        
        // **RESIZE HANDLER MIGLIORATO CON DEBUG**
        let resizeTimer;
        $(window).off('resize.wss').on('resize.wss', function() {
            debugMessage('Window resize detected', {
                newWidth: $(window).width(),
                newHeight: $(window).height()
            });
            
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                layoutInitialized = false;
                frozenTriggerPoints = null; // Reset trigger points on resize
                isStickyActive = false;
                
                debugMessage('Executing resize layout adjustment');
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
            debugMessage('Orientation change detected');
            setTimeout(robustInitialization, 500);
        });
        
        // **FALLBACK PER TEMI CHE MODIFICANO IL DOM DOPO IL LOAD**
        setTimeout(function() {
            if (!layoutInitialized) {
                debugMessage('Final fallback initialization (2 seconds)', null, 'warn');
                robustInitialization();
            }
        }, 2000);
        
        // **BOTTONE PER EXPORT COMPLETO DEBUG**
        if (debugMode) {
            setTimeout(function() {
                if (debugPanel) {
                    debugPanel.append(`
                        <button id="wss-debug-full-export" style="margin-top: 10px; padding: 5px; background: #007cba; color: white; border: none;">
                            Full Export
                        </button>
                    `);
                    
                    $('#wss-debug-full-export').on('click', function() {
                        const fullDebugData = {
                            timestamp: new Date().toISOString(),
                            url: window.location.href,
                            userAgent: navigator.userAgent,
                            viewport: {
                                width: $(window).width(),
                                height: $(window).height()
                            },
                            plugin: {
                                version: 'WSS Custom Product Configurator 1.0.1',
                                imageOrientation: imageOrientation,
                                productId: productId,
                                layoutInitialized: layoutInitialized,
                                isStickyActive: isStickyActive
                            },
                            elements: {
                                mainLayout: {
                                    exists: mainLayout.length > 0,
                                    offset: mainLayout.length > 0 ? mainLayout.offset() : null,
                                    dimensions: mainLayout.length > 0 ? { width: mainLayout.width(), height: mainLayout.height() } : null
                                },
                                imageColumn: {
                                    exists: imageColumn.length > 0,
                                    position: imageColumn.css('position'),
                                    dimensions: { width: imageColumn.width(), height: imageColumn.height() }
                                },
                                optionsColumn: {
                                    exists: optionsColumn.length > 0,
                                    marginLeft: optionsColumn.css('margin-left'),
                                    dimensions: { width: optionsColumn.width(), height: optionsColumn.height() }
                                },
                                descriptionFull: {
                                    exists: $descriptionFull.length > 0,
                                    visible: $descriptionFull.is(':visible'),
                                    offset: $descriptionFull.length > 0 ? $descriptionFull.offset() : null,
                                    height: $descriptionFull.length > 0 ? $descriptionFull.outerHeight() : null
                                }
                            },
                            frozenTriggerPoints: frozenTriggerPoints,
                            currentSelections: currentSelections,
                            logs: debugLog
                        };
                        
                        console.log('=== WSS FULL DEBUG EXPORT ===');
                        console.log(JSON.stringify(fullDebugData, null, 2));
                        
                        // Crea anche un file scaricabile
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullDebugData, null, 2));
                        const downloadAnchorNode = document.createElement('a');
                        downloadAnchorNode.setAttribute("href", dataStr);
                        downloadAnchorNode.setAttribute("download", `wss-debug-${Date.now()}.json`);
                        document.body.appendChild(downloadAnchorNode);
                        downloadAnchorNode.click();
                        downloadAnchorNode.remove();
                        
                        alert('Full debug data exported to console and downloaded as JSON file');
                    });
                }
            }, 1000);
        }
    } else {
        debugMessage('Configurator initialization failed', {
            configuratorWrapperExists: configuratorWrapper.length > 0,
            productConfigExists: !!productConfig,
            hasCharacteristics: !!(productConfig && productConfig.characteristics)
        }, 'error');
    }
});