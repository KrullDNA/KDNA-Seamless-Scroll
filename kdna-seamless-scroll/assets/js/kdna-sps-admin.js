/* Admin helpers for the KDNA Seamless Scroll settings page:
   the colour pickers and the media library image chooser. */
jQuery(function ($) {

	// Start the WordPress colour pickers.
	$('.kdna-sps-colour').wpColorPicker();

	// Open the media library and drop the chosen image URL into the field.
	$('#kdna_sps_pick_image').on('click', function (e) {
		e.preventDefault();

		var frame = wp.media({
			title: 'Choose a loading image',
			button: { text: 'Use this image' },
			multiple: false
		});

		frame.on('select', function () {
			var attachment = frame.state().get('selection').first().toJSON();
			$('#kdna_sps_loader_image').val(attachment.url);
			$('#kdna_sps_image_preview').html(
				'<img src="' + attachment.url + '" style="max-width:80px;height:auto;" alt="" />'
			);
		});

		frame.open();
	});

	// Clear the chosen image.
	$('#kdna_sps_clear_image').on('click', function (e) {
		e.preventDefault();
		$('#kdna_sps_loader_image').val('');
		$('#kdna_sps_image_preview').empty();
	});
});
