<?php
// Sicurezza
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WSS_Configurator_Cart
 * Gestisce l'integrazione del configuratore con il carrello e gli ordini.
 */
class WSS_Configurator_Cart {

    private static $instance;
    const CONFIG_META_KEY = '_wss_product_configuration'; 

	private function __construct() {
        add_filter( 'woocommerce_add_cart_item_data', array( $this, 'add_configuration_to_cart_item_data' ), 10, 3 );
        add_filter( 'woocommerce_get_item_data', array( $this, 'display_configuration_in_cart' ), 10, 2 );
        add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'add_configuration_to_order_item_meta' ), 10, 4 );
        add_action( 'woocommerce_before_calculate_totals', array( $this, 'adjust_cart_item_price' ), 20, 1 );
        add_filter( 'woocommerce_cart_item_unique_id', array( $this, 'generate_unique_cart_item_id' ), 10, 3 ); // Corretto da cart_item_unique_id
    }

    public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

    public function add_configuration_to_cart_item_data( $cart_item_data, $product_id, $variation_id ) {
        if ( isset( $_POST['wss_selected_options'] ) && is_array( $_POST['wss_selected_options'] ) ) {
            $selected_config_to_store = array(); // Per i meta leggibili
            $config_data_full = get_post_meta( $product_id, '_wss_product_config_v3', true );

            if ( empty($config_data_full) || empty($config_data_full['characteristics']) ) {
                return $cart_item_data; 
            }

            $total_price_adjustment = 0;

            foreach ( $_POST['wss_selected_options'] as $char_slug => $selected_opt_value_or_values ) {
                $characteristic = null;
                foreach ($config_data_full['characteristics'] as $char) {
                    if ($char['slug'] === $char_slug) {
                        $characteristic = $char;
                        break;
                    }
                }

                if ( !$characteristic ) continue;

                $current_char_selections_for_meta = array();
                $values_to_process = is_array($selected_opt_value_or_values) ? $selected_opt_value_or_values : array($selected_opt_value_or_values);

                foreach ($values_to_process as $selected_opt_value) {
                    if (empty($selected_opt_value) && $selected_opt_value !== '0') continue; // Permette valore '0'

                    $option_data = null;
                    if (isset($characteristic['options']) && is_array($characteristic['options'])) {
                        foreach ($characteristic['options'] as $opt) {
                            if ( (string)$opt['value'] === (string)$selected_opt_value ) { // Confronto come stringhe
                                $option_data = $opt;
                                break;
                            }
                        }
                    }


                    if ( $option_data ) {
                        $current_char_selections_for_meta[] = array(
                            'label' => $option_data['label'],
                            'value' => $option_data['value'], // Salviamo il valore per coerenza
                            'price_adjustment' => isset($option_data['price_adjustment']) ? floatval($option_data['price_adjustment']) : 0
                        );
                        if (isset($option_data['price_adjustment'])) {
                             $total_price_adjustment += floatval($option_data['price_adjustment']);
                        }
                    }
                }
                if (!empty($current_char_selections_for_meta)) {
                    $selected_config_to_store[] = array(
                        'name'    => $characteristic['name'],
                        'slug'    => $char_slug, // Utile per debug o ricostruzione
                        'options' => $current_char_selections_for_meta,
                    );
                }
            }

            if ( ! empty( $selected_config_to_store ) ) {
                $cart_item_data[self::CONFIG_META_KEY] = $selected_config_to_store;
                $cart_item_data[self::CONFIG_META_KEY . '_price_adj'] = $total_price_adjustment;
                // I dati originali inviati dal form (più grezzi, ma utili per l'univocità)
                $cart_item_data[self::CONFIG_META_KEY . '_raw'] = $_POST['wss_selected_options']; 
            }
        }
        return $cart_item_data;
    }

    public function display_configuration_in_cart( $item_data, $cart_item ) {
        if ( isset( $cart_item[self::CONFIG_META_KEY] ) && is_array($cart_item[self::CONFIG_META_KEY]) ) {
            $config_details = $cart_item[self::CONFIG_META_KEY];
            foreach ( $config_details as $config_group ) {
                $option_labels = array();
                if (isset($config_group['options']) && is_array($config_group['options'])) {
                    foreach ($config_group['options'] as $option) {
                        $option_labels[] = esc_html( $option['label'] );
                    }
                }

                if (!empty($option_labels)) {
                    $item_data[] = array(
                        'key'     => esc_html( $config_group['name'] ),
                        'value'   => implode( ', ', $option_labels ),
                        'display' => '',
                    );
                }
            }
        }
        return $item_data;
    }

    public function add_configuration_to_order_item_meta( $item, $cart_item_key, $values, $order ) {
        if ( isset( $values[self::CONFIG_META_KEY] ) && is_array($values[self::CONFIG_META_KEY]) ) {
            $config_details = $values[self::CONFIG_META_KEY];
            // $item->add_meta_data( '_wss_config_title', __( 'Configurazione Personalizzata', 'wss-custom-product-configurator' ), true );

            foreach ( $config_details as $config_group ) {
                $option_labels = array();
                 if (isset($config_group['options']) && is_array($config_group['options'])) {
                    foreach ($config_group['options'] as $option) {
                        $price_adj_display = '';
                        if ( isset($option['price_adjustment']) && $option['price_adjustment'] != 0 ) {
                            // Non mostrare il prezzo qui se già incluso nel prezzo totale dell'item.
                            // $price_adj_display = ' (' . wc_price($option['price_adjustment']) . ')'; 
                        }
                        $option_labels[] = esc_html( $option['label'] ) . $price_adj_display;
                    }
                }
                if (!empty($option_labels)) {
                    $item->add_meta_data(
                        esc_html( $config_group['name'] ),
                        implode( ', ', $option_labels ),
                        false // non univoco, così se ci sono più item con stessa config, vengono visualizzati
                    );
                }
            }
        }
    }
    
    public function generate_unique_cart_item_id( $item_id_str, $cart_item_data, $cart_item_key ) {
        // Usa i dati grezzi per l'univocità, in quanto più stabili e diretti dal form
        if ( isset( $cart_item_data[self::CONFIG_META_KEY . '_raw'] ) ) {
            $config_hash = md5( wp_json_encode( $cart_item_data[self::CONFIG_META_KEY . '_raw'] ) );
            return $cart_item_data['product_id'] . '_' . ( !empty($cart_item_data['variation_id']) ? $cart_item_data['variation_id'] : '0') . '_' . $config_hash;
        }
        return $item_id_str;
    }

    public function adjust_cart_item_price( $cart ) {
        if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
            return;
        }

        foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
            if ( isset( $cart_item[self::CONFIG_META_KEY . '_price_adj'] ) ) {
                $product = $cart_item['data']; 
                // Per ottenere il prezzo base del prodotto senza altre modifiche precedenti al carrello:
                $original_product = wc_get_product($product->get_id());
                if ($original_product) {
                    $base_price = $original_product->get_price('edit'); 
                    $total_adjustment = floatval( $cart_item[self::CONFIG_META_KEY . '_price_adj'] );
                    
                    $new_price = $base_price + $total_adjustment;
                    $cart_item['data']->set_price( $new_price );
                }
            }
        }
    }
}
?>