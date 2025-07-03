<?php
/**
 * WSS Custom Product Configurator
 *
 * @package   WSS_Custom_Product_Configurator
 * @author    Webshock Studio - Roberto Bottillo
 * @version   1.0.1
 * @license   GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       WSS Custom Product Configurator
 * Plugin URI:        https://webshockstudio.com/wss-custom-product-configurator
 * Description:       Permette la configurazione personalizzata di prodotti WooCommerce con cambio dinamico di immagini (layer PNG) e prezzi. Specifico per chitarre elettriche e altro.
 * Version:           1.0.1
 * Author:            Webshock Studio - Roberto Bottillo
 * Author URI:        https://webshockstudio.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wss-custom-product-configurator
 * Domain Path:       /languages
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * WC requires at least: 6.0
 * WC tested up to: 8.8
 */

// Sicurezza: Impedisce l'accesso diretto al file.
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Definiamo le costanti del plugin
define( 'WSS_CP_VERSION', '1.0.1' ); // Versione aggiornata
define( 'WSS_CP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) ); 
define( 'WSS_CP_PLUGIN_URL', plugin_dir_url( __FILE__ ) ); 
define( 'WSS_CP_PLUGIN_FILE', __FILE__ ); 

/**
 * Dichiara la compatibilità con High-Performance Order Storage (HPOS) di WooCommerce.
 */
add_action( 'before_woocommerce_init', function() {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
} );

/**
 * Classe principale del Plugin WSS Custom Product Configurator.
 */
final class WSS_Custom_Product_Configurator {

	private static $instance;

	private function __construct() {
		$this->includes();
		$this->init_hooks();
        $this->setup_objects();
	}

	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function includes() {
		require_once WSS_CP_PLUGIN_DIR . 'includes/wss-core-functions.php';
		require_once WSS_CP_PLUGIN_DIR . 'includes/class-wss-license-manager.php';
		require_once WSS_CP_PLUGIN_DIR . 'includes/class-wss-license-protection.php';
		require_once WSS_CP_PLUGIN_DIR . 'includes/class-wss-configurator-public.php';
		require_once WSS_CP_PLUGIN_DIR . 'includes/class-wss-configurator-cart.php';
		// Carica le classi admin solo se siamo nel backend per ottimizzare le performance
		if ( is_admin() ) {
			require_once WSS_CP_PLUGIN_DIR . 'includes/class-wss-configurator-admin.php';
			require_once WSS_CP_PLUGIN_DIR . 'includes/class-wss-configurator-settings.php';
		}
	}

	private function setup_objects() {
		// Inizializza sempre il License Manager per primo
		WSS_License_Manager::get_instance();
		
		// Verifica se il plugin è attivo (licenza valida o trial attivo)
		if ($this->is_plugin_active()) {
			WSS_Configurator_Public::get_instance();
			WSS_Configurator_Cart::get_instance();
			if ( is_admin() ) {
				WSS_Configurator_Admin::get_instance();
				WSS_Configurator_Settings::get_instance();
			}
		} else {
			// Plugin non attivo, mostra solo la pagina delle impostazioni/licenza
			if ( is_admin() ) {
				WSS_Configurator_Settings::get_instance();
			}
		}
	}

	// Nuovo metodo per verificare se il plugin è attivo
	private function is_plugin_active() {
		$license_manager = WSS_License_Manager::get_instance();
		
		// Controlla se c'è una licenza valida
		$license_data = $license_manager->get_license_data();
		if ($license_data && isset($license_data['status']) && $license_data['status'] === 'active') {
			return true;
		}
		
		// Controlla se il trial è attivo
		$trial_active = get_option('wss-custom-product-configurator_trial_active');
		$trial_start = get_option('wss-custom-product-configurator_trial_start');
		
		if ($trial_active && $trial_start) {
			$days_passed = (time() - $trial_start) / 86400;
			if ($days_passed <= 30) {
				return true;
			}
		}
		
		return false;
	}

	private function init_hooks() {
		add_action( 'plugins_loaded', array( $this, 'on_plugins_loaded' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_public_scripts_styles' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts_styles' ) );
        register_activation_hook( WSS_CP_PLUGIN_FILE, array( $this, 'activate' ) );
        register_deactivation_hook( WSS_CP_PLUGIN_FILE, array( $this, 'deactivate' ) );
	}

	// Modifica la funzione di attivazione per inizializzare il trial
	public function activate() {
		// Inizializza il periodo di prova se è la prima installazione
		if (!get_option('wss-custom-product-configurator_trial_start')) {
			update_option('wss-custom-product-configurator_trial_start', time());
			update_option('wss-custom-product-configurator_trial_active', true);
		}
		
		// Altre operazioni di attivazione...
	}

	// Aggiungi nella disattivazione la pulizia del cron
	public function deactivate() {
		// Rimuovi il cron job
		wp_clear_scheduled_hook('wss_daily_license_check');
		
		// NON rimuovere i dati di licenza/trial qui
		// così l'utente può riattivare senza perdere la configurazione
	}

	public function on_plugins_loaded() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', array( $this, 'woocommerce_missing_notice' ) );
			return;
		}
		load_plugin_textdomain( 'wss-custom-product-configurator', false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
	}

	public function woocommerce_missing_notice() {
		?>
		<div class="notice notice-error">
			<p><?php esc_html_e( 'WSS Custom Product Configurator richiede WooCommerce per funzionare. Si prega di installare e attivare WooCommerce.', 'wss-custom-product-configurator' ); ?></p>
		</div>
		<?php
	}

	public function enqueue_public_scripts_styles() {
		if ( is_product() ) { // Solo su pagine prodotto singole
            global $post; // Usiamo $post per ottenere l'ID del prodotto in modo affidabile
            if ( ! $post ) return; // Esce se $post non è disponibile

            $product_id = $post->ID;
            $product_obj = wc_get_product( $product_id );

            if ( ! $product_obj || ! is_a( $product_obj, 'WC_Product' ) ) {
                return;
            }
            
            // Verifichiamo se questo prodotto ha una configurazione WSS prima di accodare gli script specifici
            $config_data = get_post_meta( $product_id, '_wss_product_config_v3', true );
            if ( empty($config_data) || empty($config_data['characteristics']) ) {
                return;
            }

			wp_enqueue_style(
				'wss-public-styles',
				WSS_CP_PLUGIN_URL . 'assets/css/wss-public-styles.css',
				array(),
				WSS_CP_VERSION . '.' . filemtime(WSS_CP_PLUGIN_DIR . 'assets/css/wss-public-styles.css') // Cache busting
			);

			wp_enqueue_script(
				'wss-public-scripts',
				WSS_CP_PLUGIN_URL . 'assets/js/wss-public-scripts.js',
				array( 'jquery' ),
				WSS_CP_VERSION . '.' . filemtime(WSS_CP_PLUGIN_DIR . 'assets/js/wss-public-scripts.js'), // Cache busting
				true
			);
            
            $base_price = $product_obj->get_price();
            if ( !is_numeric($base_price) ) {
                $base_price = 0; 
            }
            
            $localized_data = array(
                'ajax_url' => admin_url( 'admin-ajax.php' ),
                'nonce' => wp_create_nonce( 'wss_configurator_nonce' ),
                'product_id' => $product_id,
                'product_base_price' => floatval($base_price),
                'config_settings' => $config_data ? $config_data : array(), // Già verificato sopra
                'image_orientation' => isset($config_data['image_orientation']) ? $config_data['image_orientation'] : 'vertical', // Passa l'orientamento
                'wc_price_args' => array( 
                    'currency_symbol'    => html_entity_decode(get_woocommerce_currency_symbol()), 
                    'decimal_separator'  => wc_get_price_decimal_separator(),
                    'thousand_separator' => wc_get_price_thousand_separator(),
                    'decimals'           => wc_get_price_decimals(),
                ),
                'placeholder_image_url' => wc_placeholder_img_src(),
            );
            wp_localize_script( 'wss-public-scripts', 'wss_configurator_data', $localized_data );
		}
	}

	public function enqueue_admin_scripts_styles( $hook_suffix ) {
        global $post;
		if ( ( 'post.php' === $hook_suffix || 'post-new.php' === $hook_suffix ) && isset($post->post_type) && 'product' === $post->post_type ) {
            wp_enqueue_media();
			wp_enqueue_style(
				'wss-admin-styles',
				WSS_CP_PLUGIN_URL . 'assets/css/wss-admin-styles.css',
				array(),
				WSS_CP_VERSION . '.' . filemtime(WSS_CP_PLUGIN_DIR . 'assets/css/wss-admin-styles.css')
			);
			wp_enqueue_script(
				'wss-admin-scripts',
				WSS_CP_PLUGIN_URL . 'assets/js/wss-admin-scripts.js',
				array( 'jquery', 'jquery-ui-sortable', 'wp-util' ), // Aggiunto wp-util per wp.template
				WSS_CP_VERSION . '.' . filemtime(WSS_CP_PLUGIN_DIR . 'assets/js/wss-admin-scripts.js'),
				true
			);
            wp_localize_script( 'wss-admin-scripts', 'wss_admin_data', array(
                'nonce' => wp_create_nonce( 'wss_admin_nonce' ),
                'text_add_characteristic' => __('Aggiungi Caratteristica', 'wss-custom-product-configurator'),
                'text_add_option' => __('Aggiungi Opzione', 'wss-custom-product-configurator'),
                'text_remove_characteristic' => __('Rimuovi Caratteristica', 'wss-custom-product-configurator'),
                'text_remove_option' => __('Rimuovi Opzione', 'wss-custom-product-configurator'),
                'text_confirm_remove_characteristic' => __('Sei sicuro di voler rimuovere questa caratteristica e tutte le sue opzioni?', 'wss-custom-product-configurator'),
                'text_confirm_remove_option' => __('Sei sicuro di voler rimuovere questa opzione?', 'wss-custom-product-configurator'),
                'text_select_image' => __('Scegli Immagine', 'wss-custom-product-configurator'),
                'text_use_image' => __('Usa questa immagine', 'wss-custom-product-configurator'),
                'text_base_image_key_label' => __('Nome Chiave Immagine Base/URL:', 'wss-custom-product-configurator'),
                'text_layer_image_label' => __('Layer Immagine (PNG):', 'wss-custom-product-configurator'),
            ) );
		}
	}
}

function wss_custom_product_configurator_init() {
	return WSS_Custom_Product_Configurator::get_instance();
}
add_action( 'plugins_loaded', 'wss_custom_product_configurator_init' );

// Hook per menu licenze - FUORI dalla classe
add_action('admin_menu', function() {
    // Verifica che la classe esista prima di usarla
    if (class_exists('WSS_License_Manager')) {
        add_submenu_page(
            'woocommerce',
            'WSS Configurator License', 
            'WSS License',
            'manage_options',
            'wss-configurator-license',
            array(WSS_License_Manager::get_instance(), 'render_license_page')
        );
    }
}, 99);

?>