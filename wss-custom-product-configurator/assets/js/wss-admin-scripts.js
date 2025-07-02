jQuery(document).ready(function($) {
    'use strict';

    let nextCharacteristicIndex = $('#wss-characteristics-container .wss-characteristic-block').length;
    
    function sanitizeForSlug(text) {
        if (!text) return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '_')           
            .replace(/[^\w-]+/g, '')       
            .replace(/__+/g, '_')        
            .replace(/^-+/, '')             
            .replace(/-+$/, '');            
    }

    let mediaUploader;
    $('body').on('click', '.wss-upload-image-button', function(e) {
        e.preventDefault();
        const $button = $(this);
        const $targetInput = $button.siblings($button.data('target-input'));
        const $imagePreviewContainer = $button.siblings('.wss-image-preview');
        const $imagePreviewImg = $imagePreviewContainer.find('img');

        mediaUploader = wp.media({
            title: wss_admin_data.text_select_image || 'Scegli Immagine',
            button: {
                text: wss_admin_data.text_use_image || 'Usa questa immagine'
            },
            multiple: false
        });

        mediaUploader.on('select', function() {
            const attachment = mediaUploader.state().get('selection').first().toJSON();
            if ($targetInput.length) {
                $targetInput.val(attachment.url).trigger('change'); 
            }
            if ($imagePreviewImg.length) {
                $imagePreviewImg.attr('src', attachment.url);
                $imagePreviewContainer.show();
            }
        });
        mediaUploader.open();
    });

    $('body').on('click', '.wss-remove-image-button', function(e) {
        e.preventDefault();
        const $button = $(this);
        const $targetInput = $button.closest('.wss-form-field, .wss-image-preview').find('input[type="text"]'); 
        const $imagePreviewContainer = $button.closest('.wss-image-preview');
        const $imagePreviewImg = $imagePreviewContainer.find('img');

        if ($targetInput.length) {
            $targetInput.val('').trigger('change');
        }
        if ($imagePreviewImg.length) {
            $imagePreviewImg.attr('src', '');
            $imagePreviewContainer.hide();
        }
    });

    $('#wss-add-characteristic-button').on('click', function() {
        const characteristicTemplate = wp.template('wss-characteristic-block');
        const newCharacteristicHtml = characteristicTemplate({
            char_index: nextCharacteristicIndex,
            char_display_index: nextCharacteristicIndex + 1
        });

        $('#wss-characteristics-container').append(newCharacteristicHtml);
        const $newBlock = $('#wss-characteristics-container .wss-characteristic-block[data-index="' + nextCharacteristicIndex + '"]');
        $newBlock.find('.wss-characteristic-content').show(); // Apri il nuovo blocco di default
        $newBlock.find('.wss-characteristic-title .dashicons').removeClass('dashicons-arrow-down').addClass('dashicons-arrow-up');
        
        attachSlugGeneration($newBlock);
        nextCharacteristicIndex++;
    });

    $('body').on('click', '.wss-remove-characteristic-button', function() {
        if (confirm(wss_admin_data.text_confirm_remove_characteristic || 'Sei sicuro di voler rimuovere questa caratteristica e tutte le sue opzioni?')) {
            $(this).closest('.wss-characteristic-block').remove();
        }
    });

    $('body').on('click', '.wss-characteristic-title', function() {
        const $content = $(this).siblings('.wss-characteristic-content');
        const $icon = $(this).find('.dashicons');
        $content.slideToggle(200, function() {
            if ($content.is(':visible')) {
                $icon.removeClass('dashicons-arrow-down').addClass('dashicons-arrow-up');
            } else {
                $icon.removeClass('dashicons-arrow-up').addClass('dashicons-arrow-down');
            }
        });
    });

    $('body').on('change', '.wss-char-has-visual-impact', function() {
        const $checkbox = $(this);
        const $characteristicBlock = $checkbox.closest('.wss-characteristic-content');
        const $optionsContainer = $characteristicBlock.find('.wss-options-container');
        const $baseSwitcherContainer = $characteristicBlock.find('.wss-char-is-base-switcher-container');
        const $isBaseSwitcherCheckbox = $baseSwitcherContainer.find('.wss-char-is-base-switcher');

        if ($checkbox.is(':checked')) {
            $optionsContainer.find('.wss-option-layer-fields').show();
            $baseSwitcherContainer.show();
        } else {
            $optionsContainer.find('.wss-option-layer-fields').hide();
            $baseSwitcherContainer.hide();
            $isBaseSwitcherCheckbox.prop('checked', false).trigger('change'); 
        }
        // Applica l'aggiornamento delle etichette a tutte le opzioni esistenti
        $optionsContainer.find('.wss-option-block').each(function() {
            updateLayerLabelAndZIndexVisibility($(this), $isBaseSwitcherCheckbox.is(':checked'), $checkbox.is(':checked'));
        });
    });
    
    $('body').on('change', '.wss-char-is-base-switcher', function() {
        const $checkbox = $(this); // is_base_switcher checkbox
        const $characteristicBlock = $checkbox.closest('.wss-characteristic-content');
        const $optionsContainer = $characteristicBlock.find('.wss-options-container');
        const $parentHasVisualImpact = $characteristicBlock.find('.wss-char-has-visual-impact');

        $optionsContainer.find('.wss-option-block').each(function() {
            updateLayerLabelAndZIndexVisibility($(this), $checkbox.is(':checked'), $parentHasVisualImpact.is(':checked'));
        });
    });

    function updateLayerLabelAndZIndexVisibility($optionBlock, isBaseSwitcher, parentHasVisualImpact) {
        const $layerFieldsContainer = $optionBlock.find('.wss-option-layer-fields');
        
        if (parentHasVisualImpact) {
            $layerFieldsContainer.show();
            const $layerLabel = $optionBlock.find('.wss-option-layer-label');
            const $layerImagePreviewContainer = $optionBlock.find('.wss-option-layer-fields .wss-form-field').first(); // Il primo form-field dentro layer-fields
            const $layerUrlInput = $layerImagePreviewContainer.find('.wss-option-layer-url');
            const $imagePreviewDiv = $layerImagePreviewContainer.find('.wss-image-preview');
            const $zIndexContainer = $optionBlock.find('.wss-option-z-index-container');
            
            if (isBaseSwitcher) {
                $layerLabel.text(wss_admin_data.text_base_image_key_label || 'Nome Chiave Immagine Base/URL:');
                $imagePreviewDiv.hide(); 
                $zIndexContainer.hide();
            } else {
                $layerLabel.text(wss_admin_data.text_layer_image_label || 'Layer Immagine (PNG):');
                if ($layerUrlInput.val()) {
                    $imagePreviewDiv.show();
                } else {
                    $imagePreviewDiv.hide();
                }
                $zIndexContainer.show();
            }
        } else {
             $layerFieldsContainer.hide();
        }
    }

    $('body').on('click', '.wss-add-option-button', function() {
        const $characteristicBlock = $(this).closest('.wss-characteristic-block');
        const charIndex = $characteristicBlock.data('index');
        const $optionsContainer = $characteristicBlock.find('.wss-options-container');
        let nextOptionIndex = $optionsContainer.find('.wss-option-block').length;

        const optionTemplate = wp.template('wss-option-block');
        const newOptionHtml = optionTemplate({
            char_index: charIndex,
            opt_index: nextOptionIndex,
            opt_display_index: nextOptionIndex + 1
        });
        
        $optionsContainer.append(newOptionHtml);

        const $newOptionBlock = $optionsContainer.find('.wss-option-block[data-option-index="' + nextOptionIndex + '"]');
        const $parentHasVisualImpact = $characteristicBlock.find('.wss-char-has-visual-impact');
        const $parentIsBaseSwitcher = $characteristicBlock.find('.wss-char-is-base-switcher');

        updateLayerLabelAndZIndexVisibility($newOptionBlock, $parentIsBaseSwitcher.is(':checked'), $parentHasVisualImpact.is(':checked'));
        
        attachSlugGeneration($newOptionBlock, true); 
    });

    $('body').on('click', '.wss-remove-option-button', function() {
        if (confirm(wss_admin_data.text_confirm_remove_option || 'Sei sicuro di voler rimuovere questa opzione?')) {
            $(this).closest('.wss-option-block').remove();
        }
    });

    function attachSlugGeneration($container, isOption = false) {
        const $nameInput = isOption ? $container.find('.wss-option-label') : $container.find('.wss-char-name');
        const $slugInput = isOption ? $container.find('.wss-option-value') : $container.find('.wss-char-slug');

        $nameInput.on('keyup change', function() {
            if ($slugInput.val() === '' || $slugInput.data('autogenerated') !== false) { 
                const slug = sanitizeForSlug($(this).val());
                $slugInput.val(slug).data('autogenerated', true);
            }
        });
        
        $slugInput.on('change keyup focus', function() { 
            if ($(this).is(':focus')) { // Solo se l'utente sta attivamente modificando
                 $slugInput.data('autogenerated', false);
            }
        });
    }
    
    $('#wss-characteristics-container .wss-characteristic-block').each(function(idx) {
        const $charBlock = $(this);
        // Assicura che data-index sia corretto se gli indici nel DOM non sono sequenziali (es. dopo riordino o cancellazioni)
        // $charBlock.attr('data-index', idx); // PHP si occuperà di reindicizzare al salvataggio.
                                             // Questo è più per coerenza JS se facessimo operazioni basate su questo.
                                             // Per ora lasciamo che l'indice sia quello caricato da PHP.
        
        attachSlugGeneration($charBlock); 
        
        const $parentHasVisualImpact = $charBlock.find('.wss-char-has-visual-impact');
        const $parentIsBaseSwitcher = $charBlock.find('.wss-char-is-base-switcher');
        
        // Trigger change per inizializzare la visibilità dei campi dipendenti
        $parentHasVisualImpact.trigger('change');
        // $parentIsBaseSwitcher.trigger('change'); // Già scatenato dal change di has_visual_impact


        $charBlock.find('.wss-options-container .wss-option-block').each(function() {
            attachSlugGeneration($(this), true); 
            updateLayerLabelAndZIndexVisibility($(this), $parentIsBaseSwitcher.is(':checked'), $parentHasVisualImpact.is(':checked'));
        });

        if ($charBlock.data('index') > 0 || $('#wss-characteristics-container .wss-characteristic-block').length > 1) {
             $charBlock.find('.wss-characteristic-content').hide();
             $charBlock.find('.wss-characteristic-title .dashicons').removeClass('dashicons-arrow-up').addClass('dashicons-arrow-down');
        } else {
             $charBlock.find('.wss-characteristic-content').show();
             $charBlock.find('.wss-characteristic-title .dashicons').removeClass('dashicons-arrow-down').addClass('dashicons-arrow-up');
        }
    });

    if (typeof $.fn.sortable !== 'undefined') {
        $('#wss-characteristics-container').sortable({
            items: '.wss-characteristic-block',
            handle: '.wss-characteristic-title', 
            placeholder: 'wss-char-sortable-placeholder',
            axis: 'y',
            opacity: 0.7,
            start: function(event, ui) {
                ui.placeholder.height(ui.item.height());
                $('.wss-characteristic-content').hide();
                $('.wss-characteristic-title .dashicons').removeClass('dashicons-arrow-up').addClass('dashicons-arrow-down');
            },
            update: function(event, ui) {
                $('#wss-characteristics-container .wss-characteristic-block').each(function(index) {
                    $(this).find('input[name*="[display_order]"]').val(index);
                    // Non aggiorniamo data-index qui, perché i nomi dei campi contengono l'indice originale
                    // che PHP usa per ricostruire l'array $_POST. PHP re-indicizzerà al salvataggio.
                });
            }
        });
    }
});