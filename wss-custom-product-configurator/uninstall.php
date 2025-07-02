<?php
/**
 * WSS Custom Product Configurator Uninstall
 *
 * Script di disinstallazione per WSS Custom Product Configurator.
 * Questo script viene eseguito quando l'utente clicca su "Elimina" nella pagina dei plugin.
 *
 * @package WSS_Custom_Product_Configurator
 * @version 1.0.0
 */

// Sicurezza: Impedisce l'accesso diretto al file.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Opzione per decidere se cancellare i dati o meno (potrebbe essere un'impostazione del plugin)
// $delete_data_on_uninstall = get_option( 'wss_cp_delete_data_on_uninstall', false );

// if ( $delete_data_on_uninstall ) {

    // Cancella i post meta dei prodotti che contengono la configurazione
    // Attenzione: questa operazione è distruttiva.
    global $wpdb;
    $meta_key = '_wss_product_config_v3'; // Assicurati che sia la meta_key corretta

    // SQL per cancellare i meta da tutti i post.
    // Potrebbe essere lento su siti con molti post.
    // $wpdb->delete( $wpdb->postmeta, array( 'meta_key' => $meta_key ) );

    // Un approccio più mirato sarebbe ciclare solo sui prodotti (post_type 'product')
    // Ma per la disinstallazione, cancellare la meta key ovunque sia è spesso accettabile.

    // Potrebbe essere necessario anche cancellare opzioni del plugin salvate in wp_options
    // delete_option('wss_cp_settings');
    // delete_option('wss_cp_version');
// }

// Per ora, non cancelliamo nulla di default per sicurezza,
// l'utente potrebbe voler disattivare/riattivare senza perdere dati.
// Se si vuole una pulizia completa, decommentare le parti rilevanti sopra.
?>