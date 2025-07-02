<?php
/**
 * WSS License Manager
 * Sistema di gestione licenze per plugin WordPress
 */

// Classe principale per la gestione delle licenze
class WSS_License_Manager {
    
    private static $instance = null;
    private $plugin_slug = 'wss-custom-product-configurator';
    private $license_server_url = 'https://clientiwss.com/wp-json/wss-licenses/v1/';
    private $product_id = 'wss-configurator-pro';
    
	/**
	 * Ottiene la chiave di crittografia in modo sicuro
	 */
    private function get_encryption_key() {
        // Usa una combinazione di costanti WordPress uniche per l'installazione
        $key = '';
        
        if (defined('SECURE_AUTH_KEY') && defined('SECURE_AUTH_SALT')) {
            $key = SECURE_AUTH_KEY . SECURE_AUTH_SALT;
        } else {
            // Fallback più stabile
            $stored_key = get_option('wss_cp_encryption_key');
            if (!$stored_key) {
                $stored_key = wp_generate_password(64, true, true);
                update_option('wss_cp_encryption_key', $stored_key);
            }
            $key = $stored_key;
        }
        
        // Restituisci sempre una chiave di 32 caratteri
        return substr(hash('sha256', $key), 0, 32);
    }

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('admin_init', array($this, 'check_license_status'));
        add_action('admin_notices', array($this, 'display_license_notices'));
        add_action('wp_ajax_wss_activate_license', array($this, 'ajax_activate_license'));
        add_action('wp_ajax_wss_deactivate_license', array($this, 'ajax_deactivate_license'));
		// Attiva le protezioni avanzate
		if (defined('WSS_ENABLE_ADVANCED_PROTECTION') && WSS_ENABLE_ADVANCED_PROTECTION) {
			WSS_License_Protection::verify_plugin_integrity();
		}        
		
        // Cron job per verifiche periodiche
        add_action('wss_daily_license_check', array($this, 'daily_license_check'));
        if (!wp_next_scheduled('wss_daily_license_check')) {
            wp_schedule_event(time(), 'daily', 'wss_daily_license_check');
        }
    }
    
    /**
     * Verifica lo stato della licenza
     */
    public function check_license_status() {
        $license_data = $this->get_license_data();
        
        // Se non c'è licenza, verifica il periodo di prova
        if (!$license_data || empty($license_data['key'])) {
            $this->check_trial_status();
            return;
        }
        
        // Verifica validità licenza ogni 24 ore
        $last_check = get_option($this->plugin_slug . '_last_check', 0);
        if (time() - $last_check > 86400) { // 24 ore
            $this->validate_license_remote($license_data['key']);
        }
    }

    private function validate_server_connection() {
        $test_url = $this->license_server_url . 'test';
        $response = wp_remote_get($test_url, array('timeout' => 10));
        
        if (is_wp_error($response)) {
            error_log('WSS License: Impossibile connettersi al server licenze: ' . $response->get_error_message());
            return false;
        }
        
        return true;
    }
    
    /**
     * Gestisce il periodo di prova
     */
    private function check_trial_status() {
        $trial_start = get_option($this->plugin_slug . '_trial_start');
        
        if (!$trial_start) {
            // Prima installazione, inizia il trial
            update_option($this->plugin_slug . '_trial_start', time());
            update_option($this->plugin_slug . '_trial_active', true);
            return;
        }
        
        // Verifica se sono passati 30 giorni
        $days_passed = (time() - $trial_start) / 86400;
        if ($days_passed > 30) {
            update_option($this->plugin_slug . '_trial_active', false);
            $this->disable_plugin_features();
        }
    }
    
    /**
     * Attiva una licenza
     */
    public function activate_license($license_key, $email = '') {
        $domain = $this->get_domain();
        
        $response = wp_remote_post($this->license_server_url . 'activate', array(
            'body' => array(
                'license_key' => $license_key,
                'domain' => $domain,
                'email' => $email,
                'product_id' => $this->product_id,
                'environment' => $this->get_environment_info()
            ),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            return array('success' => false, 'message' => 'Errore di connessione al server licenze');
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($data['success']) {
            // Salva i dati della licenza criptati
            $this->save_license_data(array(
                'key' => $license_key,
                'email' => $email,
                'activated_at' => time(),
                'expires_at' => $data['expires_at'],
                'status' => 'active',
                'checksum' => $this->generate_checksum($license_key, $domain)
            ));
            
            update_option($this->plugin_slug . '_last_check', time());
            
            // Disabilita il trial
            update_option($this->plugin_slug . '_trial_active', false);
            
            return array('success' => true, 'message' => 'Licenza attivata con successo');
        }
        
        return array('success' => false, 'message' => $data['message'] ?? 'Errore sconosciuto');
    }
    
    /**
     * Valida la licenza con il server remoto
     */
    private function validate_license_remote($license_key) {
        $domain = $this->get_domain();
        
        $response = wp_remote_post($this->license_server_url . 'validate', array(
            'body' => array(
                'license_key' => $license_key,
                'domain' => $domain,
                'product_id' => $this->product_id
            ),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            // In caso di errore di rete, usa la cache locale ma segna per ricontrollo
            update_option($this->plugin_slug . '_license_check_failed', true);
            return;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!$data['valid']) {
            // Licenza non valida, disabilita
            $this->deactivate_license();
            $this->disable_plugin_features();
        } else {
            // Aggiorna i dati della licenza
            $license_data = $this->get_license_data();
            $license_data['status'] = $data['status'];
            $license_data['expires_at'] = $data['expires_at'];
            $this->save_license_data($license_data);
            
            update_option($this->plugin_slug . '_last_check', time());
            delete_option($this->plugin_slug . '_license_check_failed');
        }
    }
    
    /**
     * Disabilita le funzionalità del plugin
     */
    private function disable_plugin_features() {
        // Impedisci il rendering del configuratore
        add_filter('wc_get_template_part', array($this, 'block_configurator_template'), 999, 3);
        
        // Disabilita l'aggiunta al carrello di prodotti configurati
        add_filter('woocommerce_add_to_cart_validation', array($this, 'block_add_to_cart'), 999, 3);
        
        // Nascondi il meta box admin
        add_action('add_meta_boxes', array($this, 'remove_configurator_metabox'), 999);
    }
    
    public function block_configurator_template($template, $slug, $name) {
        if ($slug === 'content' && $name === 'single-product') {
            global $product;
            if ($product) {
                $config_data = get_post_meta($product->get_id(), '_wss_product_config_v3', true);
                if (!empty($config_data)) {
                    // Mostra messaggio invece del configuratore
                    add_action('woocommerce_before_single_product', array($this, 'show_license_required_message'));
                    return $template; // Ritorna il template standard
                }
            }
        }
        return $template;
    }
    
    public function show_license_required_message() {
        echo '<div class="woocommerce-error">';
        echo '<p><strong>WSS Product Configurator - Licenza Richiesta</strong></p>';
        echo '<p>Il periodo di prova è scaduto. Per continuare ad utilizzare il configuratore prodotti, ';
        echo '<a href="' . admin_url('admin.php?page=wss-configurator-license') . '">attiva una licenza valida</a>.</p>';
        echo '</div>';
    }
    
    /**
     * Salva i dati della licenza criptati
     */
    private function save_license_data($data) {
        $encrypted = $this->encrypt_data(json_encode($data));
        update_option($this->plugin_slug . '_license_data', $encrypted);
        
        // Salva anche un hash per verifica integrità
        update_option($this->plugin_slug . '_license_hash', 
            wp_hash($encrypted . $this->get_domain()));
    }
    
    /**
     * Recupera i dati della licenza
     */
    public function get_license_data() {
        $encrypted = get_option($this->plugin_slug . '_license_data');
        $hash = get_option($this->plugin_slug . '_license_hash');
        
        if (!$encrypted) {
            return null;
        }
        
        // Verifica integrità
        if (wp_hash($encrypted . $this->get_domain()) !== $hash) {
            // Dati manomessi
            $this->deactivate_license();
            return null;
        }
        
        $decrypted = $this->decrypt_data($encrypted);
        return json_decode($decrypted, true);
    }

    public function is_license_active() {
        $license_data = $this->get_license_data();
        
        if (!$license_data) {
            return false;
        }
        
        // Verifica stato
        if (!isset($license_data['status']) || $license_data['status'] !== 'active') {
            return false;
        }
        
        // Verifica scadenza
        if (isset($license_data['expires_at']) && $license_data['expires_at'] > 0) {
            if (time() > $license_data['expires_at']) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Crittografia semplice per i dati locali
     */
    private function encrypt_data($data) {
        $key = $this->get_encryption_key();
        
        if (empty($key)) {
            error_log('WSS License: Chiave di crittografia non disponibile');
            return false;
        }
        
        $iv = openssl_random_pseudo_bytes(16);
        $encrypted = openssl_encrypt($data, 'AES-256-CBC', $key, 0, $iv);
        
        if ($encrypted === false) {
            error_log('WSS License: Errore nella crittografia dei dati');
            return false;
        }
        
        return base64_encode($encrypted . '::' . $iv);
    }

    private function decrypt_data($data) {
        $key = $this->get_encryption_key();
        
        if (empty($key)) {
            error_log('WSS License: Chiave di decrittografia non disponibile');
            return false;
        }
        
        $decoded = base64_decode($data);
        if ($decoded === false) {
            error_log('WSS License: Errore nel decode base64');
            return false;
        }
        
        $parts = explode('::', $decoded, 2);
        if (count($parts) !== 2) {
            error_log('WSS License: Formato dati criptati non valido');
            return false;
        }
        
        list($encrypted_data, $iv) = $parts;
        
        $decrypted = openssl_decrypt($encrypted_data, 'AES-256-CBC', $key, 0, $iv);
        
        if ($decrypted === false) {
            error_log('WSS License: Errore nella decrittografia');
            return false;
        }
        
        return $decrypted;
    }
    
    /**
     * Genera un checksum per validazione locale
     */
    private function generate_checksum($license_key, $domain) {
        return hash('sha256', $license_key . $domain . $this->product_id);
    }
    
    /**
     * Ottiene il dominio corrente normalizzato
     */
    private function get_domain() {
        $domain = $_SERVER['HTTP_HOST'] ?? '';
        $domain = str_replace('www.', '', $domain);
        $domain = preg_replace('/:\d+$/', '', $domain); // Rimuovi porta
        return $domain;
    }
    
    /**
     * Informazioni ambiente per diagnostica
     */
    private function get_environment_info() {
        return array(
            'wp_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'wc_version' => defined('WC_VERSION') ? WC_VERSION : 'N/A',
            'plugin_version' => WSS_CP_VERSION,
            'multisite' => is_multisite(),
            'url' => home_url()
        );
    }
    
    /**
     * Pagina di gestione licenza nell'admin
     */
    public function render_license_page() {
        $license_data = $this->get_license_data();
        $trial_active = get_option($this->plugin_slug . '_trial_active');
        $trial_start = get_option($this->plugin_slug . '_trial_start');
        $trial_days_left = $trial_start ? max(0, 30 - floor((time() - $trial_start) / 86400)) : 30;
        
        ?>
        <div class="wrap">
            <h1>WSS Product Configurator - Licenza</h1>
            
            <?php if ($trial_active && $trial_days_left > 0): ?>
                <div class="notice notice-info">
                    <p><strong>Periodo di prova attivo</strong> - 
                    Rimangono <?php echo $trial_days_left; ?> giorni.</p>
                </div>
            <?php elseif (!$license_data && $trial_days_left <= 0): ?>
                <div class="notice notice-error">
                    <p><strong>Periodo di prova scaduto</strong> - 
                    Attiva una licenza per continuare ad utilizzare il plugin.</p>
                </div>
            <?php endif; ?>
            
            <form method="post" action="" id="wss-license-form">
                <?php wp_nonce_field('wss_license_action', 'wss_license_nonce'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">Chiave Licenza</th>
                        <td>
                            <input type="text" name="license_key" id="license_key" 
                                   value="<?php echo esc_attr($license_data['key'] ?? ''); ?>" 
                                   class="regular-text" <?php echo $license_data ? 'readonly' : ''; ?> />
                            <?php if ($license_data): ?>
                                <span class="license-status status-<?php echo esc_attr($license_data['status']); ?>">
                                    <?php echo ucfirst($license_data['status']); ?>
                                </span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    
                    <?php if (!$license_data): ?>
                    <tr>
                        <th scope="row">Email</th>
                        <td>
                            <input type="email" name="email" id="email" class="regular-text" />
                            <p class="description">Email utilizzata per l'acquisto della licenza</p>
                        </td>
                    </tr>
                    <?php endif; ?>
                    
                    <?php if ($license_data): ?>
                    <tr>
                        <th scope="row">Scadenza</th>
                        <td>
                            <?php 
                            if ($license_data['expires_at'] == 0) {
                                echo 'Licenza lifetime';
                            } else {
                                echo date('d/m/Y', $license_data['expires_at']);
                            }
                            ?>
                        </td>
                    </tr>
                    <?php endif; ?>
                </table>
                
                <?php if ($license_data): ?>
                    <button type="button" class="button" id="deactivate-license">Disattiva Licenza</button>
                <?php else: ?>
                    <button type="button" class="button button-primary" id="activate-license">Attiva Licenza</button>
                <?php endif; ?>
            </form>
            
            <script type="text/javascript">
            jQuery(document).ready(function($) {
                $('#activate-license').on('click', function() {
                    var $button = $(this);
                    var license_key = $('#license_key').val();
                    var email = $('#email').val();
                    
                    if (!license_key) {
                        alert('Inserisci una chiave di licenza valida');
                        return;
                    }
                    
                    $button.prop('disabled', true).text('Attivazione in corso...');
                    
                    $.post(ajaxurl, {
                        action: 'wss_activate_license',
                        license_key: license_key,
                        email: email,
                        nonce: $('#wss_license_nonce').val()
                    }, function(response) {
                        if (response.success) {
                            location.reload();
                        } else {
                            alert(response.data.message);
                            $button.prop('disabled', false).text('Attiva Licenza');
                        }
                    });
                });
                
                $('#deactivate-license').on('click', function() {
                    if (!confirm('Sei sicuro di voler disattivare la licenza?')) {
                        return;
                    }
                    
                    var $button = $(this);
                    $button.prop('disabled', true).text('Disattivazione in corso...');
                    
                    $.post(ajaxurl, {
                        action: 'wss_deactivate_license',
                        nonce: $('#wss_license_nonce').val()
                    }, function(response) {
                        location.reload();
                    });
                });
            });
            </script>
        </div>
        <?php
    }
    
    /**
     * Handler AJAX per attivazione licenza
     */
    public function ajax_activate_license() {
        check_ajax_referer('wss_license_action', 'nonce');
        
        $license_key = sanitize_text_field($_POST['license_key'] ?? '');
        $email = sanitize_email($_POST['email'] ?? '');
        
        $result = $this->activate_license($license_key, $email);
        
        if ($result['success']) {
            wp_send_json_success($result);
        } else {
            wp_send_json_error($result);
        }
    }
    
    /**
     * Deattiva la licenza
     */
    public function deactivate_license() {
        $license_data = $this->get_license_data();
        
        if ($license_data) {
            // Notifica il server
            wp_remote_post($this->license_server_url . 'deactivate', array(
                'body' => array(
                    'license_key' => $license_data['key'],
                    'domain' => $this->get_domain()
                ),
                'timeout' => 30
            ));
        }
        
        // Rimuovi dati locali
        delete_option($this->plugin_slug . '_license_data');
        delete_option($this->plugin_slug . '_license_hash');
        delete_option($this->plugin_slug . '_last_check');
    }

    /**
     * Mostra notifiche sullo stato della licenza/trial nella dashboard admin
     */
    public function display_license_notices() {
        $license_data = $this->get_license_data();
        $trial_active = get_option($this->plugin_slug . '_trial_active');
        $trial_start = get_option($this->plugin_slug . '_trial_start');
        $trial_days_left = $trial_start ? max(0, 30 - floor((time() - $trial_start) / 86400)) : 30;

        // Se la licenza è attiva, nessuna notifica
        if ($this->is_license_active()) {
            return;
        }

        // Se il trial è attivo e non scaduto
        if ($trial_active && $trial_days_left > 0) {
            echo '<div class="notice notice-info is-dismissible">';
            echo '<p><strong>WSS Product Configurator:</strong> Il periodo di prova è attivo. Rimangono <strong>' . $trial_days_left . '</strong> giorni. Inserisci una licenza per continuare a usare il plugin senza interruzioni.</p>';
            echo '</div>';
        } elseif (!$license_data && $trial_days_left <= 0) {
            // Trial scaduto e nessuna licenza
            echo '<div class="notice notice-error">';
            echo '<p><strong>WSS Product Configurator:</strong> Il periodo di prova è scaduto. Inserisci una licenza valida per continuare a utilizzare il plugin. <a href="' . admin_url('admin.php?page=wss-configurator-license') . '">Gestisci licenza</a></p>';
            echo '</div>';
        } elseif ($license_data && isset($license_data['status']) && $license_data['status'] !== 'active') {
            // Licenza inserita ma non valida
            echo '<div class="notice notice-error">';
            echo '<p><strong>WSS Product Configurator:</strong> La licenza inserita non è valida o è scaduta. <a href="' . admin_url('admin.php?page=wss-configurator-license') . '">Gestisci licenza</a></p>';
            echo '</div>';
        }
    }
}