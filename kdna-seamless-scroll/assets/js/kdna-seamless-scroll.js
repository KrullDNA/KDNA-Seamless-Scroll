/**
 * KDNA Seamless Portfolio Scroll — auto-advance engine
 *
 * As the visitor reaches the next-project preview at the foot of a portfolio
 * project, this quietly preloads that project and then advances to it for them,
 * with no click required. Because each project loads as a real page, all of its
 * MotionPage animations, parallax backgrounds, custom scripts and video
 * initialise normally; the site's own page transition (if set) masks the load.
 *
 * It advances by triggering the in-content "Next Project" link, so any MotionPage
 * Page Exit animation on that link still plays — now fired automatically.
 */
(function () {
	'use strict';

	var cfg = window.KDNA_SPS || {};

	// Simple logger, only speaks when ?kdna_debug=1 is on the URL.
	function log() {
		if (cfg.debug && window.console) {
			console.log.apply(console, ['[KDNA SPS]'].concat([].slice.call(arguments)));
		}
	}

	function sameUrl(a, b) {
		return a.split('#')[0] === b.split('#')[0];
	}

	// Does this href look like a single project permalink, e.g. /portfolio/slug/ ?
	// Used so a container link (HTML tag "a", JetEngine "Next Project URL" field)
	// is recognised even though its href is a clean permalink rather than ?p=.
	function isProjectSingle(href) {
		try {
			var path = new URL(href, location.origin).pathname;
			return new RegExp('/' + (cfg.postTypeSlug || 'portfolio') + '/[^/]+/?$').test(path);
		} catch (e) {
			return false;
		}
	}

	// Find the link to the next project: an explicit selector if one is set in
	// settings (recommended for an Elementor container link), otherwise the last
	// in-content link that points to another project — a ?p= href, a permalink to
	// a project single, or link text containing "next".
	function findNextLink(scope) {
		scope = scope || document;

		if (cfg.nextLinkSelector) {
			var explicit = scope.querySelector(cfg.nextLinkSelector);
			if (explicit && explicit.href) {
				return explicit;
			}
		}

		var links = scope.querySelectorAll('a[href]');
		var candidate = null;
		for (var i = 0; i < links.length; i++) {
			var href = links[i].href;
			var text = (links[i].textContent || '').toLowerCase();
			if (!href || sameUrl(href, location.href)) {
				continue;
			}
			if (href.indexOf('?p=') > -1 || text.indexOf('next') > -1 || isProjectSingle(href)) {
				candidate = links[i];
			}
		}
		return candidate;
	}

	var nextEl = findNextLink(document);
	if (!nextEl) {
		log('No next project link found, auto-advance idle.');
		return;
	}

	// Keep the debug flag travelling with us so the project we advance into also
	// logs to the console during testing.
	if (cfg.debug) {
		try {
			var du = new URL(nextEl.href, location.origin);
			if (!du.searchParams.has('kdna_debug')) {
				du.searchParams.set('kdna_debug', '1');
				nextEl.href = du.href;
			}
		} catch (e) {}
	}

	var nextUrl = nextEl.href;
	log('Next project:', nextUrl);

	// --- Preload -----------------------------------------------------------

	var preloaded = false;
	function preload() {
		if (preloaded) {
			return;
		}
		preloaded = true;
		try {
			var link = document.createElement('link');
			link.rel = 'prefetch';
			link.as = 'document';
			link.href = nextUrl;
			document.head.appendChild(link);
		} catch (e) {}
		// Belt and braces: a same-origin fetch warms the HTML cache even where
		// rel=prefetch is ignored by the browser.
		try {
			fetch(nextUrl, { credentials: 'same-origin' }).catch(function () {});
		} catch (e) {}
		log('Preloaded next project.');
	}

	// --- Advance -----------------------------------------------------------

	var advancing = false;
	function advance() {
		if (advancing) {
			return;
		}
		advancing = true;
		preload();
		log('Auto-advancing to next project.');

		// Trigger the site's own transition: clicking the link fires any MotionPage
		// Page Exit animation bound to it, then navigates. If nothing navigates
		// shortly (no transition set, or the element is not a real link) we fall
		// back to a plain navigation.
		var navigated = false;
		window.addEventListener('beforeunload', function () { navigated = true; });

		try {
			nextEl.click();
		} catch (e) {
			location.href = nextUrl;
			return;
		}

		setTimeout(function () {
			if (!navigated) {
				location.href = nextUrl;
			}
		}, cfg.advanceFallbackMs || 3000);
	}

	// --- Trigger -----------------------------------------------------------

	// The element whose position drives things: an explicit trigger element if set,
	// otherwise the Next Project link itself. Preloading starts as we approach it;
	// the page advances when its top reaches the top of the browser.
	var triggerEl = (cfg.advanceSelector && document.querySelector(cfg.advanceSelector)) || nextEl;
	if (cfg.advanceSelector && triggerEl === nextEl) {
		log('Advance trigger "' + cfg.advanceSelector + '" not found, falling back to the next link.');
	}

	var preloadOffset = cfg.triggerOffset || 1500;       // px before the trigger reaches the top to start preloading
	var advanceTop = cfg.advanceTop || 0;                // advance when the trigger top reaches this many px from the top
	var wasBelow = false;                                // has the trigger been below the fold at least once?

	function check() {
		var rect = triggerEl.getBoundingClientRect();
		var vh = window.innerHeight || document.documentElement.clientHeight;

		// Warm the cache once the trigger is within preloadOffset of the top.
		if (rect.top <= preloadOffset) {
			preload();
		}

		// Only arm advancing once the trigger has genuinely sat below the fold, so
		// we advance when the visitor scrolls DOWN to meet it — never at page top,
		// and never instantly if the trigger is already on screen at load.
		if (rect.top > vh) {
			wasBelow = true;
		}

		if (wasBelow && rect.top <= advanceTop) {
			log('Advance: trigger top reached', Math.round(rect.top));
			advance();
		}
	}

	var ticking = false;
	function onScroll() {
		if (ticking) {
			return;
		}
		ticking = true;
		var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
		raf(function () {
			check();
			ticking = false;
		});
	}

	function init() {
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		var rl = nextEl.getBoundingClientRect();
		var rt = triggerEl.getBoundingClientRect();
		log('Next project link:', {
			tag: nextEl.tagName,
			cls: (nextEl.className || '').slice(0, 80),
			href: nextUrl,
			topAtLoad: Math.round(rl.top)
		});
		log('Advance trigger element:', {
			tag: triggerEl.tagName,
			cls: (triggerEl.className || '').slice(0, 80),
			topAtLoad: Math.round(rt.top),
			viewport: window.innerHeight
		});
		log('Auto-advance ready. Preload within ' + preloadOffset + 'px of top; advance when trigger top ≤ ' + advanceTop + 'px.');
		// Preload (only) straight away if the preview is already close on load.
		check();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
