<?php
/**
 * WSS_Configurator_Settings
 * Gestisce la pagina delle impostazioni generali del plugin E della licenza.
 */

// Sicurezza
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WSS_Configurator_Settings {

    private static $instance;
    private $options;

    private function __construct() {
        // Aggiunge la pagina delle impostazioni al menu di amministrazione
        add_action( 'admin_menu', array( $this, 'add_plugin_settings_page' ) );
        // Inizializza le impostazioni, le sezioni e i campi
        add_action( 'admin_init', array( $this, 'register_and_build_fields' ) );
        // Handler AJAX per licenza
        add_action( 'wp_ajax_wss_activate_license', array( $this, 'ajax_activate_license' ) );
        add_action( 'wp_ajax_wss_deactivate_license', array( $this, 'ajax_deactivate_license' ) );
    }

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Aggiunge la pagina delle opzioni sotto il menu "Impostazioni" di WordPress.
     */
    public function add_plugin_settings_page() {
        add_options_page(
            'WSS Configurator Settings', 
            'WSS Configurator',          
            'manage_options',            
            'wss-configurator-settings', 
            array( $this, 'create_admin_page_content' )
        );
    }

    /**
     * CORREZIONE: Renderizza l'HTML della pagina delle impostazioni.
     */
    public function create_admin_page_content() {
        // Ottieni lo stato della licenza e del trial
        $license_manager = WSS_License_Manager::get_instance();
        $license_data = $license_manager->get_license_data();
        
        // ✅ CORREZIONE: Gestire il caso di dati null
        if ($license_data === null) {
            $license_data = array(); // Array vuoto come fallback
        }
        
        $trial_active = get_option('wss-custom-product-configurator_trial_active');
        $trial_start = get_option('wss-custom-product-configurator_trial_start');
        $trial_days_left = $trial_start ? max(0, 30 - floor((time() - $trial_start) / 86400)) : 30;
        
        // ✅ CORREZIONE: Usare verifiche più robuste
        $has_active_license = !empty($license_data) && isset($license_data['status']) && $license_data['status'] === 'active';
        $has_active_trial = $trial_active && $trial_days_left > 0;
        $is_plugin_active = $has_active_license || $has_active_trial;
        
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            
            <?php if (!$is_plugin_active): ?>
                <div class="notice notice-error">
                    <p><strong><?php _e('Plugin non attivo', 'wss-custom-product-configurator'); ?></strong> - 
                    <?php _e('Attiva una licenza o usa il periodo di prova per utilizzare il plugin.', 'wss-custom-product-configurator'); ?></p>
                </div>
            <?php endif; ?>
            
            <!-- Tab Navigation -->
            <h2 class="nav-tab-wrapper">
                <a href="#license" class="nav-tab nav-tab-active" data-tab="license">
                    <?php _e('Licenza', 'wss-custom-product-configurator'); ?>
                </a>
                <?php if ($is_plugin_active): ?>
                <a href="#general" class="nav-tab" data-tab="general">
                    <?php _e('Impostazioni Generali', 'wss-custom-product-configurator'); ?>
                </a>
                <?php endif; ?>
            </h2>
            
            <!-- License Tab -->
            <div id="license-tab" class="tab-content">
                <h2><?php _e('Gestione Licenza', 'wss-custom-product-configurator'); ?></h2>
                
                <?php if ($trial_active && $trial_days_left > 0): ?>
                    <div class="notice notice-info inline">
                        <p><strong><?php _e('Periodo di prova attivo', 'wss-custom-product-configurator'); ?></strong> - 
                        <?php printf(__('Rimangono %d giorni.', 'wss-custom-product-configurator'), $trial_days_left); ?></p>
                    </div>
                <?php elseif (!$has_active_license && $trial_days_left <= 0): ?>
                    <div class="notice notice-error inline">
                        <p><strong><?php _e('Periodo di prova scaduto', 'wss-custom-product-configurator'); ?></strong> - 
                        <?php _e('Attiva una licenza per continuare ad utilizzare il plugin.', 'wss-custom-product-configurator'); ?></p>
                    </div>
                <?php endif; ?>
                
                <form method="post" action="" id="wss-license-form">
                    <?php wp_nonce_field('wss_license_action', 'wss_license_nonce'); ?>
                    
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Chiave Licenza', 'wss-custom-product-configurator'); ?></th>
                            <td>
                                <input type="text" name="license_key" id="license_key" 
                                       value="<?php echo esc_attr(isset($license_data['key']) ? $license_data['key'] : ''); ?>" 
                                       class="regular-text" <?php echo $has_active_license ? 'readonly' : ''; ?> />
                                <?php if ($has_active_license): ?>
                                    <span class="license-status status-<?php echo esc_attr($license_data['status']); ?>" 
                                          style="padding: 3px 8px; border-radius: 3px; margin-left: 10px; 
                                                 background: <?php echo $license_data['status'] === 'active' ? '#d4edda' : '#f8d7da'; ?>; 
                                                 color: <?php echo $license_data['status'] === 'active' ? '#155724' : '#721c24'; ?>;">
                                        <?php echo ucfirst($license_data['status']); ?>
                                    </span>
                                <?php endif; ?>
                            </td>
                        </tr>
                        
                        <?php if (!$has_active_license): ?>
                        <tr>
                            <th scope="row"><?php _e('Email', 'wss-custom-product-configurator'); ?></th>
                            <td>
                                <input type="email" name="email" id="email" class="regular-text" />
                                <p class="description"><?php _e('Email utilizzata per l\'acquisto della licenza', 'wss-custom-product-configurator'); ?></p>
                            </td>
                        </tr>
                        <?php endif; ?>
                        
                        <?php if ($has_active_license): ?>
                        <tr>
                            <th scope="row"><?php _e('Scadenza', 'wss-custom-product-configurator'); ?></th>
                            <td>
                                <?php 
                                if (!isset($license_data['expires_at']) || $license_data['expires_at'] == 0) {
                                    _e('Licenza lifetime', 'wss-custom-product-configurator');
                                } else {
                                    echo date_i18n(get_option('date_format'), $license_data['expires_at']);
                                }
                                ?>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Dominio Attivato', 'wss-custom-product-configurator'); ?></th>
                            <td><code><?php echo esc_html(parse_url(home_url(), PHP_URL_HOST)); ?></code></td>
                        </tr>
                        <?php endif; ?>
                    </table>
                    
                    <p class="submit">
                        <?php if ($has_active_license): ?>
                            <button type="button" class="button" id="deactivate-license">
                                <?php _e('Disattiva Licenza', 'wss-custom-product-configurator'); ?>
                            </button>
                        <?php else: ?>
                            <button type="button" class="button button-primary" id="activate-license">
                                <?php _e('Attiva Licenza', 'wss-custom-product-configurator'); ?>
                            </button>
                            <a href="https://tuosito.com/acquista-licenza" target="_blank" class="button">
                                <?php _e('Acquista Licenza', 'wss-custom-product-configurator'); ?>
                            </a>
                        <?php endif; ?>
                    </p>
                </form>
            </div>
            
            <?php if ($is_plugin_active): ?>
            <!-- General Settings Tab -->
            <div id="general-tab" class="tab-content" style="display:none;">
                <form action="options.php" method="post">
                    <?php
                    settings_fields( 'wss_configurator_options_group' );
                    do_settings_sections( 'wss-configurator-settings-general' );
                    submit_button( 'Salva Impostazioni' );
                    ?>
                </form>
            </div>
            <?php endif; ?>
            
        </div>
        
        <style>
            .tab-content { padding: 20px 0; }
            .nav-tab-wrapper { margin-bottom: 0; }
            .license-status { font-weight: bold; text-transform: uppercase; font-size: 12px; }
        </style>
        
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            // Tab switching
            $('.nav-tab').on('click', function(e) {
                e.preventDefault();
                var tab = $(this).data('tab');
                
                $('.nav-tab').removeClass('nav-tab-active');
                $(this).addClass('nav-tab-active');
                
                $('.tab-content').hide();
                $('#' + tab + '-tab').show();
            });
            
            // License activation
            $('#activate-license').on('click', function() {
                var $button = $(this);
                var license_key = $('#license_key').val();
                var email = $('#email').val();
                
                if (!license_key) {
                    alert('<?php _e('Inserisci una chiave di licenza valida', 'wss-custom-product-configurator'); ?>');
                    return;
                }
                
                $button.prop('disabled', true).text('<?php _e('Attivazione in corso...', 'wss-custom-product-configurator'); ?>');
                
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
                        $button.prop('disabled', false).text('<?php _e('Attiva Licenza', 'wss-custom-product-configurator'); ?>');
                    }
                });
            });
            
            // License deactivation
            $('#deactivate-license').on('click', function() {
                if (!confirm('<?php _e('Sei sicuro di voler disattivare la licenza?', 'wss-custom-product-configurator'); ?>')) {
                    return;
                }
                
                var $button = $(this);
                $button.prop('disabled', true).text('<?php _e('Disattivazione in corso...', 'wss-custom-product-configurator'); ?>');
                
                $.post(ajaxurl, {
                    action: 'wss_deactivate_license',
                    nonce: $('#wss_license_nonce').val()
                }, function(response) {
                    location.reload();
                });
            });
        });
        </script>
        <?php
    }

    // ... resto dei metodi esistenti (register_and_build_fields, render_debug_field, ajax_activate_license, ajax_deactivate_license)
    
    /**
     * Registra le impostazioni e definisce le sezioni e i campi.
     */
    public function register_and_build_fields() {
        // Registra un gruppo di impostazioni
        register_setting( 'wss_configurator_options_group', 'wss_configurator_settings' );

        // Sezione impostazioni generali (mostrata solo se plugin attivo)
        add_settings_section(
            'wss_general_section',
            'Impostazioni Generali Plugin',
            null,
            'wss-configurator-settings-general'
        );

        // Esempio di campo impostazione
        add_settings_field(
            'wss_enable_debug',
            'Modalità Debug',
            array( $this, 'render_debug_field' ),
            'wss-configurator-settings-general',
            'wss_general_section'
        );
        // Sticky header
        add_settings_field(
            'wss_sticky_header',
            'Sticky Header',
            array( $this, 'render_sticky_header_field' ),
            'wss-configurator-settings-general',
            'wss_general_section'
        );
        // Altezza header fisso
        add_settings_field(
            'wss_sticky_header_height',
            'Altezza header fisso (px)',
            array( $this, 'render_sticky_header_height_field' ),
            'wss-configurator-settings-general',
            'wss_general_section'
        );
        // Larghezza immagine sticky
        add_settings_field(
            'wss_sticky_image_width',
            'Larghezza immagine sticky (px o %)',
            array( $this, 'render_sticky_image_width_field' ),
            'wss-configurator-settings-general',
            'wss_general_section'
        );
    }

    public function render_debug_field() {
        $options = get_option('wss_configurator_settings');
        $debug_enabled = isset($options['debug_mode']) ? $options['debug_mode'] : false;
        ?>
        <input type="checkbox" name="wss_configurator_settings[debug_mode]" value="1" <?php checked($debug_enabled, 1); ?> />
        <label><?php _e('Abilita log di debug per il configuratore', 'wss-custom-product-configurator'); ?></label>
        <?php
    }

    public function render_sticky_header_field() {
        $options = get_option('wss_configurator_settings');
        $enabled = isset($options['sticky_header']) ? $options['sticky_header'] : false;
        ?>
        <input type="checkbox" name="wss_configurator_settings[sticky_header]" value="1" <?php checked($enabled, 1); ?> />
        <label><?php _e('Attiva comportamento sticky/fixed per l\'immagine del configuratore (utile se hai un header fisso)', 'wss-custom-product-configurator'); ?></label>
        <?php
    }

    public function render_sticky_header_height_field() {
        $options = get_option('wss_configurator_settings');
        $height = isset($options['sticky_header_height']) ? intval($options['sticky_header_height']) : 0;
        ?>
        <input type="number" name="wss_configurator_settings[sticky_header_height]" value="<?php echo esc_attr($height); ?>" min="0" step="1" style="width:80px;" />
        <label><?php _e('Specifica l\'altezza in pixel del tuo header fisso (es: 80)', 'wss-custom-product-configurator'); ?></label>
        <?php
    }

    public function render_sticky_image_width_field() {
        $options = get_option('wss_configurator_settings');
        $width = isset($options['sticky_image_width']) ? esc_attr($options['sticky_image_width']) : '';
        ?>
        <input type="text" name="wss_configurator_settings[sticky_image_width]" value="<?php echo $width; ?>" style="width:100px;" placeholder="650px o 50%" />
        <label><?php _e('Specifica la larghezza della colonna immagine sticky (es: 650px o 50%)', 'wss-custom-product-configurator'); ?></label>
        <?php
    }

    /**
     * Handler AJAX per attivazione licenza
     */
    public function ajax_activate_license() {
        check_ajax_referer('wss_license_action', 'nonce');
        
        $license_manager = WSS_License_Manager::get_instance();
        $license_key = sanitize_text_field($_POST['license_key'] ?? '');
        $email = sanitize_email($_POST['email'] ?? '');
        
        $result = $license_manager->activate_license($license_key, $email);
        
        if ($result['success']) {
            wp_send_json_success($result);
        } else {
            wp_send_json_error($result);
        }
    }

    /**
     * Handler AJAX per disattivazione licenza
     */
    public function ajax_deactivate_license() {
        check_ajax_referer('wss_license_action', 'nonce');
        
        $license_manager = WSS_License_Manager::get_instance();
        $license_manager->deactivate_license();
        
        wp_send_json_success();
    }
}
?>