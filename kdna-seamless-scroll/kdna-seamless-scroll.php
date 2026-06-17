<?php
/**
 * Plugin Name: KDNA Seamless Portfolio Scroll
 * Description: As the visitor reaches the next-project preview, preloads that portfolio project and auto-advances to it (no click), so each project loads as a real page with its MotionPage animations, backgrounds and scripts intact. Inspired by continuous-scroll agency sites.
 * Version: 1.6.5
 * Author: Krull Design & Advertising
 * Text Domain: kdna-seamless-scroll
 */

// Stop anyone loading this file directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Handy constants used across the plugin.
define( 'KDNA_SPS_VERSION', '1.6.5' );
define( 'KDNA_SPS_PATH', plugin_dir_path( __FILE__ ) );
define( 'KDNA_SPS_URL', plugin_dir_url( __FILE__ ) );

/**
 * The default settings. These are used until anything is saved on the
 * Settings page, and as a fallback for any missing values.
 */
function kdna_sps_default_options() {
	return array(

		// Behaviour.
		'post_types'         => 'portfolio',
		'content_selector'   => '',     // blank means use the built in defaults
		'next_link_selector' => '',     // blank means auto detect
		'preload_selector'   => '',     // CSS selector/id; start preloading when it scrolls into view (blank = use preload distance)
		'advance_selector'   => '',     // CSS selector/id; advance when it reaches the top of the viewport (blank = use the next link)
		'trigger_offset'     => 1200,   // fallback preload distance in px when no preload element is set
		'reinit_animations'  => 1,      // re-trigger Elementor animations on loaded projects
		'reexec_scripts'     => 0,      // experimental: re-run MotionPage init on loaded projects

		// Page transition (prevents the flash between projects).
		'transition_mode'    => 'crossfade', // crossfade (no colour), cover (colour fade), or none
		'transition_colour'  => '#ffffff',   // cover colour, used in cover mode only
		'transition_ms'      => 300,         // transition duration in milliseconds

		// Loading indicator.
		'loader_type'        => 'spinner', // spinner or image
		'loader_image'       => '',        // custom image URL, used when loader_type is image
		'spinner_colour'     => '#ffffff',
		'loader_bg_enabled'  => 1,         // show the pill behind the icon
		'loader_bg_colour'   => '#141a26',
		'loader_size'        => 20,        // icon size in pixels
	);
}

/**
 * Get the saved settings merged over the defaults, so every key is always present.
 */
function kdna_sps_get_options() {
	$saved = get_option( 'kdna_sps_options', array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}
	return wp_parse_args( $saved, kdna_sps_default_options() );
}

// Load the plugin classes.
require_once KDNA_SPS_PATH . 'includes/class-kdna-sps-frontend.php';
require_once KDNA_SPS_PATH . 'includes/class-kdna-sps-settings.php';

// Start the plugin once WordPress has loaded all plugins.
add_action( 'plugins_loaded', function () {
	new KDNA_SPS_Frontend();
	new KDNA_SPS_Settings();
} );

// Add a "Settings" link on the Plugins screen for convenience.
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	$url  = admin_url( 'options-general.php?page=kdna-sps' );
	$link = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'kdna-seamless-scroll' ) . '</a>';
	array_unshift( $links, $link );
	return $links;
} );
