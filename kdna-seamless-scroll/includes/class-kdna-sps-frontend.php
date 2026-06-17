<?php
// Stop anyone loading this file directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles everything on the front end: deciding when to run, loading the
 * script and stylesheet, building the loader styling from the saved settings,
 * and passing those settings through to the JavaScript.
 */
class KDNA_SPS_Frontend {

	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		// The cover must paint with the very first frame, so its CSS goes high in
		// the head and the element itself right after <body> opens.
		add_action( 'wp_head', array( $this, 'render_cover_css' ), 1 );
		add_action( 'wp_body_open', array( $this, 'render_cover' ) );
	}

	/**
	 * Inline CSS for the transition cover. Opaque by default so the new page is
	 * covered from its first paint, then a keyframe fades it out automatically —
	 * meaning the content is never trapped behind it even if JS fails to run.
	 */
	public function render_cover_css() {
		if ( ! $this->is_target_page() ) {
			return;
		}
		$opts = kdna_sps_get_options();
		if ( empty( $opts['transition_enabled'] ) ) {
			return;
		}
		$colour = sanitize_hex_color( $opts['transition_colour'] );
		if ( ! $colour ) {
			$colour = '#ffffff';
		}
		$ms = absint( $opts['transition_ms'] );
		if ( ! $ms ) {
			$ms = 300;
		}
		echo '<style id="kdna-sps-cover-css">'
			. '.kdna-sps-cover{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483600;'
			. 'background:' . $colour . ';opacity:1;pointer-events:none;will-change:opacity;'
			. 'animation:kdnaSpsCoverOut ' . $ms . 'ms ease forwards;}'
			. '@keyframes kdnaSpsCoverOut{from{opacity:1}to{opacity:0}}'
			. '</style>';
	}

	/**
	 * The cover element itself, printed as the first thing inside <body>.
	 */
	public function render_cover() {
		if ( ! $this->is_target_page() ) {
			return;
		}
		$opts = kdna_sps_get_options();
		if ( empty( $opts['transition_enabled'] ) ) {
			return;
		}
		echo '<div class="kdna-sps-cover" aria-hidden="true"></div>';
	}

	/**
	 * Which post type(s) the seamless scroll runs on, taken from the settings
	 * and still filterable for anyone who prefers code.
	 */
	private function get_post_types() {
		$opts  = kdna_sps_get_options();
		$types = array_filter( array_map( 'trim', explode( ',', (string) $opts['post_types'] ) ) );
		if ( empty( $types ) ) {
			$types = array( 'portfolio' );
		}
		return apply_filters( 'kdna_sps_post_types', $types );
	}

	/**
	 * Are we on a single page that should run the effect?
	 */
	private function is_target_page() {
		return is_singular( $this->get_post_types() );
	}

	/**
	 * The list of CSS selectors the script will try, in order, to find the
	 * content wrapper. A single selector set on the Settings page wins.
	 */
	private function get_content_selectors() {
		$opts = kdna_sps_get_options();
		if ( ! empty( $opts['content_selector'] ) ) {
			$selectors = array( $opts['content_selector'] );
		} else {
			$selectors = array(
				'.elementor-location-single',
				'main .elementor',
				'main',
				'#content',
			);
		}
		return apply_filters( 'kdna_sps_content_selectors', $selectors );
	}

	/**
	 * Load the JS and CSS, but only on the target single pages, never site wide.
	 */
	public function enqueue_assets() {

		if ( ! $this->is_target_page() ) {
			return;
		}

		$opts = kdna_sps_get_options();

		// Stylesheet for the loading indicator and panel layout.
		wp_enqueue_style(
			'kdna-sps',
			KDNA_SPS_URL . 'assets/css/kdna-seamless-scroll.css',
			array(),
			KDNA_SPS_VERSION
		);

		// Loader colours and size come from the settings, applied as CSS variables.
		wp_add_inline_style( 'kdna-sps', $this->build_loader_css( $opts ) );

		// The engine itself. jQuery is listed so it loads after it, which the
		// Elementor re-init relies on.
		wp_enqueue_script(
			'kdna-sps',
			KDNA_SPS_URL . 'assets/js/kdna-seamless-scroll.js',
			array( 'jquery' ),
			KDNA_SPS_VERSION,
			true
		);

		// Pass the settings through to the JavaScript.
		wp_localize_script(
			'kdna-sps',
			'KDNA_SPS',
			array(
				'contentSelectors' => $this->get_content_selectors(),
				'nextLinkSelector' => apply_filters( 'kdna_sps_next_link_selector', (string) $opts['next_link_selector'] ),
				'preloadSelector'  => apply_filters( 'kdna_sps_preload_selector', (string) $opts['preload_selector'] ),
				'advanceSelector'  => apply_filters( 'kdna_sps_advance_selector', (string) $opts['advance_selector'] ),
				'postTypeSlug'     => apply_filters( 'kdna_sps_post_type_slug', current( $this->get_post_types() ) ),
				'triggerOffset'    => apply_filters( 'kdna_sps_trigger_offset', absint( $opts['trigger_offset'] ) ),
				'reinitAnimations' => ! empty( $opts['reinit_animations'] ),
				'reexecScripts'    => ! empty( $opts['reexec_scripts'] ),
				'transitionEnabled' => ! empty( $opts['transition_enabled'] ),
				'transitionMs'     => absint( $opts['transition_ms'] ),
				'loader'           => array(
					'type'  => $opts['loader_type'],
					'image' => esc_url( $opts['loader_image'] ),
				),
				'debug'            => isset( $_GET['kdna_debug'] ),
				'homeUrl'          => home_url(),
			)
		);
	}

	/**
	 * Build the small block of CSS that themes the loader from the settings.
	 */
	private function build_loader_css( $opts ) {

		$spinner = sanitize_hex_color( $opts['spinner_colour'] );
		$bg      = sanitize_hex_color( $opts['loader_bg_colour'] );
		$size    = absint( $opts['loader_size'] );

		if ( empty( $spinner ) ) {
			$spinner = '#ffffff';
		}
		if ( empty( $bg ) ) {
			$bg = '#141a26';
		}
		if ( empty( $size ) ) {
			$size = 20;
		}

		// The faint ring is the icon colour at roughly 30 per cent opacity (8 digit hex).
		$track = $spinner . '4d';

		$css  = ':root{';
		$css .= '--kdna-sps-spinner-colour:' . $spinner . ';';
		$css .= '--kdna-sps-spinner-track:' . $track . ';';
		$css .= '--kdna-sps-bg:' . $bg . ';';
		$css .= '--kdna-sps-size:' . $size . 'px;';
		$css .= '}';

		// Hide the pill if the background has been switched off.
		if ( empty( $opts['loader_bg_enabled'] ) ) {
			$css .= '.kdna-sps-loader::before{display:none;}';
		}

		return $css;
	}
}
