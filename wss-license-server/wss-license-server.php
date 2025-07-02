<?php
/**
 * Plugin Name: WSS License Server
 * Description: Server per gestione licenze software
 * Version: 1.0.0
 */

// Registra gli endpoint REST API
add_action('rest_api_init', function() {
    // Endpoint per attivazione licenza
    register_rest_route('wss-licenses/v1', '/activate', array(
        'methods' => 'POST',
        'callback' => 'wss_activate_license_endpoint',
        'permission_callback' => '__return_true'
    ));
    
    // Endpoint per validazione licenza
    register_rest_route('wss-licenses/v1', '/validate', array(
        'methods' => 'POST',
        'callback' => 'wss_validate_license_endpoint',
        'permission_callback' => '__return_true'
    ));
    
    // Endpoint per disattivazione licenza
    register_rest_route('wss-licenses/v1', '/deactivate', array(
        'methods' => 'POST',
        'callback' => 'wss_deactivate_license_endpoint',
        'permission_callback' => '__return_true'
    ));
});

/**
 * Tabella database per le licenze
 */
function wss_create_licenses_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wss_licenses';
    
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        license_key varchar(255) NOT NULL,
        email varchar(100) NOT NULL,
        customer_name varchar(255),
        product_id varchar(100) NOT NULL,
        status varchar(20) DEFAULT 'inactive',
        max_activations smallint DEFAULT 1,
        current_activations smallint DEFAULT 0,
        expires_at datetime DEFAULT NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        order_id bigint(20),
        notes text,
        PRIMARY KEY (id),
        UNIQUE KEY license_key (license_key),
        KEY email (email),
        KEY status (status)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    
    // Tabella per le attivazioni
    $table_activations = $wpdb->prefix . 'wss_license_activations';
    
    $sql = "CREATE TABLE $table_activations (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        license_id mediumint(9) NOT NULL,
        domain varchar(255) NOT NULL,
        activated_at datetime DEFAULT CURRENT_TIMESTAMP,
        last_check datetime,
        environment text,
        status varchar(20) DEFAULT 'active',
        PRIMARY KEY (id),
        KEY license_id (license_id),
        KEY domain (domain)
    ) $charset_collate;";
    
    dbDelta($sql);
}
register_activation_hook(__FILE__, 'wss_create_licenses_table');

/**
 * Genera una chiave di licenza univoca
 */
function wss_generate_license_key() {
    $segments = array();
    for ($i = 0; $i < 4; $i++) {
        $segments[] = strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 4));
    }
    return implode('-', $segments); // Es: ABCD-EFGH-IJKL-MNOP
}

/**
 * Crea automaticamente licenze quando un ordine viene completato
 */
add_action('woocommerce_order_status_completed', function($order_id) {
    $order = wc_get_order($order_id);
    
    foreach ($order->get_items() as $item) {
        $product = $item->get_product();
        
        // Verifica se il prodotto è una licenza software
        if ($product && $product->get_meta('_is_license_product') === 'yes') {
            global $wpdb;
            $table_name = $wpdb->prefix . 'wss_licenses';
            
            // Genera licenza
            $license_key = wss_generate_license_key();
            
            // Determina la scadenza in base al tipo di licenza
            $license_type = $product->get_meta('_license_type');
            $expires_at = null;
            
            if ($license_type === 'annual') {
                $expires_at = date('Y-m-d H:i:s', strtotime('+1 year'));
            } elseif ($license_type === '6months') {
                $expires_at = date('Y-m-d H:i:s', strtotime('+6 months'));
            }
            // lifetime = null (nessuna scadenza)
            
            $wpdb->insert($table_name, array(
                'license_key' => $license_key,
                'email' => $order->get_billing_email(),
                'customer_name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'product_id' => $product->get_meta('_license_product_id') ?: 'wss-configurator-pro',
                'status' => 'inactive',
                'max_activations' => intval($product->get_meta('_max_activations') ?: 1),
                'expires_at' => $expires_at,
                'order_id' => $order_id
            ));
            
            // Invia email con la licenza
            wss_send_license_email($order->get_billing_email(), $license_key, $product);
        }
    }
});

/**
 * Endpoint per attivare una licenza
 */
function wss_activate_license_endpoint($request) {
    global $wpdb;
    
    $license_key = sanitize_text_field($request->get_param('license_key'));
    $domain = sanitize_text_field($request->get_param('domain'));
    $email = sanitize_email($request->get_param('email'));
    $product_id = sanitize_text_field($request->get_param('product_id'));
    
    if (empty($license_key) || empty($domain)) {
        return new WP_Error('missing_data', 'Dati mancanti', array('status' => 400));
    }
    
    // Verifica la licenza
    $table_name = $wpdb->prefix . 'wss_licenses';
    $license = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_name WHERE license_key = %s",
        $license_key
    ));
    
    if (!$license) {
        return array('success' => false, 'message' => 'Licenza non valida');
    }
    
    // Verifica email se fornita
    if (!empty($email) && $license->email !== $email) {
        return array('success' => false, 'message' => 'Email non corrisponde alla licenza');
    }
    
    // Verifica scadenza
    if ($license->expires_at && strtotime($license->expires_at) < time()) {
        return array('success' => false, 'message' => 'Licenza scaduta');
    }
    
    // Verifica numero massimo di attivazioni
    $table_activations = $wpdb->prefix . 'wss_license_activations';
    $active_count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table_activations WHERE license_id = %d AND status = 'active'",
        $license->id
    ));
    
    // Verifica se questo dominio è già attivato
    $existing_activation = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_activations WHERE license_id = %d AND domain = %s AND status = 'active'",
        $license->id, $domain
    ));
    
    if ($existing_activation) {
        // Aggiorna il last_check
        $wpdb->update($table_activations, 
            array('last_check' => current_time('mysql')),
            array('id' => $existing_activation->id)
        );
        
        return array(
            'success' => true, 
            'message' => 'Licenza già attiva per questo dominio',
            'expires_at' => $license->expires_at ? strtotime($license->expires_at) : 0
        );
    }
    
    if ($active_count >= $license->max_activations) {
        return array('success' => false, 'message' => 'Numero massimo di attivazioni raggiunto');
    }
    
    // Attiva la licenza
    $wpdb->insert($table_activations, array(
        'license_id' => $license->id,
        'domain' => $domain,
        'environment' => json_encode($request->get_param('environment')),
        'status' => 'active'
    ));
    
    // Aggiorna lo stato della licenza principale se prima era inattiva
    if ($license->status === 'inactive') {
        $wpdb->update($table_name, 
            array('status' => 'active'),
            array('id' => $license->id)
        );
    }
    
    // Aggiorna il conteggio attivazioni
    $wpdb->update($table_name,
        array('current_activations' => $active_count + 1),
        array('id' => $license->id)
    );
    
    return array(
        'success' => true, 
        'message' => 'Licenza attivata con successo',
        'expires_at' => $license->expires_at ? strtotime($license->expires_at) : 0
    );
}

/**
 * Endpoint per validare una licenza
 */
function wss_validate_license_endpoint($request) {
    global $wpdb;
    
    $license_key = sanitize_text_field($request->get_param('license_key'));
    $domain = sanitize_text_field($request->get_param('domain'));
    
    if (empty($license_key) || empty($domain)) {
        return new WP_Error('missing_data', 'Dati mancanti', array('status' => 400));
    }
    
    // Verifica la licenza e l'attivazione
    $query = $wpdb->prepare("
        SELECT l.*, a.status as activation_status, a.id as activation_id
        FROM {$wpdb->prefix}wss_licenses l
        LEFT JOIN {$wpdb->prefix}wss_license_activations a ON l.id = a.license_id
        WHERE l.license_key = %s AND a.domain = %s AND a.status = 'active'
    ", $license_key, $domain);
    
    $result = $wpdb->get_row($query);
    
    if (!$result) {
        return array('valid' => false, 'message' => 'Licenza non trovata o non attiva per questo dominio');
    }
    
    // Verifica scadenza
    if ($result->expires_at && strtotime($result->expires_at) < time()) {
        // Marca come scaduta
        $wpdb->update($wpdb->prefix . 'wss_license_activations',
            array('status' => 'expired'),
            array('id' => $result->activation_id)
        );
        
        return array('valid' => false, 'message' => 'Licenza scaduta');
    }
    
    // Aggiorna last_check
    $wpdb->update($wpdb->prefix . 'wss_license_activations',
        array('last_check' => current_time('mysql')),
        array('id' => $result->activation_id)
    );
    
    return array(
        'valid' => true,
        'status' => $result->status,
        'expires_at' => $result->expires_at ? strtotime($result->expires_at) : 0
    );
}

/**
 * Endpoint per disattivare una licenza
 */
function wss_deactivate_license_endpoint($request) {
    global $wpdb;
    
    $license_key = sanitize_text_field($request->get_param('license_key'));
    $domain = sanitize_text_field($request->get_param('domain'));
    
    if (empty($license_key) || empty($domain)) {
        return new WP_Error('missing_data', 'Dati mancanti', array('status' => 400));
    }
    
    // Trova la licenza
    $license = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}wss_licenses WHERE license_key = %s",
        $license_key
    ));
    
    if (!$license) {
        return array('success' => false, 'message' => 'Licenza non trovata');
    }
    
    // Disattiva l'attivazione per questo dominio
    $updated = $wpdb->update(
        $wpdb->prefix . 'wss_license_activations',
        array('status' => 'deactivated'),
        array(
            'license_id' => $license->id,
            'domain' => $domain,
            'status' => 'active'
        )
    );
    
    if ($updated) {
        // Aggiorna il conteggio
        $active_count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}wss_license_activations 
             WHERE license_id = %d AND status = 'active'",
            $license->id
        ));
        
        $wpdb->update(
            $wpdb->prefix . 'wss_licenses',
            array('current_activations' => $active_count),
            array('id' => $license->id)
        );
        
        return array('success' => true, 'message' => 'Licenza disattivata');
    }
    
    return array('success' => false, 'message' => 'Nessuna attivazione trovata');
}

/**
 * Invia email con i dettagli della licenza
 */
function wss_send_license_email($email, $license_key, $product) {
    $subject = 'La tua licenza per ' . $product->get_name();
    
    $message = "Grazie per il tuo acquisto!\n\n";
    $message .= "Ecco i dettagli della tua licenza:\n\n";
    $message .= "Prodotto: " . $product->get_name() . "\n";
    $message .= "Chiave di licenza: " . $license_key . "\n\n";
    $message .= "Per attivare la licenza, vai nelle impostazioni del plugin e inserisci questa chiave.\n\n";
    $message .= "Supporto: support@tuodominio.com\n";
    
    wp_mail($email, $subject, $message);
}

/**
 * Aggiungi metabox per prodotti licenza in WooCommerce
 */
add_action('woocommerce_product_options_general_product_data', function() {
    echo '<div class="options_group">';
    
    woocommerce_wp_checkbox(array(
        'id' => '_is_license_product',
        'label' => __('Prodotto Licenza Software', 'wss'),
        'description' => __('Questo prodotto genera una licenza software', 'wss')
    ));
    
    woocommerce_wp_select(array(
        'id' => '_license_type',
        'label' => __('Tipo Licenza', 'wss'),
        'options' => array(
            'lifetime' => __('Lifetime', 'wss'),
            'annual' => __('Annuale', 'wss'),
            '6months' => __('6 Mesi', 'wss')
        )
    ));
    
    woocommerce_wp_text_input(array(
        'id' => '_max_activations',
        'label' => __('Attivazioni Massime', 'wss'),
        'type' => 'number',
        'custom_attributes' => array(
            'min' => '1',
            'max' => '100'
        ),
        'value' => '1'
    ));
    
    woocommerce_wp_text_input(array(
        'id' => '_license_product_id',
        'label' => __('ID Prodotto Software', 'wss'),
        'description' => __('Identificativo del prodotto (es: wss-configurator-pro)', 'wss'),
        'value' => 'wss-configurator-pro'
    ));
    
    echo '</div>';
});

// Salva i meta del prodotto
add_action('woocommerce_process_product_meta', function($post_id) {
    update_post_meta($post_id, '_is_license_product', isset($_POST['_is_license_product']) ? 'yes' : 'no');
    update_post_meta($post_id, '_license_type', sanitize_text_field($_POST['_license_type'] ?? 'lifetime'));
    update_post_meta($post_id, '_max_activations', absint($_POST['_max_activations'] ?? 1));
    update_post_meta($post_id, '_license_product_id', sanitize_text_field($_POST['_license_product_id'] ?? ''));
});

/**
 * Pagina admin per gestione licenze
 */
add_action('admin_menu', function() {
    add_menu_page(
        'Gestione Licenze',
        'Licenze Software',
        'manage_options',
        'wss-licenses',
        'wss_render_licenses_admin_page',
        'dashicons-admin-network',
        30
    );
});

function wss_render_licenses_admin_page() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'wss_licenses';
    
    // Gestione azioni
    if (isset($_POST['action']) && $_POST['action'] === 'create_license') {
        check_admin_referer('wss_create_license');
        
        $license_key = wss_generate_license_key();
        $wpdb->insert($table_name, array(
            'license_key' => $license_key,
            'email' => sanitize_email($_POST['email']),
            'customer_name' => sanitize_text_field($_POST['customer_name']),
            'product_id' => sanitize_text_field($_POST['product_id']),
            'max_activations' => absint($_POST['max_activations']),
            'expires_at' => !empty($_POST['expires_at']) ? $_POST['expires_at'] : null,
            'status' => 'inactive',
            'notes' => sanitize_textarea_field($_POST['notes'])
        ));
        
        echo '<div class="notice notice-success"><p>Licenza creata: ' . esc_html($license_key) . '</p></div>';
    }
    
    // Lista licenze
    $licenses = $wpdb->get_results("SELECT * FROM $table_name ORDER BY created_at DESC LIMIT 50");
    
    ?>
    <div class="wrap">
        <h1>Gestione Licenze Software</h1>
        
        <h2>Crea Nuova Licenza</h2>
        <form method="post" style="background: #fff; padding: 20px; margin-bottom: 20px;">
            <?php wp_nonce_field('wss_create_license'); ?>
            <input type="hidden" name="action" value="create_license">
            
            <table class="form-table">
                <tr>
                    <th>Email Cliente</th>
                    <td><input type="email" name="email" required class="regular-text"></td>
                </tr>
                <tr>
                    <th>Nome Cliente</th>
                    <td><input type="text" name="customer_name" class="regular-text"></td>
                </tr>
                <tr>
                    <th>Prodotto</th>
                    <td>
                        <select name="product_id">
                            <option value="wss-configurator-pro">WSS Configurator Pro</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th>Attivazioni Massime</th>
                    <td><input type="number" name="max_activations" value="1" min="1" max="100"></td>
                </tr>
                <tr>
                    <th>Scadenza</th>
                    <td><input type="date" name="expires_at"> (lascia vuoto per lifetime)</td>
                </tr>
                <tr>
                    <th>Note</th>
                    <td><textarea name="notes" rows="3" cols="50"></textarea></td>
                </tr>
            </table>
            
            <p class="submit">
                <button type="submit" class="button button-primary">Crea Licenza</button>
            </p>
        </form>
        
        <h2>Licenze Esistenti</h2>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th>Chiave</th>
                    <th>Email</th>
                    <th>Prodotto</th>
                    <th>Stato</th>
                    <th>Attivazioni</th>
                    <th>Scadenza</th>
                    <th>Creata</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($licenses as $license): ?>
                <tr>
                    <td><code><?php echo esc_html($license->license_key); ?></code></td>
                    <td><?php echo esc_html($license->email); ?></td>
                    <td><?php echo esc_html($license->product_id); ?></td>
                    <td><?php echo esc_html($license->status); ?></td>
                    <td><?php echo $license->current_activations . '/' . $license->max_activations; ?></td>
                    <td><?php echo $license->expires_at ?: 'Lifetime'; ?></td>
                    <td><?php echo date('d/m/Y', strtotime($license->created_at)); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php
}