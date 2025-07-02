<?php
// Sicurezza
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WSS_Configurator_Public {

    private static $instance;

	private function __construct() {
        // Cambiamo l'hook per intercettare e potenzialmente sostituire il template del prodotto singolo
        add_filter( 'wc_get_template_part', array( $this, 'override_single_product_template_content' ), 10, 3 );
        // Potremmo anche aver bisogno di 'woocommerce_locate_template' o 'template_include' per un controllo ancora maggiore
        // Registrazione dello shortcode
        add_shortcode( 'wss_product_configurator', array( $this, 'shortcode_product_configurator' ) );
	}

    public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

    /**
     * Sovrascrive il contenuto del template del prodotto singolo se è un prodotto configurabile.
     * Ci concentriamo su 'content-single-product.php' che è il cuore della visualizzazione.
     */
    public function override_single_product_template_content( $template, $slug, $name ) {
        // Vogliamo sovrascrivere solo il template 'content-single-product.php'
        if ( $slug === 'content' && $name === 'single-product' ) {
            global $product;

            if ( $product && is_a( $product, 'WC_Product' ) ) {
                $config_data = get_post_meta( $product->get_id(), '_wss_product_config_v3', true );

                // Se il prodotto HA una configurazione WSS valida, usa il nostro template
                if ( !empty($config_data) && !empty($config_data['characteristics']) && is_array($config_data['characteristics']) ) {
                    // Ritorna il percorso al NOSTRO template personalizzato per il configuratore.
                    // Questo template dovrà contenere TUTTA la struttura della pagina prodotto che vogliamo,
                    // inclusi gli hook standard di WooCommerce che vogliamo mantenere (es. per header, footer, related products)
                    // o ricostruire la struttura necessaria.
                    
                    // Il nostro product-configurator-display.php diventa di fatto il nuovo content-single-product.php
                    $custom_template = WSS_CP_PLUGIN_DIR . 'templates/product-configurator-display.php';
                    
                    if ( file_exists( $custom_template ) ) {
                        // WooCommerce si aspetta che wc_get_template_part ritorni il percorso del file
                        // e poi lo include. Qui lo stiamo "intercettando".
                        // Per forzare il nostro, potremmo dover usare 'template_include' o caricare direttamente.

                        // Per ora, facciamo in modo che il nostro template 'product-configurator-display.php'
                        // sia strutturato come un 'content-single-product.php' completo.
                        return $custom_template; 
                    }
                }
            }
        }
        // Altrimenti, ritorna il template originale di WooCommerce
        return $template;
    }

    /**
     * Shortcode per mostrare il configuratore prodotto
     * Uso: [wss_product_configurator sku="SKU_PRODOTTO"]
     */
    public function shortcode_product_configurator( $atts ) {
        $atts = shortcode_atts( array(
            'sku' => ''
        ), $atts, 'wss_product_configurator' );

        $product = null;
        if ( ! empty( $atts['sku'] ) ) {
            $product = wc_get_product( wc_get_product_id_by_sku( $atts['sku'] ) );
        } elseif ( is_product() ) {
            global $product;
        }
        if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
            return '<p>Prodotto non valido o non trovato.</p>';
        }
        $config_data = get_post_meta( $product->get_id(), '_wss_product_config_v3', true );
        if ( empty( $config_data ) || empty( $config_data['characteristics'] ) ) {
            return '<p>Configurazione prodotto non trovata.</p>';
        }
        ob_start();
        include WSS_CP_PLUGIN_DIR . 'templates/product-configurator-display.php';
        return ob_get_clean();
    }
}
?>