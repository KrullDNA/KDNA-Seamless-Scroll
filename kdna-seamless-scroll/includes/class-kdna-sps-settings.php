<?php
// Stop anyone loading this file directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds the Settings page under Settings > KDNA Seamless Scroll, where the
 * loading indicator and the plugin behaviour can be adjusted without code.
 */
class KDNA_SPS_Settings {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
	}

	/**
	 * Add the menu item under the Settings menu.
	 */
	public function add_menu() {
		add_options_page(
			__( 'KDNA Seamless Scroll', 'kdna-seamless-scroll' ),
			__( 'KDNA Seamless Scroll', 'kdna-seamless-scroll' ),
			'manage_options',
			'kdna-sps',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Load the colour picker and media library only on our own settings page.
	 */
	public function enqueue_admin_assets( $hook ) {
		if ( 'settings_page_kdna-sps' !== $hook ) {
			return;
		}
		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_media();
		wp_enqueue_script(
			'kdna-sps-admin',
			KDNA_SPS_URL . 'assets/js/kdna-sps-admin.js',
			array( 'jquery', 'wp-color-picker' ),
			KDNA_SPS_VERSION,
			true
		);
	}

	/**
	 * Register the single option array and its sanitiser.
	 */
	public function register_settings() {
		register_setting(
			'kdna_sps_group',
			'kdna_sps_options',
			array( $this, 'sanitise' )
		);
	}

	/**
	 * Clean every incoming value before it is saved.
	 */
	public function sanitise( $input ) {

		$defaults = kdna_sps_default_options();
		$out      = array();

		$out['post_types']         = sanitize_text_field( isset( $input['post_types'] ) ? $input['post_types'] : $defaults['post_types'] );
		$out['content_selector']   = sanitize_text_field( isset( $input['content_selector'] ) ? $input['content_selector'] : '' );
		$out['next_link_selector'] = sanitize_text_field( isset( $input['next_link_selector'] ) ? $input['next_link_selector'] : '' );
		$out['preload_selector']   = sanitize_text_field( isset( $input['preload_selector'] ) ? $input['preload_selector'] : '' );
		$out['advance_selector']   = sanitize_text_field( isset( $input['advance_selector'] ) ? $input['advance_selector'] : '' );
		$out['trigger_offset']     = absint( isset( $input['trigger_offset'] ) ? $input['trigger_offset'] : $defaults['trigger_offset'] );
		$out['reinit_animations']  = empty( $input['reinit_animations'] ) ? 0 : 1;
		$out['reexec_scripts']     = empty( $input['reexec_scripts'] ) ? 0 : 1;
		$ms_raw = isset( $input['marquee_speed'] ) ? (float) $input['marquee_speed'] : $defaults['marquee_speed'];
		$out['marquee_speed']      = ( $ms_raw > 0 && $ms_raw <= 20 ) ? $ms_raw : $defaults['marquee_speed'];

		$mode = isset( $input['transition_mode'] ) ? $input['transition_mode'] : 'crossfade';
		$out['transition_mode']    = in_array( $mode, array( 'crossfade', 'cover', 'none' ), true ) ? $mode : 'crossfade';
		$tcol = sanitize_hex_color( isset( $input['transition_colour'] ) ? $input['transition_colour'] : '' );
		$out['transition_colour']  = $tcol ? $tcol : $defaults['transition_colour'];
		$out['transition_ms']      = max( 0, absint( isset( $input['transition_ms'] ) ? $input['transition_ms'] : $defaults['transition_ms'] ) );

		// One CSS selector per line; keep only selector-safe characters so the
		// value can never break out of the inline <style> it is printed into.
		$sel_raw = isset( $input['persistent_selectors'] ) ? (string) $input['persistent_selectors'] : '';
		$sel_lines = array();
		foreach ( preg_split( '/[\r\n]+/', $sel_raw ) as $line ) {
			$line = trim( preg_replace( '/[^a-zA-Z0-9 .#:_\-\[\]=\"\'()>~+*^$|]/', '', $line ) );
			if ( '' !== $line ) {
				$sel_lines[] = $line;
			}
		}
		$out['persistent_selectors'] = implode( "\n", $sel_lines );

		$out['loader_type']        = ( isset( $input['loader_type'] ) && 'image' === $input['loader_type'] ) ? 'image' : 'spinner';
		$out['loader_image']       = esc_url_raw( isset( $input['loader_image'] ) ? $input['loader_image'] : '' );

		$spinner = sanitize_hex_color( isset( $input['spinner_colour'] ) ? $input['spinner_colour'] : '' );
		$out['spinner_colour']     = $spinner ? $spinner : $defaults['spinner_colour'];

		$out['loader_bg_enabled']  = empty( $input['loader_bg_enabled'] ) ? 0 : 1;

		$bg = sanitize_hex_color( isset( $input['loader_bg_colour'] ) ? $input['loader_bg_colour'] : '' );
		$out['loader_bg_colour']   = $bg ? $bg : $defaults['loader_bg_colour'];

		$out['loader_size']        = max( 8, absint( isset( $input['loader_size'] ) ? $input['loader_size'] : $defaults['loader_size'] ) );

		return $out;
	}

	/**
	 * Render the settings page.
	 */
	public function render_page() {

		$o = kdna_sps_get_options();
		?>
		<div class="wrap kdna-sps-settings">
			<h1><?php esc_html_e( 'KDNA Seamless Portfolio Scroll', 'kdna-seamless-scroll' ); ?></h1>
			<p><?php esc_html_e( 'Style the loading indicator and adjust how the seamless scroll behaves.', 'kdna-seamless-scroll' ); ?></p>

			<form method="post" action="options.php">
				<?php settings_fields( 'kdna_sps_group' ); ?>

				<h2 class="title"><?php esc_html_e( 'Loading indicator', 'kdna-seamless-scroll' ); ?></h2>
				<table class="form-table" role="presentation">

					<tr>
						<th scope="row"><?php esc_html_e( 'Icon type', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<label style="margin-right:16px;">
								<input type="radio" name="kdna_sps_options[loader_type]" value="spinner" <?php checked( $o['loader_type'], 'spinner' ); ?> />
								<?php esc_html_e( 'Spinner', 'kdna-seamless-scroll' ); ?>
							</label>
							<label>
								<input type="radio" name="kdna_sps_options[loader_type]" value="image" <?php checked( $o['loader_type'], 'image' ); ?> />
								<?php esc_html_e( 'Custom image or GIF', 'kdna-seamless-scroll' ); ?>
							</label>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Custom image', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" id="kdna_sps_loader_image" name="kdna_sps_options[loader_image]" value="<?php echo esc_attr( $o['loader_image'] ); ?>" class="regular-text" placeholder="https://..." />
							<button type="button" class="button" id="kdna_sps_pick_image"><?php esc_html_e( 'Choose image', 'kdna-seamless-scroll' ); ?></button>
							<button type="button" class="button" id="kdna_sps_clear_image"><?php esc_html_e( 'Clear', 'kdna-seamless-scroll' ); ?></button>
							<div id="kdna_sps_image_preview" style="margin-top:10px;">
								<?php if ( ! empty( $o['loader_image'] ) ) : ?>
									<img src="<?php echo esc_url( $o['loader_image'] ); ?>" style="max-width:80px;height:auto;" alt="" />
								<?php endif; ?>
							</div>
							<p class="description"><?php esc_html_e( 'Used only when Icon type is set to Custom image. A small transparent GIF works well.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Spinner colour', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" class="kdna-sps-colour" name="kdna_sps_options[spinner_colour]" value="<?php echo esc_attr( $o['spinner_colour'] ); ?>" data-default-color="#ffffff" />
							<p class="description"><?php esc_html_e( 'The colour of the spinning ring. Ignored when a custom image is used.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Background pill', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="kdna_sps_options[loader_bg_enabled]" value="1" <?php checked( $o['loader_bg_enabled'], 1 ); ?> />
								<?php esc_html_e( 'Show a rounded background behind the icon', 'kdna-seamless-scroll' ); ?>
							</label>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Background colour', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" class="kdna-sps-colour" name="kdna_sps_options[loader_bg_colour]" value="<?php echo esc_attr( $o['loader_bg_colour'] ); ?>" data-default-color="#141a26" />
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Icon size', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="number" min="8" max="120" name="kdna_sps_options[loader_size]" value="<?php echo esc_attr( $o['loader_size'] ); ?>" class="small-text" /> px
						</td>
					</tr>
				</table>

				<h2 class="title"><?php esc_html_e( 'Behaviour', 'kdna-seamless-scroll' ); ?></h2>
				<table class="form-table" role="presentation">

					<tr>
						<th scope="row"><?php esc_html_e( 'Run on post types', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" name="kdna_sps_options[post_types]" value="<?php echo esc_attr( $o['post_types'] ); ?>" class="regular-text" />
							<p class="description"><?php esc_html_e( 'The post type slug to run on. Separate several with commas. Default: portfolio', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Re-trigger animations', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="kdna_sps_options[reinit_animations]" value="1" <?php checked( $o['reinit_animations'], 1 ); ?> />
								<?php esc_html_e( 'Wake up Elementor animations on each loaded project', 'kdna-seamless-scroll' ); ?>
							</label>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Re-run MotionPage', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="kdna_sps_options[reexec_scripts]" value="1" <?php checked( $o['reexec_scripts'], 1 ); ?> />
								<?php esc_html_e( 'Experimental: re-run each loaded project\'s MotionPage animations', 'kdna-seamless-scroll' ); ?>
							</label>
							<p class="description"><?php esc_html_e( 'Only switch this on if your scroll animations are built with MotionPage. It re-runs the loaded project\'s own MotionPage init script so its animations rebuild.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Marquee speed', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="number" min="0.1" max="20" step="0.1" name="kdna_sps_options[marquee_speed]" value="<?php echo esc_attr( $o['marquee_speed'] ); ?>" class="small-text" /> px / tick
							<p class="description"><?php esc_html_e( 'Speed of the .marquee (scrolls left) and .marquee2 (scrolls right) strips. The plugin runs these on every loaded project, so remove any old inline marquee <script> from your template to avoid it running twice.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Content selector', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" name="kdna_sps_options[content_selector]" value="<?php echo esc_attr( $o['content_selector'] ); ?>" class="regular-text" placeholder=".elementor-location-single" />
							<p class="description"><?php esc_html_e( 'Leave blank to auto-detect. Only set this if the wrong area is being loaded.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Next project link selector', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" name="kdna_sps_options[next_link_selector]" value="<?php echo esc_attr( $o['next_link_selector'] ); ?>" class="regular-text" placeholder="<?php esc_attr_e( 'auto-detect', 'kdna-seamless-scroll' ); ?>" />
							<p class="description"><?php esc_html_e( 'Leave blank to auto-detect the Next Project link. Set an exact CSS selector if the wrong link is being followed.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Preload trigger element', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" name="kdna_sps_options[preload_selector]" value="<?php echo esc_attr( $o['preload_selector'] ); ?>" class="regular-text" placeholder="#next-project-preload" />
							<p class="description"><?php esc_html_e( 'CSS selector or #id of the element that starts the preload. The next project begins loading when this element scrolls into view. Leave blank to use the Preload distance below instead.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Advance trigger element', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="text" name="kdna_sps_options[advance_selector]" value="<?php echo esc_attr( $o['advance_selector'] ); ?>" class="regular-text" placeholder="#next-project-trigger" />
							<p class="description"><?php esc_html_e( 'CSS selector or #id of the element that triggers the change. The page advances when this element reaches the top of the browser. Leave blank to use the Next Project link itself.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>

					<tr>
						<th scope="row"><?php esc_html_e( 'Preload distance', 'kdna-seamless-scroll' ); ?></th>
						<td>
							<input type="number" min="0" max="8000" name="kdna_sps_options[trigger_offset]" value="<?php echo esc_attr( $o['trigger_offset'] ); ?>" class="small-text" /> px
							<p class="description"><?php esc_html_e( 'Only used when no Preload trigger element is set above. Starts preloading this many pixels before the advance trigger reaches the top.', 'kdna-seamless-scroll' ); ?></p>
						</td>
					</tr>
				</table>

				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}
