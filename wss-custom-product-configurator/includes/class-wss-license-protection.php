<?php
/**
 * Meccanismi aggiuntivi di protezione per WSS License Manager
 */

// 1. Offuscazione del codice critico
class WSS_License_Protection {
    
    /**
     * Verifica l'integrità dei file del plugin
     */
    public static function verify_plugin_integrity() {
        $critical_files = array(
            'wss-custom-product-configurator.php',
            'includes/class-wss-license-manager.php',
            'includes/class-wss-configurator-public.php'
        );
        
        $stored_hashes = get_option('wss_cp_file_hashes');
        $current_hashes = array();
        
        foreach ($critical_files as $file) {
            $file_path = WSS_CP_PLUGIN_DIR . $file;
            if (file_exists($file_path)) {
                $current_hashes[$file] = hash_file('sha256', $file_path);
            }
        }
        
        // Prima esecuzione, salva gli hash
        if (!$stored_hashes) {
            update_option('wss_cp_file_hashes', $current_hashes);
            return true;
        }
        
        // Confronta gli hash
        foreach ($critical_files as $file) {
            if (!isset($current_hashes[$file]) || 
                !isset($stored_hashes[$file]) || 
                $current_hashes[$file] !== $stored_hashes[$file]) {
                
                // File modificato! Possibile tampering
                self::handle_tampering_detected();
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Gestisce il rilevamento di manomissioni
     */
    private static function handle_tampering_detected() {
        // Log dell'evento
        error_log('WSS Plugin: Possibile manomissione rilevata!');
        
        // Notifica l'amministratore
        $admin_email = get_option('admin_email');
        wp_mail(
            $admin_email,
            'Avviso di Sicurezza - WSS Plugin',
            'È stata rilevata una possibile manomissione dei file del plugin WSS Custom Product Configurator.'
        );
        
        // Disabilita il plugin per sicurezza
        update_option('wss_cp_tampering_detected', true);
        
        // Forza rivalidazione licenza
        delete_option('wss-custom-product-configurator_last_check');
    }
    
    /**
     * Codifica le chiamate API sensibili
     */
    public static function encode_api_call($endpoint, $data) {
        $payload = json_encode($data);
        $encoded = base64_encode($payload);
        
        // Aggiungi firma HMAC per validazione
        $signature = hash_hmac('sha256', $encoded, self::get_api_secret());
        
        return array(
            'payload' => $encoded,
            'signature' => $signature
        );
    }
    
    /**
     * Ottiene il secret per le API (univoco per installazione)
     */
    private static function get_api_secret() {
        $secret = get_option('wss_cp_api_secret');
        
        if (!$secret) {
            $secret = wp_generate_password(32, true, true);
            update_option('wss_cp_api_secret', $secret);
        }
        
        return $secret;
    }
    
    /**
     * Verifica che il plugin non sia in esecuzione in un debugger
     */
    public static function anti_debug_check() {
        // Verifica xdebug
        if (extension_loaded('xdebug')) {
            // In produzione, potresti voler disabilitare alcune funzionalità
            define('WSS_DEBUG_MODE_DETECTED', true);
        }
        
        // Verifica se ci sono breakpoint comuni
        $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
        if (count($backtrace) > 50) {
            // Stack trace sospettosamente profondo
            define('WSS_SUSPICIOUS_EXECUTION', true);
        }
    }
    
    /**
     * Offusca stringhe sensibili nel codice
     */
    public static function deobfuscate($str) {
        // Semplice esempio - in produzione usa qualcosa di più complesso
        return base64_decode(str_rot13($str));
    }
}

// 2. Hook di protezione da aggiungere al plugin principale

// Verifica integrità all'avvio
add_action('plugins_loaded', function() {
    if (defined('WSS_CP_PLUGIN_DIR')) {
        WSS_License_Protection::verify_plugin_integrity();
    }
}, 5);

// Anti-debugging
add_action('init', array('WSS_License_Protection', 'anti_debug_check'), 1);

// 3. Protezione del database

/**
 * Cripta i dati sensibili prima di salvarli nel database
 */
function wss_encrypt_sensitive_data($data, $key = null) {
    if (!$key) {
        $key = defined('SECURE_AUTH_KEY') ? SECURE_AUTH_KEY : 'fallback-key';
    }
    
    $method = 'AES-256-CBC';
    $iv_length = openssl_cipher_iv_length($method);
    $iv = openssl_random_pseudo_bytes($iv_length);
    
    $encrypted = openssl_encrypt(
        serialize($data),
        $method,
        $key,
        OPENSSL_RAW_DATA,
        $iv
    );
    
    return base64_encode($iv . $encrypted);
}

function wss_decrypt_sensitive_data($encrypted_data, $key = null) {
    if (!$key) {
        $key = defined('SECURE_AUTH_KEY') ? SECURE_AUTH_KEY : 'fallback-key';
    }
    
    $method = 'AES-256-CBC';
    $iv_length = openssl_cipher_iv_length($method);
    
    $decoded = base64_decode($encrypted_data);
    $iv = substr($decoded, 0, $iv_length);
    $encrypted = substr($decoded, $iv_length);
    
    $decrypted = openssl_decrypt(
        $encrypted,
        $method,
        $key,
        OPENSSL_RAW_DATA,
        $iv
    );
    
    return $decrypted ? unserialize($decrypted) : false;
}

// 4. Rate limiting per prevenire brute force

class WSS_Rate_Limiter {
    
    public static function check_rate_limit($action, $identifier = null) {
        if (!$identifier) {
            $identifier = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        }
        
        $key = 'wss_rate_limit_' . $action . '_' . md5($identifier);
        $attempts = get_transient($key) ?: 0;
        
        // Limiti per azione
        $limits = array(
            'license_activation' => 5,    // 5 tentativi per ora
            'license_validation' => 100,  // 100 check per ora
            'api_call' => 50             // 50 chiamate API per ora
        );
        
        $limit = $limits[$action] ?? 10;
        
        if ($attempts >= $limit) {
            return false; // Rate limit superato
        }
        
        // Incrementa il contatore
        set_transient($key, $attempts + 1, HOUR_IN_SECONDS);
        
        return true;
    }
    
    public static function log_suspicious_activity($action, $details = array()) {
        $log_entry = array(
            'timestamp' => current_time('mysql'),
            'action' => $action,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'details' => $details
        );
        
        // Salva nel database o in un file di log
        $logs = get_option('wss_security_logs', array());
        $logs[] = $log_entry;
        
        // Mantieni solo gli ultimi 1000 log
        if (count($logs) > 1000) {
            $logs = array_slice($logs, -1000);
        }
        
        update_option('wss_security_logs', $logs);
    }
}

// 5. Funzione per impedire l'esecuzione diretta di file PHP

function wss_add_htaccess_protection() {
    $htaccess_content = <<<HTACCESS
# WSS Plugin Protection
<FilesMatch "\.php$">
    Order Deny,Allow
    Deny from all
    Allow from 127.0.0.1
</FilesMatch>

<Files "index.php">
    Order Allow,Deny
    Allow from all
</Files>

<Files "wss-custom-product-configurator.php">
    Order Allow,Deny
    Allow from all
</Files>
HTACCESS;

    $plugin_dir = WSS_CP_PLUGIN_DIR;
    $htaccess_file = $plugin_dir . '.htaccess';
    
    if (!file_exists($htaccess_file)) {
        file_put_contents($htaccess_file, $htaccess_content);
    }
}

// 6. Monitoraggio e notifiche

class WSS_License_Monitor {
    
    public static function monitor_suspicious_patterns() {
        // Controlla tentativi multipli di attivazione da stesso IP
        $recent_activations = self::get_recent_activations(24); // ultime 24 ore
        
        $ip_counts = array();
        foreach ($recent_activations as $activation) {
            $ip = $activation['ip'] ?? 'unknown';
            $ip_counts[$ip] = ($ip_counts[$ip] ?? 0) + 1;
        }
        
        // Se un IP ha più di 10 attivazioni in 24 ore, è sospetto
        foreach ($ip_counts as $ip => $count) {
            if ($count > 10) {
                WSS_Rate_Limiter::log_suspicious_activity(
                    'multiple_activations',
                    array('ip' => $ip, 'count' => $count)
                );
                
                // Potresti voler bloccare temporaneamente questo IP
                set_transient('wss_blocked_ip_' . md5($ip), true, DAY_IN_SECONDS);
            }
        }
    }
    
    private static function get_recent_activations($hours = 24) {
        global $wpdb;
        
        $since = date('Y-m-d H:i:s', strtotime("-{$hours} hours"));
        
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}wss_license_activations 
             WHERE activated_at > %s",
            $since
        ), ARRAY_A);
    }
}