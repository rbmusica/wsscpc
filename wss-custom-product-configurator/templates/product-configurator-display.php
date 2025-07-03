<?php
/**
 * WSS Custom Product Configurator - Display Template
 * Questo template SOSTITUISCE content-single-product.php per i prodotti configurabili.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; 
}

global $product; 

if ( ! isset( $config_data ) ) { // Assicurati che config_data sia disponibile
    $config_data_check = get_post_meta( $product->get_id(), '_wss_product_config_v3', true );
    if (empty($config_data_check) || empty($config_data_check['characteristics'])) {
        // Se non c'è configurazione, e stiamo sovrascrivendo, dovremmo mostrare il contenuto standard
        // Questo scenario dovrebbe essere gestito da WSS_Configurator_Public per non sovrascrivere affatto.
        // Per sicurezza, se arriviamo qui senza config_data, mostriamo un errore o il prodotto standard.
        echo "<p>Errore: la configurazione del prodotto non è disponibile e questo template la richiede.</p>";
        // Se vuoi provare a caricare il template standard di WooCommerce come fallback:
        // wc_get_template( 'content-single-product.php' ); // Attenzione: potenziale loop se non gestito con cura
        return;
    }
    $config_data = $config_data_check;
}

if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
    echo '<p>Errore: Prodotto non valido.</p>';
    return;
}

$base_image_url = !empty($config_data['base_image_default']) ? esc_url($config_data['base_image_default']) : wc_placeholder_img_src('woocommerce_single');
$product_id = $product->get_id();
$product_name = $product->get_name();
$image_orientation = isset($config_data['image_orientation']) ? $config_data['image_orientation'] : 'vertical';

// Recupera il colore di sfondo personalizzato dalla configurazione del prodotto.
$background_color = !empty($config_data['background_color']) ? esc_attr($config_data['background_color']) : '';

// do_action( 'woocommerce_before_single_product' ); // Messaggi, breadcrumbs

if ( post_password_required() ) {
	echo get_the_password_form();
	return;
}
?>
<div id="product-<?php echo esc_attr($product_id); /* Usiamo ID prodotto per unicità */ ?>" <?php wc_product_class( 'wss-product-configurator-container wss-orientation-' . esc_attr($image_orientation), $product ); ?>>
    
    <div id="wss-product-configurator-<?php echo esc_attr( $product_id ); ?>" class="wss-product-configurator-wrapper" data-orientation="<?php echo esc_attr($image_orientation); ?>">
        <?php
/**
 * Descrizione estesa a larghezza piena per orientamento verticale
 */
if ( 'vertical' === $image_orientation && $product->get_short_description() ) { ?>
    <div class="wss-configurator-description-full woocommerce-product-details__short-description">
        <?php
        echo apply_filters(
            'woocommerce_short_description',
            $product->get_short_description()
        );
        ?>
    </div>
<?php } ?>

<div class="wss-configurator-main-layout">

            <div class="wss-configurator-image-column">
                <div class="wss-image-container" <?php if ( $background_color ) { echo 'style="background-color: ' . $background_color . ';"'; } ?>>
                    <img id="wss-configured-product-image-base" src="<?php echo esc_url( $base_image_url ); ?>" alt="<?php echo esc_attr( $product_name ); ?>" title="<?php echo esc_attr( $product_name ); ?>">
                </div>
            </div>

            <div class="wss-configurator-options-column summary entry-summary">
                <h1 class="product_title entry-title"><?php echo esc_html( $product_name ); ?></h1>
                
                <div class="wss-current-price">
                    <p class="price"><?php echo $product->get_price_html(); ?></p>
                </div>

                <?php
                    // Mantieni la descrizione dentro la colonna opzioni solo in orizzontale
                    if ( 'horizontal' === $image_orientation && $product->get_short_description() ) : ?>
                    <div class="woocommerce-product-details__short-description">
                        <?php echo apply_filters( 'woocommerce_short_description', $product->get_short_description() ); ?>
                    </div>
                <?php endif; ?>

                <form class="wss-configurator-form cart" action="<?php echo esc_url( apply_filters( 'woocommerce_add_to_cart_form_action', $product->get_permalink() ) ); ?>" method="post" enctype='multipart/form-data'>
                    <div id="wss-characteristics-options">
                        <?php if ( ! empty( $config_data['characteristics'] ) ) : ?>
                            <?php foreach ( $config_data['characteristics'] as $char_index => $characteristic ) : ?>
                                <?php
                                    if (empty($characteristic['name']) || empty($characteristic['slug'])) continue;
                                    $char_slug = esc_attr( $characteristic['slug'] );
                                    $char_name = esc_html( $characteristic['name'] );
                                    $char_type = esc_attr( !empty($characteristic['type']) ? $characteristic['type'] : 'radio' ); 
                                ?>
                                <div class="wss-characteristic-group" id="wss-char-group-<?php echo $char_slug; ?>" data-char-slug="<?php echo $char_slug; ?>">
                                    <h3 class="wss-characteristic-name"><?php echo $char_name; ?></h3>
                                    <div class="wss-options-list">
                                        <?php if ( ! empty( $characteristic['options'] ) && is_array($characteristic['options']) ) : ?>
                                            <?php if ( $char_type === 'select' ) : ?>
                                                <select name="wss_selected_options[<?php echo $char_slug; ?>]" id="wss-select-<?php echo $char_slug; ?>" class="wss-option-selector">
                                                    <option value=""><?php echo esc_html_e( 'Scegli un\'opzione...', 'wss-custom-product-configurator' ); ?></option>
                                                    <?php foreach ( $characteristic['options'] as $opt_index => $option ) : ?>
                                                        <?php
                                                            if (empty($option['label']) || (!isset($option['value']) || $option['value'] === '')) continue;
                                                            $opt_value = esc_attr( $option['value'] );
                                                            $opt_label_text = esc_html( $option['label'] ); // Solo testo per il select
                                                            $opt_price_adj = !empty($option['price_adjustment']) ? floatval($option['price_adjustment']) : 0;
                                                            $opt_price_display_select = $opt_price_adj !== 0 ? ' (' . ($opt_price_adj > 0 ? '+' : '') . wp_strip_all_tags(wc_price( $opt_price_adj )) . ')' : ''; // Prezzo per select (senza HTML)
                                                            $opt_compatibility_text = !empty($option['compatibility']) ? ' - ' . esc_html($option['compatibility']) : '';
                                                            
                                                            $dependency_data = '';
                                                            if (!empty($option['dependency_char_slug']) && (isset($option['dependency_opt_value']) && $option['dependency_opt_value'] !== '')) {
                                                                $dependency_data = 'data-dependency-char="' . esc_attr($option['dependency_char_slug']) . '" data-dependency-val="' . esc_attr($option['dependency_opt_value']) . '"';
                                                            }
                                                        ?>
                                                        <option value="<?php echo $opt_value; ?>" <?php echo $dependency_data; ?>>
                                                            <?php echo $opt_label_text . $opt_price_display_select . $opt_compatibility_text; ?>
                                                        </option>
                                                    <?php endforeach; ?>
                                                </select>
                                            <?php else : // Radio or Checkbox ?>
                                                <?php foreach ( $characteristic['options'] as $opt_index => $option ) : ?>
                                                    <?php
                                                        if (empty($option['label']) || (!isset($option['value']) || $option['value'] === '')) continue;
                                                        $opt_value = esc_attr( $option['value'] );
                                                        $opt_label_text = esc_html( $option['label'] );
                                                        $opt_price_adj = !empty($option['price_adjustment']) ? floatval($option['price_adjustment']) : 0;
                                                        $opt_price_display = $opt_price_adj !== 0 ? ' (' . ($opt_price_adj > 0 ? '+' : '') . wc_price( $opt_price_adj, array('price_format' => '%1$s%2$s') ) . ')' : '';
                                                        $opt_compatibility_note = !empty($option['compatibility']) ? esc_html($option['compatibility']) : '';
                                                        $opt_icon_url = !empty($option['icon']) ? esc_url($option['icon']) : '';
                                                        $input_type = ($char_type === 'checkbox') ? 'checkbox' : 'radio';
                                                        $input_name = "wss_selected_options[{$char_slug}]" . (($input_type === 'checkbox') ? '[]' : '');
                                                        $input_id = "wss-option-" . $char_slug . '-' . sanitize_key($opt_value);

                                                        $dependency_data_attrs = '';
                                                        if (!empty($option['dependency_char_slug']) && (isset($option['dependency_opt_value']) && $option['dependency_opt_value'] !== '')) {
                                                            $dependency_data_attrs = 'data-dependency-char="' . esc_attr($option['dependency_char_slug']) . '" data-dependency-val="' . esc_attr($option['dependency_opt_value']) . '"';
                                                        }
                                                    ?>
                                                    <div class="wss-option-item <?php echo $input_type; ?>-item" <?php echo $dependency_data_attrs; ?>>
                                                        <input type="<?php echo $input_type; ?>" 
                                                               name="<?php echo $input_name; ?>" 
                                                               id="<?php echo esc_attr($input_id); ?>" 
                                                               value="<?php echo $opt_value; ?>"
                                                               class="wss-option-selector">
                                                        <label for="<?php echo esc_attr($input_id); ?>" class="wss-option-label">
                                                            <?php if ($opt_icon_url): ?>
                                                                <img src="<?php echo $opt_icon_url; ?>" class="wss-option-icon" alt="<?php echo esc_attr($opt_label_text); ?>"> 
                                                            <?php else: // Fallback se non c'è icona, per mantenere allineamento ?>
                                                                <span class="wss-option-icon-placeholder" style="width:28px; height:28px; margin-right:8px; flex-shrink:0; display:inline-block; border:1px dashed #eee;"></span>
                                                            <?php endif; ?>
                                                            <span class="wss-option-text-wrapper">
                                                                <span class="wss-option-text"><?php echo $opt_label_text; ?></span>
                                                                <span class="wss-option-details-line">
                                                                    <?php if ($opt_compatibility_note): ?>
                                                                        <small class="wss-option-compatibility-note"><?php echo $opt_compatibility_note; ?></small>
                                                                    <?php endif; ?>
                                                                    <?php if ($opt_price_adj !== 0) : // Mostra il prezzo solo se diverso da zero ?>
                                                                        <span class="wss-option-price-change"><?php echo $opt_price_display; ?></span>
                                                                    <?php endif; ?>
                                                                </span>
                                                            </span>
                                                        </label>
                                                    </div>
                                                <?php endforeach; ?>
                                            <?php endif; ?>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>

                    <div class="wss-add-to-cart-section"> 
                        <?php woocommerce_quantity_input( array( 'min_value' => 1, 'max_value' => apply_filters( 'woocommerce_quantity_input_max', $product->get_max_purchase_quantity(), $product ) ) ); ?>
                        <button type="submit" class="single_add_to_cart_button button alt"><?php echo esc_html( $product->single_add_to_cart_text() ); ?></button>
                    </div>
                    <input type="hidden" name="add-to-cart" value="<?php echo esc_attr( $product->get_id() ); ?>" />
                    <input type="hidden" name="product_id" value="<?php echo esc_attr( $product->get_id() ); ?>" />
                
                </form>
                
            </div> 
        </div> 
    </div> 

    <?php do_action( 'woocommerce_after_single_product_summary' ); // Tabs, Related, Upsells ?>
</div> 
<?php // do_action( 'woocommerce_after_single_product' ); ?>