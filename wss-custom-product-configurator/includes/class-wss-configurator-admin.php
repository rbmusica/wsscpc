<?php
// Sicurezza
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WSS_Configurator_Admin
 * Gestisce tutte le funzionalità del backend per il configuratore di prodotti.
 */
class WSS_Configurator_Admin {

    private static $instance;

	private function __construct() {
		add_action( 'add_meta_boxes', array( $this, 'add_configurator_meta_box' ) );
		add_action( 'save_post_product', array( $this, 'save_configurator_meta_box_data' ), 10, 2 );
	}

    public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function add_configurator_meta_box() {
		add_meta_box(
			'wss_product_configurator_settings', 
			__( 'WSS Product Configurator', 'wss-custom-product-configurator' ), 
			array( $this, 'render_configurator_meta_box_content' ), 
			'product', 
			'normal',  
			'high'     
		);
	}

	public function render_configurator_meta_box_content( $post ) {
		wp_nonce_field( 'wss_configurator_save_meta_box_data', 'wss_configurator_meta_box_nonce' );

		$config_data = get_post_meta( $post->ID, '_wss_product_config_v3', true );
        if ( ! is_array( $config_data ) ) {
            $config_data = array(); 
        }

        $config_data['base_image_default'] = isset($config_data['base_image_default']) ? $config_data['base_image_default'] : '';
        $config_data['image_orientation'] = isset($config_data['image_orientation']) ? $config_data['image_orientation'] : 'vertical'; // Default verticale
        $config_data['background_color'] = isset($config_data['background_color']) ? $config_data['background_color'] : '#ffffff';
        $config_data['characteristics'] = isset($config_data['characteristics']) && is_array($config_data['characteristics']) ? $config_data['characteristics'] : array();

		echo '<div id="wss-configurator-admin-app" class="wss-configurator-admin-container">';

        echo '<h3>' . esc_html__( 'Immagini Base del Prodotto', 'wss-custom-product-configurator' ) . '</h3>';
        echo '<p>' . esc_html__( 'Definisci le immagini principali del prodotto. Una caratteristica (es. "Numero Corde") può essere usata per scambiare queste immagini base.', 'wss-custom-product-configurator' ) . '</p>';
        
        echo '<div class="wss-form-field">';
        echo '<label for="wss_base_image_default">' . esc_html__( 'Immagine Base Default:', 'wss-custom-product-configurator' ) . '</label>';
        echo '<input type="text" id="wss_base_image_default" name="wss_config_data[base_image_default]" value="' . esc_attr( $config_data['base_image_default'] ) . '" style="width:70%;" readonly/>';
        echo '<button type="button" class="button wss-upload-image-button" data-target-input="#wss_base_image_default">' . esc_html__( 'Carica/Scegli Immagine', 'wss-custom-product-configurator' ) . '</button>';
        if ( ! empty( $config_data['base_image_default'] ) ) {
            echo '<div class="wss-image-preview"><img src="' . esc_url( $config_data['base_image_default'] ) . '" style="max-width:100px; max-height:100px;"/> <button type="button" class="button wss-remove-image-button">' . __('Rimuovi', 'wss-custom-product-configurator') . '</button></div>';
        } else {
            echo '<div class="wss-image-preview" style="display:none;"><img src="" style="max-width:100px; max-height:100px;"/> <button type="button" class="button wss-remove-image-button">' . __('Rimuovi', 'wss-custom-product-configurator') . '</button></div>';
        }
        echo '</div>';

        // Nuovo campo per l'orientamento dell'immagine
        echo '<div class="wss-form-field wss-image-orientation-field">';
        echo '<label>' . esc_html__( 'Orientamento Immagine:', 'wss-custom-product-configurator' ) . '</label>';
        echo '<div class="wss-radio-group">';
        echo '<label class="wss-radio-label"><input type="radio" name="wss_config_data[image_orientation]" value="vertical" ' . checked( $config_data['image_orientation'], 'vertical', false ) . ' /> ' . esc_html__( 'Verticale', 'wss-custom-product-configurator' ) . '</label>';
        echo '<label class="wss-radio-label"><input type="radio" name="wss_config_data[image_orientation]" value="horizontal" ' . checked( $config_data['image_orientation'], 'horizontal', false ) . ' /> ' . esc_html__( 'Orizzontale (ruota di 90° in senso orario)', 'wss-custom-product-configurator' ) . '</label>';
        echo '</div>';
        echo '<p class="description">' . esc_html__( 'Seleziona l\'orientamento dell\'immagine del prodotto. L\'orientamento orizzontale ruoterà l\'immagine base e tutti i layer di 90° in senso orario.', 'wss-custom-product-configurator' ) . '</p>';
        echo '</div>';

        // Campo per il colore di sfondo
        echo '<div class="wss-form-field">';
        echo '<label for="wss_background_color">' . esc_html__( 'Colore Sfondo Visualizzatore:', 'wss-custom-product-configurator' ) . '</label>';
        echo '<div class="wss-input-group">';
        echo '<input type="color" id="wss_background_color" name="wss_config_data[background_color]" value="' . esc_attr( $config_data['background_color'] ) . '" style="width: 60px; padding: 0; border-radius: 4px; height: 30px; vertical-align: middle;">';
        echo '<input type="text" id="wss_background_color_hex" value="' . esc_attr( $config_data['background_color'] ) . '" class="wss-color-hex-input" style="vertical-align: middle; margin-left: 8px;">';
        echo '</div>';
        echo '<p class="description">' . esc_html__( 'Scegli il colore di sfondo per l\'area dell\'immagine del prodotto nel frontend.', 'wss-custom-product-configurator' ) . '</p>';
        echo '</div>';

        echo '<hr>';

        echo '<h3>' . esc_html__( 'Caratteristiche Configurabili', 'wss-custom-product-configurator' ) . '</h3>';
        echo '<div id="wss-characteristics-container">';

        if ( ! empty( $config_data['characteristics'] ) ) {
            foreach ( $config_data['characteristics'] as $char_index => $characteristic ) {
                $this->render_single_characteristic_admin_view( $char_index, $characteristic );
            }
        }

        echo '</div>'; 

        echo '<button type="button" id="wss-add-characteristic-button" class="button button-primary">' . esc_html__( 'Aggiungi Caratteristica', 'wss-custom-product-configurator' ) . '</button>';
        
        echo '</div>'; 

        $this->render_characteristic_template_for_js();

        // Script per la sincronizzazione in tempo reale del selettore colore e del campo esadecimale
        ?>
        <script type="text/javascript">
            document.addEventListener('DOMContentLoaded', function() {
                const colorPicker = document.getElementById('wss_background_color');
                const hexInput = document.getElementById('wss_background_color_hex');

                if (colorPicker && hexInput) {
                    // Aggiorna il campo di testo quando il selettore colore cambia
                    colorPicker.addEventListener('input', function(event) {
                        hexInput.value = event.target.value;
                    });

                    // Aggiorna il selettore colore quando il campo di testo cambia
                    hexInput.addEventListener('input', function(event) {
                        colorPicker.value = event.target.value;
                    });
                }
            });
        </script>
        <?php
	}

    private function render_single_characteristic_admin_view( $char_index, $characteristic ) {
        $char_name = isset( $characteristic['name'] ) ? $characteristic['name'] : '';
        $char_slug = isset( $characteristic['slug'] ) ? $characteristic['slug'] : 'char_slug_' . $char_index; 
        $char_type = isset( $characteristic['type'] ) ? $characteristic['type'] : 'radio';
        $has_visual_impact = isset( $characteristic['has_visual_impact'] ) ? (bool) $characteristic['has_visual_impact'] : false;
        $is_base_switcher = isset( $characteristic['is_base_switcher'] ) ? (bool) $characteristic['is_base_switcher'] : false;
        $display_order = isset( $characteristic['display_order'] ) ? intval( $characteristic['display_order'] ) : $char_index;
        $options = isset( $characteristic['options'] ) && is_array( $characteristic['options'] ) ? $characteristic['options'] : array();

        $base_field_name = "wss_config_data[characteristics][{$char_index}]";

        echo '<div class="wss-characteristic-block" data-index="' . esc_attr( $char_index ) . '">';
        echo '<h4 class="wss-characteristic-title">' . sprintf(esc_html__( 'Caratteristica #%s: %s', 'wss-custom-product-configurator' ), $char_index + 1, esc_html($char_name)) . ' <span class="dashicons dashicons-arrow-down"></span></h4>';
        echo '<div class="wss-characteristic-content" style="display: none;">'; 

        echo '<p><label>' . esc_html__( 'Nome Caratteristica:', 'wss-custom-product-configurator' ) . ' </label><input type="text" name="' . $base_field_name . '[name]" value="' . esc_attr( $char_name ) . '" class="wss-char-name widefat" placeholder="' . esc_attr__( 'Es. Colore Corpo', 'wss-custom-product-configurator' ) . '"/></p>';
        echo '<p><label>' . esc_html__( 'Slug Caratteristica:', 'wss-custom-product-configurator' ) . ' </label><input type="text" name="' . $base_field_name . '[slug]" value="' . esc_attr( $char_slug ) . '" class="widefat wss-char-slug" placeholder="' . esc_attr__( 'Es. body_color (auto)', 'wss-custom-product-configurator' ) . '"/></p>';
        echo '<p><label>' . esc_html__( 'Tipo di Selezione:', 'wss-custom-product-configurator' ) . ' </label>';
        echo '<select name="' . $base_field_name . '[type]" class="wss-char-type">';
        echo '<option value="radio" ' . selected( $char_type, 'radio', false ) . '>' . esc_html__( 'Radio Buttons', 'wss-custom-product-configurator' ) . '</option>';
        echo '<option value="checkbox" ' . selected( $char_type, 'checkbox', false ) . '>' . esc_html__( 'Checkbox', 'wss-custom-product-configurator' ) . '</option>';
        echo '<option value="select" ' . selected( $char_type, 'select', false ) . '>' . esc_html__( 'Dropdown', 'wss-custom-product-configurator' ) . '</option>';
        echo '</select></p>';
        echo '<p><label>' . esc_html__( 'Ordine di Visualizzazione:', 'wss-custom-product-configurator' ) . ' </label><input type="number" name="' . $base_field_name . '[display_order]" value="' . esc_attr( $display_order ) . '" class="small-text"/></p>';
        echo '<p><label><input type="checkbox" name="' . $base_field_name . '[has_visual_impact]" value="1" class="wss-char-has-visual-impact" ' . checked( $has_visual_impact, true, false ) . '/> ' . esc_html__( 'Impatto visivo?', 'wss-custom-product-configurator' ) . '</label></p>';
        echo '<p class="wss-char-is-base-switcher-container" style="' . ( $has_visual_impact ? '' : 'display:none;' ) . '"><label><input type="checkbox" name="' . $base_field_name . '[is_base_switcher]" value="1" class="wss-char-is-base-switcher" ' . checked( $is_base_switcher, true, false ) . '/> ' . esc_html__( 'Cambia immagine base?', 'wss-custom-product-configurator' ) . '</label><br/><small>' . esc_html__('Se selezionato, il "Layer Immagine" per ogni opzione sarà una chiave immagine base (es. "base_image_default") o un URL.', 'wss-custom-product-configurator') . '</small></p>';

        echo '<div class="wss-options-container">';
        if ( ! empty( $options ) ) {
            foreach ( $options as $opt_index => $option_data ) {
                $this->render_single_option_admin_view( $char_index, $opt_index, $option_data, $has_visual_impact, $is_base_switcher, $base_field_name );
            }
        }
        echo '</div>'; 

        echo '<button type="button" class="button wss-add-option-button">' . esc_html__( 'Aggiungi Opzione', 'wss-custom-product-configurator' ) . '</button>';
        echo '<button type="button" class="button wss-remove-characteristic-button button-link-delete">' . esc_html__( 'Rimuovi Caratteristica', 'wss-custom-product-configurator' ) . '</button>';
        echo '</div>'; 
        echo '</div>'; 
    }

    private function render_single_option_admin_view( $char_index, $opt_index, $option_data, $parent_has_visual_impact, $parent_is_base_switcher, $base_char_field_name ) {
        $opt_label = isset( $option_data['label'] ) ? $option_data['label'] : '';
        $opt_value = isset( $option_data['value'] ) ? $option_data['value'] : ''; 
        $opt_price = isset( $option_data['price_adjustment'] ) ? $option_data['price_adjustment'] : '';
        $opt_icon = isset( $option_data['icon'] ) ? $option_data['icon'] : '';
        $opt_layer = isset( $option_data['layer_image'] ) ? $option_data['layer_image'] : '';
        $opt_layer_z_index = isset( $option_data['layer_z_index'] ) ? $option_data['layer_z_index'] : '1'; 
        $opt_compatibility = isset( $option_data['compatibility'] ) ? $option_data['compatibility'] : '';
        $opt_dependency_char_slug = isset( $option_data['dependency_char_slug'] ) ? $option_data['dependency_char_slug'] : '';
        $opt_dependency_opt_value = isset( $option_data['dependency_opt_value'] ) ? $option_data['dependency_opt_value'] : '';


        $base_opt_field_name = "{$base_char_field_name}[options][{$opt_index}]";

        echo '<div class="wss-option-block" data-option-index="' . esc_attr( $opt_index ) . '">';
        echo '<h5>' . sprintf(esc_html__( 'Opzione #%s', 'wss-custom-product-configurator' ), $opt_index + 1) . '</h5>';
        
        echo '<p><label>' . esc_html__( 'Etichetta Opzione:', 'wss-custom-product-configurator' ) . ' </label><input type="text" name="' . $base_opt_field_name . '[label]" value="' . esc_attr( $opt_label ) . '" class="widefat wss-option-label" placeholder="' . esc_attr__( 'Es. Rosso', 'wss-custom-product-configurator' ) . '"/></p>';
        echo '<p><label>' . esc_html__( 'Valore Opzione:', 'wss-custom-product-configurator' ) . ' </label><input type="text" name="' . $base_opt_field_name . '[value]" value="' . esc_attr( $opt_value ) . '" class="widefat wss-option-value" placeholder="' . esc_attr__( 'Es. red (auto)', 'wss-custom-product-configurator' ) . '"/></p>';
        echo '<p><label>' . esc_html__( 'Adeguamento Prezzo:', 'wss-custom-product-configurator' ) . ' </label><input type="number" step="any" name="' . $base_opt_field_name . '[price_adjustment]" value="' . esc_attr( $opt_price ) . '" class="short" placeholder="Es. 10"/></p>';
        
        echo '<div class="wss-form-field">';
        echo '<label>' . esc_html__( 'Icona Opzione:', 'wss-custom-product-configurator' ) . '</label>';
        echo '<input type="text" name="' . $base_opt_field_name . '[icon]" value="' . esc_attr( $opt_icon ) . '" class="wss-option-icon-url widefat" readonly/>';
        echo '<button type="button" class="button wss-upload-image-button" data-target-input="[name=\'' . $base_opt_field_name . '[icon]\']">' . esc_html__( 'Carica Icona', 'wss-custom-product-configurator' ) . '</button>';
        echo '<div class="wss-image-preview" style="' . (empty($opt_icon) ? 'display:none;' : '') . '"><img src="' . esc_url( $opt_icon ) . '" style="max-width:50px; max-height:50px;"/> <button type="button" class="button wss-remove-image-button">' . __('Rimuovi', 'wss-custom-product-configurator') . '</button></div>';
        echo '</div>';

        $layer_field_visibility = $parent_has_visual_impact ? '' : 'display:none;';
        echo '<div class="wss-option-layer-fields" style="' . $layer_field_visibility . '">';
            $layer_label_text = $parent_is_base_switcher ? __('Nome Chiave Img. Base/URL:', 'wss-custom-product-configurator') : __('Layer Immagine (PNG):', 'wss-custom-product-configurator');
            echo '<div class="wss-form-field">';
            echo '<label class="wss-option-layer-label">' . esc_html( $layer_label_text ) . '</label>'; // Classa per JS
            echo '<input type="text" name="' . $base_opt_field_name . '[layer_image]" value="' . esc_attr( $opt_layer ) . '" class="wss-option-layer-url widefat" readonly/>';
            echo '<button type="button" class="button wss-upload-image-button" data-target-input="[name=\'' . $base_opt_field_name . '[layer_image]\']">' . esc_html__( 'Carica Layer', 'wss-custom-product-configurator' ) . '</button>';
            
            $preview_layer_visibility = (!$parent_is_base_switcher && !empty($opt_layer)) ? '' : 'display:none;';
            echo '<div class="wss-image-preview" style="' . $preview_layer_visibility . '">';
            if (!$parent_is_base_switcher && !empty($opt_layer)) {
                echo '<img src="' . esc_url( $opt_layer ) . '" style="max-width:100px; max-height:100px;"/>';
            } else {
                 echo '<img src="" style="max-width:100px; max-height:100px;"/>'; // Placeholder per JS
            }
            echo ' <button type="button" class="button wss-remove-image-button">' . __('Rimuovi', 'wss-custom-product-configurator') . '</button></div>';
            echo '</div>';
            
            $z_index_visibility = (!$parent_is_base_switcher) ? '' : 'display:none;';
            echo '<p class="wss-option-z-index-container" style="' . $z_index_visibility . '"><label>' . esc_html__( 'Z-index del Layer:', 'wss-custom-product-configurator' ) . ' </label><input type="number" name="' . $base_opt_field_name . '[layer_z_index]" value="' . esc_attr( $opt_layer_z_index ) . '" class="small-text" placeholder="1"/></p>';
        echo '</div>'; 

        echo '<p><label>' . esc_html__( 'Note di Compatibilità:', 'wss-custom-product-configurator' ) . ' </label><input type="text" name="' . $base_opt_field_name . '[compatibility]" value="' . esc_attr( $opt_compatibility ) . '" class="widefat wss-option-compatibility" placeholder="' . esc_attr__( 'Es. Adatto per 7 corde', 'wss-custom-product-configurator' ) . '"/></p>';
        
        echo '<div class="wss-option-dependency-section">';
        echo '<h5>' . esc_html__('Regola di Visibilità Semplice', 'wss-custom-product-configurator') . '</h5>';
        echo '<p><small>' . esc_html__('Mostra questa opzione SOLO SE un\'altra opzione specifica è selezionata.', 'wss-custom-product-configurator') . '</small></p>';
        echo '<p><label>' . esc_html__( 'Slug Caratteristica Parente:', 'wss-custom-product-configurator' ) . ' </label><input type="text" name="' . $base_opt_field_name . '[dependency_char_slug]" value="' . esc_attr( $opt_dependency_char_slug ) . '" class="widefat wss-option-dependency-char" placeholder="' . esc_attr__( 'Es. numero_corde', 'wss-custom-product-configurator' ) . '"/></p>';
        echo '<p><label>' . esc_html__( 'Valore Opzione Parente:', 'wss-custom-product-configurator' ) . ' </label><input type="text" name="' . $base_opt_field_name . '[dependency_opt_value]" value="' . esc_attr( $opt_dependency_opt_value ) . '" class="widefat wss-option-dependency-value" placeholder="' . esc_attr__( 'Es. 7_corde', 'wss-custom-product-configurator' ) . '"/></p>';
        echo '</div>';

        echo '<button type="button" class="button wss-remove-option-button button-link-delete">' . esc_html__( 'Rimuovi Opzione', 'wss-custom-product-configurator' ) . '</button>';
        echo '<hr class="wss-option-divider"/>';
        echo '</div>'; 
    }

    private function render_characteristic_template_for_js() {
        ?>
        <script type="text/template" id="tmpl-wss-characteristic-block">
            <div class="wss-characteristic-block" data-index="{{data.char_index}}">
                <h4 class="wss-characteristic-title"><?php printf(esc_html__( 'Caratteristica #%s', 'wss-custom-product-configurator' ), '{{data.char_display_index}}'); ?> <span class="dashicons dashicons-arrow-down"></span></h4>
                <div class="wss-characteristic-content" style="display: none;">
                    <p>
                        <label><?php esc_html_e( 'Nome Caratteristica:', 'wss-custom-product-configurator' ); ?> </label>
                        <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][name]" value="" class="wss-char-name widefat" placeholder="<?php esc_attr_e( 'Es. Colore Corpo', 'wss-custom-product-configurator' ); ?>"/>
                    </p>
                    <p>
                        <label><?php esc_html_e( 'Slug Caratteristica:', 'wss-custom-product-configurator' ); ?> </label>
                        <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][slug]" value="" class="widefat wss-char-slug" placeholder="<?php esc_attr_e( 'Es. body_color (auto)', 'wss-custom-product-configurator' ); ?>"/>
                    </p>
                    <p>
                        <label><?php esc_html_e( 'Tipo di Selezione:', 'wss-custom-product-configurator' ); ?> </label>
                        <select name="wss_config_data[characteristics][{{data.char_index}}][type]" class="wss-char-type">
                            <option value="radio" selected><?php esc_html_e( 'Radio Buttons', 'wss-custom-product-configurator' ); ?></option>
                            <option value="checkbox"><?php esc_html_e( 'Checkbox', 'wss-custom-product-configurator' ); ?></option>
                            <option value="select"><?php esc_html_e( 'Dropdown', 'wss-custom-product-configurator' ); ?></option>
                        </select>
                    </p>
                    <p>
                        <label><?php esc_html_e( 'Ordine di Visualizzazione:', 'wss-custom-product-configurator' ); ?> </label>
                        <input type="number" name="wss_config_data[characteristics][{{data.char_index}}][display_order]" value="{{data.char_index}}" class="small-text"/>
                    </p>
                    <p>
                        <label>
                            <input type="checkbox" name="wss_config_data[characteristics][{{data.char_index}}][has_visual_impact]" value="1" class="wss-char-has-visual-impact"/> <?php esc_html_e( 'Impatto visivo?', 'wss-custom-product-configurator' ); ?>
                        </label>
                    </p>
                    <p class="wss-char-is-base-switcher-container" style="display:none;">
                        <label>
                            <input type="checkbox" name="wss_config_data[characteristics][{{data.char_index}}][is_base_switcher]" value="1" class="wss-char-is-base-switcher"/> <?php esc_html_e( 'Cambia immagine base?', 'wss-custom-product-configurator' ); ?>
                        </label>
                        <br/><small><?php esc_html_e('Se selezionato, il "Layer Immagine" per ogni opzione sarà una chiave immagine base o un URL.', 'wss-custom-product-configurator'); ?></small>
                    </p>

                    <div class="wss-options-container"></div>
                    <button type="button" class="button wss-add-option-button"><?php esc_html_e( 'Aggiungi Opzione', 'wss-custom-product-configurator' ); ?></button>
                    <button type="button" class="button wss-remove-characteristic-button button-link-delete"><?php esc_html_e( 'Rimuovi Caratteristica', 'wss-custom-product-configurator' ); ?></button>
                </div>
            </div>
        </script>

        <script type="text/template" id="tmpl-wss-option-block">
            <div class="wss-option-block" data-option-index="{{data.opt_index}}">
                <h5><?php printf(esc_html__( 'Opzione #%s', 'wss-custom-product-configurator' ), '{{data.opt_display_index}}'); ?></h5>
                <p>
                    <label><?php esc_html_e( 'Etichetta Opzione:', 'wss-custom-product-configurator' ); ?> </label>
                    <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][label]" value="" class="widefat wss-option-label" placeholder="<?php esc_attr_e( 'Es. Rosso', 'wss-custom-product-configurator' ); ?>"/>
                </p>
                <p>
                    <label><?php esc_html_e( 'Valore Opzione:', 'wss-custom-product-configurator' ); ?> </label>
                    <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][value]" value="" class="widefat wss-option-value" placeholder="<?php esc_attr_e( 'Es. red (auto)', 'wss-custom-product-configurator' ); ?>"/>
                </p>
                <p>
                    <label><?php esc_html_e( 'Adeguamento Prezzo:', 'wss-custom-product-configurator' ); ?> </label>
                    <input type="number" step="any" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][price_adjustment]" value="" class="short" placeholder="Es. 10"/>
                </p>
                <div class="wss-form-field">
                    <label><?php esc_html_e( 'Icona Opzione:', 'wss-custom-product-configurator' ); ?></label>
                    <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][icon]" value="" class="wss-option-icon-url widefat" readonly/>
                    <button type="button" class="button wss-upload-image-button" data-target-input="[name='wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][icon]']"><?php esc_html_e( 'Carica Icona', 'wss-custom-product-configurator' ); ?></button>
                    <div class="wss-image-preview" style="display:none;"><img src="" style="max-width:50px; max-height:50px;"/> <button type="button" class="button wss-remove-image-button"><?php esc_html_e('Rimuovi', 'wss-custom-product-configurator'); ?></button></div>
                </div>

                <div class="wss-option-layer-fields" style="display:none;"> 
                    <div class="wss-form-field">
                        <label class="wss-option-layer-label"><?php esc_html_e( 'Layer Immagine (PNG):', 'wss-custom-product-configurator' ); ?></label>
                        <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][layer_image]" value="" class="wss-option-layer-url widefat" readonly/>
                        <button type="button" class="button wss-upload-image-button" data-target-input="[name='wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][layer_image]']"><?php esc_html_e( 'Carica Layer', 'wss-custom-product-configurator' ); ?></button>
                        <div class="wss-image-preview" style="display:none;"><img src="" style="max-width:100px; max-height:100px;"/><button type="button" class="button wss-remove-image-button"><?php esc_html_e('Rimuovi', 'wss-custom-product-configurator'); ?></button></div>
                    </div>
                    <p class="wss-option-z-index-container">
                        <label><?php esc_html_e( 'Z-index del Layer:', 'wss-custom-product-configurator' ); ?> </label>
                        <input type="number" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][layer_z_index]" value="1" class="small-text" placeholder="1"/>
                    </p>
                </div>
                <p>
                    <label><?php esc_html_e( 'Note di Compatibilità:', 'wss-custom-product-configurator' ); ?> </label>
                    <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][compatibility]" value="" class="widefat wss-option-compatibility" placeholder="<?php esc_attr_e( 'Es. Adatto per 7 corde', 'wss-custom-product-configurator' ); ?>"/>
                </p>
                <div class="wss-option-dependency-section">
                    <h5><?php esc_html_e('Regola di Visibilità Semplice', 'wss-custom-product-configurator'); ?></h5>
                    <p><small><?php esc_html_e('Mostra SOLO SE un\'altra opzione è selezionata.', 'wss-custom-product-configurator'); ?></small></p>
                    <p>
                        <label><?php esc_html_e( 'Slug Caratteristica Parente:', 'wss-custom-product-configurator' ); ?> </label>
                        <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][dependency_char_slug]" value="" class="widefat wss-option-dependency-char" placeholder="<?php esc_attr_e( 'Es. numero_corde', 'wss-custom-product-configurator' ); ?>"/>
                    </p>
                    <p>
                        <label><?php esc_html_e( 'Valore Opzione Parente:', 'wss-custom-product-configurator' ); ?> </label>
                        <input type="text" name="wss_config_data[characteristics][{{data.char_index}}][options][{{data.opt_index}}][dependency_opt_value]" value="" class="widefat wss-option-dependency-value" placeholder="<?php esc_attr_e( 'Es. 7_corde', 'wss-custom-product-configurator' ); ?>"/>
                    </p>
                </div>
                <button type="button" class="button wss-remove-option-button button-link-delete"><?php esc_html_e( 'Rimuovi Opzione', 'wss-custom-product-configurator' ); ?></button>
                <hr class="wss-option-divider"/>
            </div>
        </script>
        <?php
    }

	public function save_configurator_meta_box_data( $post_id, $post ) {
		if ( ! isset( $_POST['wss_configurator_meta_box_nonce'] ) || ! wp_verify_nonce( sanitize_key($_POST['wss_configurator_meta_box_nonce']), 'wss_configurator_save_meta_box_data' ) ) {
			return;
		}
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( ! current_user_can( 'edit_product', $post_id ) ) {
		    return;
		}

		if ( isset( $_POST['wss_config_data'] ) && is_array( $_POST['wss_config_data'] ) ) {
			$config_data_raw = $_POST['wss_config_data']; 
            $sanitized_config_data = array();

            $sanitized_config_data['base_image_default'] = isset($config_data_raw['base_image_default']) ? esc_url_raw(trim($config_data_raw['base_image_default'])) : '';
            $sanitized_config_data['image_orientation'] = isset($config_data_raw['image_orientation']) && in_array($config_data_raw['image_orientation'], array('vertical', 'horizontal')) ? $config_data_raw['image_orientation'] : 'vertical';

            // Sanitizza e salva il colore di sfondo
            if ( isset( $config_data_raw['background_color'] ) ) {
                $color_value = sanitize_text_field( $config_data_raw['background_color'] );
                // Valida che sia un codice colore esadecimale
                if ( preg_match( '/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/', $color_value ) ) {
                    $sanitized_config_data['background_color'] = $color_value;
                }
            }

            $sanitized_config_data['characteristics'] = array();
            if ( isset( $config_data_raw['characteristics'] ) && is_array( $config_data_raw['characteristics'] ) ) {
                // Re-index array numerically before processing to handle gaps from deletions
                $characteristics_raw_reindexed = array_values($config_data_raw['characteristics']);

                foreach ( $characteristics_raw_reindexed as $char_index => $characteristic_raw ) {
                    if ( ! is_array( $characteristic_raw ) ) continue; 

                    $sanitized_char = array();
                    $sanitized_char['name'] = isset( $characteristic_raw['name'] ) ? sanitize_text_field( wp_unslash( $characteristic_raw['name'] ) ) : '';
                    
                    $slug_candidate = isset( $characteristic_raw['slug'] ) ? sanitize_title( wp_unslash( $characteristic_raw['slug'] ) ) : '';
                    if ( empty($slug_candidate) && !empty($sanitized_char['name']) ) {
                        $sanitized_char['slug'] = sanitize_title( $sanitized_char['name'] . '-' . $char_index ); 
                    } else if ( !empty($slug_candidate) ) {
                         $sanitized_char['slug'] = $slug_candidate;
                    } else {
                        $sanitized_char['slug'] = 'characteristic-' . $char_index; 
                    }

                    $sanitized_char['type'] = isset( $characteristic_raw['type'] ) && in_array( $characteristic_raw['type'], array( 'radio', 'checkbox', 'select' ) ) ? $characteristic_raw['type'] : 'radio';
                    $sanitized_char['display_order'] = isset( $characteristic_raw['display_order'] ) ? intval( $characteristic_raw['display_order'] ) : $char_index; // Use re-indexed char_index as fallback
                    $sanitized_char['has_visual_impact'] = !empty( $characteristic_raw['has_visual_impact'] );
                    $sanitized_char['is_base_switcher'] = !empty( $characteristic_raw['is_base_switcher'] );
                    
                    if (!$sanitized_char['has_visual_impact']) {
                        $sanitized_char['is_base_switcher'] = false;
                    }

                    $sanitized_char['options'] = array();
                    if ( isset( $characteristic_raw['options'] ) && is_array( $characteristic_raw['options'] ) ) {
                        // Re-index options as well
                        $options_raw_reindexed = array_values($characteristic_raw['options']);
                        foreach ( $options_raw_reindexed as $opt_index => $option_raw ) {
                            if ( ! is_array( $option_raw ) ) continue;

                            $sanitized_opt = array();
                            $sanitized_opt['label'] = isset( $option_raw['label'] ) ? sanitize_text_field( wp_unslash( $option_raw['label'] ) ) : '';
                            
                            $opt_value_candidate = isset( $option_raw['value'] ) ? sanitize_title( wp_unslash( $option_raw['value'] ) ) : '';
                            if ( empty($opt_value_candidate) && !empty($sanitized_opt['label']) ) {
                                $sanitized_opt['value'] = sanitize_title( $sanitized_opt['label'] . '-' . $opt_index);
                            } else if ( !empty($opt_value_candidate) ) {
                                $sanitized_opt['value'] = $opt_value_candidate;
                            } else {
                                $sanitized_opt['value'] = 'option-' . $opt_index; 
                            }
                            
                            $sanitized_opt['price_adjustment'] = isset( $option_raw['price_adjustment'] ) ? wc_format_decimal( $option_raw['price_adjustment'] ) : ''; 
                            $sanitized_opt['icon'] = isset( $option_raw['icon'] ) ? esc_url_raw( trim( $option_raw['icon'] ) ) : '';
                            
                            if ($sanitized_char['has_visual_impact']) {
                                $sanitized_opt['layer_image'] = isset( $option_raw['layer_image'] ) ? ($sanitized_char['is_base_switcher'] ? sanitize_text_field(trim(wp_unslash($option_raw['layer_image']))) : esc_url_raw(trim($option_raw['layer_image']))) : '';
                                if (!$sanitized_char['is_base_switcher']) { 
                                    $sanitized_opt['layer_z_index'] = isset( $option_raw['layer_z_index'] ) ? intval( $option_raw['layer_z_index'] ) : 1;
                                } else {
                                    unset($sanitized_opt['layer_z_index']); // Non serve per base switcher
                                }
                            } else {
                                $sanitized_opt['layer_image'] = ''; 
                                unset($sanitized_opt['layer_z_index']); 
                            }

                            $sanitized_opt['compatibility'] = isset( $option_raw['compatibility'] ) ? sanitize_text_field( wp_unslash( $option_raw['compatibility'] ) ) : '';
                            $sanitized_opt['dependency_char_slug'] = isset( $option_raw['dependency_char_slug'] ) ? sanitize_title( wp_unslash( $option_raw['dependency_char_slug'] ) ) : '';
                            $sanitized_opt['dependency_opt_value'] = isset( $option_raw['dependency_opt_value'] ) ? sanitize_text_field( wp_unslash( $option_raw['dependency_opt_value'] ) ) : ''; // Non sanitize_title perché può essere "0" o stringa vuota

                            $sanitized_char['options'][] = $sanitized_opt;
                        }
                    }
                    $sanitized_config_data['characteristics'][] = $sanitized_char;
                }
            }
            if (!empty($sanitized_config_data['characteristics'])) {
                usort($sanitized_config_data['characteristics'], function($a, $b) {
                    return $a['display_order'] - $b['display_order'];
                });
            }

			update_post_meta( $post_id, '_wss_product_config_v3', $sanitized_config_data );

		} else {
            delete_post_meta( $post_id, '_wss_product_config_v3' );
        }
	}
}
?>