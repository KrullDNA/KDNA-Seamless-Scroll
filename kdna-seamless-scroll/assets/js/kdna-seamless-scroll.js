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
		var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
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
			fetch(nextUrl, { credentials: 'same-origin' }).then(function () {
				var now = (window.performance && performance.now) ? performance.now() : Date.now();
				log('Preload fetch complete in', Math.round(now - t0), 'ms — next project is warm.');
			}).catch(function () {});
		} catch (e) {}
		log('Preloading next project…');
	}

	// --- Advance -----------------------------------------------------------

	var advancing = false;
	function advance() {
		if (advancing) {
			return;
		}
		advancing = true;
		preload();
		log('Auto-advancing to next project:', nextUrl);

		// Navigate to the (preloaded) next project. It loads as a real page so all
		// its MotionPage animations, backgrounds and scripts run normally. The cover
		// fades up first so there is no flash between the old and new page; the new
		// page starts under its own opaque cover and fades it out on arrival.
		if (cfg.useLinkTransition) {
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
			}, cfg.advanceFallbackMs || 1200);
			return;
		}

		// Crossfade / none modes: just navigate. In crossfade mode the page has
		// opted into cross-document View Transitions, so the browser dissolves
		// between the two pages itself (no colour, no flash) — and because your
		// matching image lines up, the change looks seamless.
		var cover = document.querySelector('.kdna-sps-cover');
		if (!cover) {
			location.href = nextUrl;
			return;
		}

		// Colour-cover mode: fade the cover up, then navigate once covered.
		var ms = cfg.transitionMs || 300;
		cover.style.animation = 'none';
		cover.style.transition = 'opacity ' + ms + 'ms ease';
		cover.style.pointerEvents = 'auto';
		void cover.offsetWidth;            // reflow so the transition takes effect
		cover.style.opacity = '1';
		setTimeout(function () {
			location.href = nextUrl;
		}, ms);
	}

	// --- Trigger -----------------------------------------------------------

	// The element whose position drives things: an explicit trigger element if set,
	// otherwise the Next Project link itself. Preloading starts as we approach it;
	// the page advances when its top reaches the top of the browser.
	//
	// The trigger and preload markers are resolved lazily: Elementor applies
	// sticky/dynamic attributes after our script first runs, so an id that is not
	// queryable on load becomes available a moment later. We keep looking until we
	// find them, then stop, rather than giving up and falling back immediately.
	var advanceSel = cfg.advanceSelector || '';
	var preloadSel = cfg.preloadSelector || '';
	var triggerEl = nextEl;                               // default until the marker is found
	var preloadEl = null;
	var advanceResolved = !advanceSel;                   // nothing to resolve if no selector set
	var preloadResolved = !preloadSel;

	function resolveTargets() {
		if (!advanceResolved) {
			var a = document.querySelector(advanceSel);
			if (a) {
				triggerEl = a;
				advanceResolved = true;
				log('Advance trigger resolved:', advanceSel);
			}
		}
		if (!preloadResolved) {
			var p = document.querySelector(preloadSel);
			if (p) {
				preloadEl = p;
				preloadResolved = true;
				log('Preload trigger resolved:', preloadSel);
			}
		}
	}

	var advanceTop = cfg.advanceTop || 0;                // advance when the trigger top reaches this many px from the top
	var wasBelow = false;                                // has the trigger been below the fold at least once?

	function check() {
		resolveTargets();

		var rect = triggerEl.getBoundingClientRect();
		var vh = window.innerHeight || document.documentElement.clientHeight;

		// Warm the cache. With a preload marker, when it scrolls into view; without
		// one, as soon as the visitor starts scrolling — so the next project is
		// already cached by the time they reach the bottom (no wait on advance).
		if (preloadSel) {
			if (preloadEl && preloadEl.getBoundingClientRect().top <= vh) {
				preload();
			}
		} else {
			preload();
		}

		// Only arm advancing once the trigger has genuinely sat below the fold, so
		// we advance when the visitor scrolls DOWN to meet it — never at page top,
		// and never instantly if the trigger is already on screen at load.
		if (rect.top > vh) {
			wasBelow = true;
		}

		if (wasBelow && rect.top <= advanceTop) {
			if (!advancing) {
				log('Advance: trigger top reached', Math.round(rect.top));
			}
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

	// ── Persistent-element pinning ───────────────────────────────────────────
	// A stable view-transition-name keeps the header/logo painted in place across
	// the crossfade instead of dissolving (the flicker). Elementor's sticky effect
	// clones the header, though, so a plain CSS name lands on two elements and the
	// browser voids it. Here we re-apply the name with JS to ONLY the live element
	// (skipping the hidden sticky spacer clone), right before each page snapshot.
	var pins = (cfg.pins && cfg.pins.length) ? cfg.pins : null;
	var pinScheduled = false;

	// Is this the on-screen element, not a hidden Elementor sticky spacer/clone?
	function pinIsLive(el) {
		if (el.classList && el.classList.contains('elementor-sticky__spacer')) {
			return false;
		}
		var cs = window.getComputedStyle(el);
		if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) {
			return false;
		}
		var r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0;
	}

	function applyPins() {
		if (!pins || cfg.transitionMode !== 'crossfade') {
			return;
		}
		for (var i = 0; i < pins.length; i++) {
			var els = [].slice.call(document.querySelectorAll(pins[i].sel));
			if (!els.length) {
				continue;
			}
			var live = els.filter(pinIsLive);
			if (!live.length) {
				live = els;
			}
			// Prefer a fixed/sticky element nearest the top — the visible header.
			live.sort(function (a, b) {
				var pa = window.getComputedStyle(a).position;
				var pb = window.getComputedStyle(b).position;
				var fa = (pa === 'fixed' || pa === 'sticky') ? 0 : 1;
				var fb = (pb === 'fixed' || pb === 'sticky') ? 0 : 1;
				if (fa !== fb) {
					return fa - fb;
				}
				return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
			});
			var chosen = live[0];
			for (var j = 0; j < els.length; j++) {
				// Inline style beats the baseline stylesheet, so only ONE element
				// carries the name at snapshot time and the browser keeps it valid.
				els[j].style.viewTransitionName = (els[j] === chosen) ? pins[i].name : 'none';
			}
		}
	}

	if (pins) {
		// pageswap: the outgoing page, just before its snapshot is captured.
		// pagereveal: the incoming page, just before it first renders.
		window.addEventListener('pageswap', function (e) {
			if (e.viewTransition) { applyPins(); }
		});
		window.addEventListener('pagereveal', function (e) {
			if (e.viewTransition) { applyPins(); }
		});
		// Keep the name on the live element as the sticky state flips on scroll.
		window.addEventListener('scroll', function () {
			if (pinScheduled) { return; }
			pinScheduled = true;
			var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
			raf(function () { applyPins(); pinScheduled = false; });
		}, { passive: true });
	}

	function init() {
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		applyPins();
		resolveTargets();
		log('Next project link:', {
			tag: nextEl.tagName,
			cls: (nextEl.className || '').slice(0, 80),
			href: nextUrl,
			topAtLoad: Math.round(nextEl.getBoundingClientRect().top)
		});
		log('Config:', {
			advanceSelector: advanceSel || '(next link)',
			advanceResolved: advanceResolved,
			preloadSelector: preloadSel || '(on first scroll)',
			preloadResolved: preloadResolved,
			viewport: window.innerHeight
		});
		// Run a first pass so anything already in position is handled.
		check();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
