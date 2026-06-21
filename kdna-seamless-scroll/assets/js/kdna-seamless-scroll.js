/**
 * KDNA Seamless Portfolio Scroll
 *
 * As the visitor nears the bottom of a portfolio project, this quietly fetches
 * the next project, slots its content in underneath, and swaps the address bar
 * and page title over as each project scrolls into view. No click required.
 *
 * Stage 1: the core loading engine. Elementor animation re-init arrives in Stage 2.
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

	// Turn any URL into a clean, comparable form (no hash).
	function normalise(url) {
		try {
			var a = document.createElement('a');
			a.href = url;
			return a.href.split('#')[0];
		} catch (e) {
			return url;
		}
	}

	// Keep the ?kdna_debug flag in the address bar when we swap URLs, so it
	// stays on if the page is reloaded during testing.
	function withDebug(url) {
		if (!cfg.debug) {
			return url;
		}
		try {
			var u = new URL(url, window.location.origin);
			if (!u.searchParams.has('kdna_debug')) {
				u.searchParams.set('kdna_debug', '1');
			}
			return u.href;
		} catch (e) {
			return url;
		}
	}

	// Find the element that holds a single project's content.
	function findContainer(root) {
		var selectors = cfg.contentSelectors || ['.elementor-location-single', 'main'];
		for (var i = 0; i < selectors.length; i++) {
			var el = (root || document).querySelector(selectors[i]);
			if (el) {
				return el;
			}
		}
		return null;
	}

	var container = findContainer(document);
	if (!container) {
		log('No content container found, nothing to do.');
		return;
	}

	// --- State -------------------------------------------------------------

	var loading = false;          // a fetch is in progress
	var finished = false;         // no more projects to load
	var loadedUrls = {};          // guard against loading the same project twice
	var currentNextUrl = null;    // the project we will load next
	var panels = [];              // every project section now on the page
	var lastPanel = null;         // the most recently added panel
	var panelCounter = 0;         // gives each loaded panel a unique id
	var panelObserver = null;     // watches which panel is centre screen
	var loaderEl = null;          // the loading indicator element

	// The page we are starting on counts as already loaded.
	loadedUrls[normalise(location.href)] = true;

	// --- Finding the next project link -------------------------------------

	function findNextLink(scope) {

		// If a precise selector was supplied in settings, trust it.
		if (cfg.nextLinkSelector) {
			var explicit = scope.querySelector(cfg.nextLinkSelector);
			if (explicit && explicit.href) {
				return explicit.href;
			}
		}

		// Otherwise auto-detect: an in-content link pointing to another project.
		// Your "Next Project" link uses a ?p= style href and includes the word "next",
		// so we look for either of those signals and keep the last match (lowest on the page).
		var links = scope.querySelectorAll('a[href]');
		var candidate = null;

		for (var i = 0; i < links.length; i++) {
			var href = links[i].href;
			var text = (links[i].textContent || '').toLowerCase();

			if (!href) {
				continue;
			}
			if (loadedUrls[normalise(href)]) {
				continue;
			}
			if (href.indexOf('?p=') > -1 || text.indexOf('next') > -1) {
				candidate = href;
			}
		}

		return candidate;
	}

	// --- Bringing across each project's own Elementor styling --------------

	function injectPostCss(doc) {

		// External per-post Elementor stylesheets. These are scoped by Elementor
		// to the post id, so they do not clash between projects. Dynamic hero
		// backgrounds are handled separately and inline, see applyOwnBackgrounds.
		var links = doc.querySelectorAll('link[rel="stylesheet"][href]');
		for (var i = 0; i < links.length; i++) {
			var href = links[i].getAttribute('href');
			if (!href || href.indexOf('/uploads/elementor/css/post-') === -1) {
				continue;
			}
			if (document.querySelector('link[href="' + href + '"]')) {
				continue;
			}
			var clone = document.createElement('link');
			clone.rel = 'stylesheet';
			clone.href = href;
			document.head.appendChild(clone);
			log('Injected CSS:', href);
		}
	}

	// Take each loaded project's own background images and pin them straight onto
	// the matching elements inside this project's panel. An inline style beats any
	// shared rule, so projects can no longer borrow each other's hero image. We
	// look in inline styles first, then fetch and read the project's own external
	// stylesheets, since classic Elementor backgrounds usually live in a CSS file.
	function applyOwnBackgrounds(doc, panel) {

		var hid = heroId(panel);

		// Useful picture of where this project's styles live.
		if (cfg.debug) {
			var sheetNames = [];
			doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (l) {
				var h = l.getAttribute('href') || '';
				if (h.indexOf('/uploads/') > -1 || h.indexOf('elementor') > -1) {
					sheetNames.push(h.split('/').pop());
				}
			});
			log('Stylesheets in fetched project: ' + JSON.stringify(sheetNames));
			log('Hero element id: ' + hid);
		}

		// 1) Inline styles in the fetched page.
		var inline = [];
		doc.querySelectorAll('style').forEach(function (st) {
			var css = st.textContent || '';
			if (css.indexOf('url(') > -1) {
				inline.push(css);
			}
		});
		var inlineCombined = inline.join('\n');

		// Pin straight away (covers static container backgrounds), then pin again
		// after Elementor's motion effects have built their moving layers, so those
		// layers receive the image too. Without this, parallax sections show blank.
		applyBgRules(inlineCombined, panel, 'inline styles', hid);
		setTimeout(function () {
			applyBgRules(inlineCombined, panel, 'inline styles (after layers)', hid);
		}, 350);
		setTimeout(function () {
			applyBgRules(inlineCombined, panel, 'inline styles (after layers)', hid);
		}, 900);

		// 2) External per-post Elementor stylesheets, fetched and read.
		doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (link) {
			var href = link.getAttribute('href');
			if (!href || href.indexOf('/uploads/elementor/css/post-') === -1) {
				return;
			}
			fetch(href, { credentials: 'same-origin' })
				.then(function (r) { return r.text(); })
				.then(function (css) {
					applyBgRules(css, panel, href.split('/').pop(), hid);
					setTimeout(function () {
						applyBgRules(css, panel, href.split('/').pop() + ' (after layers)', hid);
					}, 900);
				})
				.catch(function (e) { log('Background CSS fetch failed:', href, e); });
		});
	}

	// Pull the hero element's Elementor id (the part after elementor-element-).
	function heroId(panel) {
		var el = panel.querySelector('[class*="elementor-element-"]');
		if (!el) {
			return '';
		}
		var m = (el.className || '').match(/elementor-element-([0-9a-z]+)/i);
		return m ? m[1] : '';
	}

	// Remove @media, @keyframes and other at-rule blocks so we only read base
	// rules. This avoids applying a mobile background image on desktop.
	function stripAtBlocks(css) {
		var i = css.indexOf('@');
		while (i !== -1) {
			var brace = css.indexOf('{', i);
			if (brace === -1) {
				break;
			}
			var depth = 1;
			var j = brace + 1;
			while (j < css.length && depth > 0) {
				var ch = css.charAt(j);
				j++;
				if (ch === '{') {
					depth++;
				} else if (ch === '}') {
					depth--;
				}
			}
			css = css.slice(0, i) + css.slice(j);
			i = css.indexOf('@', i);
		}
		return css;
	}

	// Find background rules in some CSS text and pin them onto matching elements
	// inside the panel. Handles plain background-image and Elementor's custom
	// property style backgrounds (for example --e-bg-image).
	function applyBgRules(cssText, panel, source, hid) {

		if (!cssText) {
			return;
		}

		// Diagnostic: show how the hero id is declared in this source, if at all.
		if (cfg.debug && hid) {
			var needle = 'elementor-element-' + hid;
			var at = cssText.indexOf(needle);
			if (at > -1) {
				log('Hero id seen in ' + source + ': ' + cssText.slice(at, at + 180).replace(/\s+/g, ' '));
			}
		}

		var css = stripAtBlocks(cssText);
		var ruleRe = /([^{}]+)\{([^{}]*)\}/g;
		var match;
		var applied = 0;

		while ((match = ruleRe.exec(css)) !== null) {
			var rawSelector = match[1].trim();
			var body = match[2];

			if (!rawSelector || rawSelector.indexOf('@') > -1) {
				continue;
			}
			if (body.indexOf('url(') === -1) {
				continue;
			}

			// Collect background-image and any custom property that holds a url.
			var decls = [];
			var declRe = /(background-image|background|--[\w-]+)\s*:\s*([^;]*url\([^;]*\)[^;]*)/gi;
			var d;
			while ((d = declRe.exec(body)) !== null) {
				decls.push([d[1], d[2].trim()]);
			}
			if (!decls.length) {
				continue;
			}

			// A rule can list several selectors. Elementor's hero backgrounds use
			// :not(.elementor-motion-effects-...), so strip any :not() refinement,
			// then skip anything still carrying a real pseudo state like :hover.
			rawSelector.split(',').forEach(function (sel) {
				sel = sel.replace(/:not\([^)]*\)/g, '').trim();
				if (!sel || sel.indexOf(':') > -1) {
					return;
				}
				var els;
				try {
					els = panel.querySelectorAll(sel);
				} catch (e) {
					return;
				}
				els.forEach(function (el) {
					decls.forEach(function (pair) {
						el.style.setProperty(pair[0], pair[1]);
						applied++;
					});
				});
			});
		}

		if (applied) {
			log('Pinned backgrounds from ' + source + ':', applied);
		}
	}

	// --- Adding a loaded project to the page -------------------------------

	// Common lazy-load patterns hold the real image in a data attribute and only
	// swap it in on scroll, which never fires for content added after load. We
	// swap them in immediately so images and backgrounds show.
	function revealLazyAssets(scope) {

		scope.querySelectorAll('img[data-src]').forEach(function (img) {
			var src = img.getAttribute('data-src');
			if (src) { img.setAttribute('src', src); }
		});

		scope.querySelectorAll('img[data-srcset], source[data-srcset]').forEach(function (el) {
			var ss = el.getAttribute('data-srcset');
			if (ss) { el.setAttribute('srcset', ss); }
		});

		['data-bg', 'data-background', 'data-bg-url', 'data-background-image'].forEach(function (attr) {
			scope.querySelectorAll('[' + attr + ']').forEach(function (el) {
				var v = el.getAttribute(attr);
				if (v) { el.style.backgroundImage = 'url(' + v + ')'; }
			});
		});

		// Tidy up classes that some lazy loaders use to keep images hidden.
		scope.querySelectorAll('.lazyload, .lazyloading').forEach(function (el) {
			el.classList.remove('lazyload', 'lazyloading');
			el.classList.add('lazyloaded');
		});
	}

	// Report how the first section's background is built, and any blank images,
	// so we can see exactly why a hero background might not be showing.
	function diagnoseBackground(scope) {

		if (!cfg.debug) {
			return;
		}

		var first = scope.querySelector('.elementor-section, .e-con, section, .elementor-container, .elementor-widget');
		if (first) {
			var cs = window.getComputedStyle(first);
			log('BG diag first block: ' + JSON.stringify({
				tag: first.tagName,
				cls: (first.className || '').slice(0, 140),
				inlineBg: (first.style && first.style.backgroundImage) || '',
				computedBg: (cs.backgroundImage || '').slice(0, 180),
				dataSettings: (first.getAttribute('data-settings') || '').slice(0, 180)
			}));
		} else {
			log('BG diag: no section-like element found in the panel.');
		}

		var blanks = [];
		scope.querySelectorAll('img').forEach(function (img) {
			var src = img.getAttribute('src') || '';
			if (!src || src.indexOf('data:image') === 0) {
				blanks.push({
					src: src.slice(0, 70),
					dataSrc: (img.getAttribute('data-src') || '').slice(0, 70),
					cls: (img.className || '').slice(0, 70)
				});
			}
		});
		log('BG diag blank-ish images (' + blanks.length + '): ' + JSON.stringify(blanks.slice(0, 4)));
	}

	function appendPanel(contentNode, url, title) {

		var imported = document.importNode(contentNode, true);

		var wrapper = document.createElement('div');
		wrapper.id = 'kdna-sps-panel-' + (++panelCounter);
		wrapper.className = 'kdna-sps-panel kdna-sps-loaded';
		wrapper.setAttribute('data-kdna-url', url);
		wrapper.setAttribute('data-kdna-title', title || '');
		wrapper.appendChild(imported);

		// Insert just after the previous panel, which keeps everything above the footer.
		var ref = lastPanel || container;
		ref.parentNode.insertBefore(wrapper, ref.nextSibling);

		// Make sure any lazy-loaded images and backgrounds in the new project show.
		revealLazyAssets(wrapper);
		diagnoseBackground(wrapper);

		lastPanel = wrapper;
		panels.push(wrapper);
		observePanel(wrapper);

		log('Appended project:', url);

		// Signal for Stage 2 (Elementor re-init) to wake up the new content.
		document.dispatchEvent(new CustomEvent('kdna_sps_panel_added', {
			detail: { panel: wrapper }
		}));

		return wrapper;
	}

	// --- Fetching the next project -----------------------------------------

	function loadNext() {

		if (loading || finished) {
			return;
		}
		if (!currentNextUrl) {
			log('No next project link, reached the end of the list.');
			finished = true;
			return;
		}

		var url = currentNextUrl;
		loading = true;
		showLoader();
		log('Loading next project:', url);

		fetch(url, { credentials: 'same-origin' })
			.then(function (res) {
				loadedUrls[normalise(url)] = true;
				loadedUrls[normalise(res.url)] = true;
				return res.text().then(function (html) {
					return { html: html, finalUrl: res.url };
				});
			})
			.then(function (data) {

				var doc = new DOMParser().parseFromString(data.html, 'text/html');
				injectPostCss(doc);

				var newContent = findContainer(doc);
				if (!newContent) {
					log('Fetched page had no content container, stopping.');
					finished = true;
					return;
				}

				var newPanel = appendPanel(newContent, data.finalUrl || url, doc.title || '');

				// Pin this project's own background images so they cannot be
				// overridden by another project sharing the same template.
				applyOwnBackgrounds(doc, newPanel);

				// Experimental: re-run the loaded project's own MotionPage init.
				reExecuteMotionPageScripts(doc);

				// Work out the link to the project after this one.
				currentNextUrl = findNextLink(lastPanel);
				log('Next up after this:', currentNextUrl);
				if (!currentNextUrl) {
					finished = true;
				}
			})
			.catch(function (err) {
				log('Load failed:', err);
			})
			.then(function () {
				hideLoader();
				loading = false;
				// If the new content was short, the trigger may still be in view, so check again.
				maybeLoadMore();
			});
	}

	// --- Deciding when to load ---------------------------------------------

	function maybeLoadMore() {
		var scrollBottom = window.scrollY + window.innerHeight;
		var docHeight = document.documentElement.scrollHeight;
		if (scrollBottom >= docHeight - (cfg.triggerOffset || 1200)) {
			loadNext();
		}
	}

	var ticking = false;
	function onScroll() {
		if (ticking) {
			return;
		}
		ticking = true;
		window.requestAnimationFrame(function () {
			maybeLoadMore();
			ticking = false;
		});
	}

	// --- Swapping the URL and title to match what is on screen -------------

	function observePanel(panel) {

		if (!('IntersectionObserver' in window)) {
			return;
		}

		if (!panelObserver) {
			// The "-50%" top and bottom margins create a trigger line down the
			// middle of the screen. Whichever panel crosses it becomes the active one.
			panelObserver = new IntersectionObserver(function (entries) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting) {
						return;
					}
					var url = entry.target.getAttribute('data-kdna-url');
					var title = entry.target.getAttribute('data-kdna-title');
					if (url && normalise(url) !== normalise(location.href)) {
						var displayUrl = withDebug(url);
						history.replaceState({ kdnaSps: true }, title || '', displayUrl);
						if (title) {
							document.title = title;
						}
						log('Address bar now showing:', displayUrl);
					}
				});
			}, {
				rootMargin: '-50% 0px -50% 0px',
				threshold: 0
			});
		}

		panelObserver.observe(panel);
	}

	// --- Waking up Elementor on each loaded project ------------------------

	// Main entry: when a new project is added, get its animations going.
	function reinitElementor(panel) {

		if (!cfg.reinitAnimations) {
			return;
		}

		// A quick snapshot of what we are working with, visible with ?kdna_debug=1.
		logEnvironment(panel);

		// Let the browser lay the new content out, then act.
		setTimeout(function () {
			runElementorReady(panel);     // wake up sliders and custom widgets
			setupEntranceAnimations(panel); // replay Elementor entrance animations ourselves
			refreshScrollAnimations();    // nudge GSAP and other scroll based effects
			// Tell any custom animation scripts (such as GSAP widgets) about the new content.
			document.dispatchEvent(new CustomEvent('kdna:content-added', { detail: { container: panel } }));
		}, 0);
	}

	// Print a summary of the environment so we can diagnose anything that stays put.
	function logEnvironment(panel) {
		if (!cfg.debug) {
			return;
		}
		var ef = window.elementorFrontend;
		var types = {};
		panel.querySelectorAll('.elementor-widget').forEach(function (n) {
			var t = n.getAttribute('data-widget_type');
			if (t) { types[t] = (types[t] || 0) + 1; }
		});
		log('Environment check:', {
			jQuery: !!window.jQuery,
			elementorFrontend: !!ef,
			runReadyTrigger: !!(ef && ef.elementsHandler && ef.elementsHandler.runReadyTrigger),
			gsap: !!window.gsap,
			ScrollTrigger: !!(window.ScrollTrigger || (window.gsap && window.gsap.ScrollTrigger)),
			invisibleElements: panel.querySelectorAll('.elementor-invisible').length,
			widgetTypes: types
		});
	}

	// Re-run Elementor's ready routine so widget handlers (sliders, carousels,
	// and your custom KDNA widgets such as the GSAP text reveal) wake up.
	function runElementorReady(panel) {

		var $ = window.jQuery;
		var ef = window.elementorFrontend;

		if (!$ || !ef || !ef.hooks || typeof ef.hooks.doAction !== 'function') {
			log('elementorFrontend hooks not available, cannot re-init widgets.');
			return;
		}

		var nodes = panel.querySelectorAll('.elementor-element');
		var fired = {};

		nodes.forEach(function (node) {
			var $node = $(node);
			try {
				ef.hooks.doAction('frontend/element_ready/global', $node, $);

				// Fire the element-type hook (container, section, column, widget).
				// Elementor's motion-effects and background handlers hook in here,
				// which is what brings parallax and video backgrounds to life.
				var elementType = node.getAttribute('data-element_type');
				if (elementType) {
					ef.hooks.doAction('frontend/element_ready/' + elementType, $node, $);
					fired[elementType] = (fired[elementType] || 0) + 1;
				}

				// Then the specific widget handler (sliders, your custom widgets).
				var widgetType = node.getAttribute('data-widget_type');
				if (widgetType) {
					ef.hooks.doAction('frontend/element_ready/' + widgetType, $node, $);
					fired[widgetType] = (fired[widgetType] || 0) + 1;
				}
			} catch (e) {
				log('Ready-hook error:', e);
			}
		});

		log('Fired Elementor ready hooks for widget types:', fired);
	}

	// Read an Elementor element's entrance animation from its settings.
	function getAnimation(el) {
		var raw = el.getAttribute('data-settings');
		if (!raw) {
			return null;
		}
		try {
			var s = JSON.parse(raw);
			var name = s._animation || s.animation || s._animation_mobile || s._animation_tablet;
			if (!name || name === 'none') {
				return null;
			}
			var delay = s._animation_delay || s.animation_delay || 0;
			return { name: name, delay: delay };
		} catch (e) {
			return null;
		}
	}

	// Reveal and animate one element the way Elementor would.
	function playAnimation(el) {
		var anim = getAnimation(el);
		el.classList.remove('elementor-invisible');
		if (anim) {
			if (anim.delay) {
				el.style.animationDelay = anim.delay + 'ms';
			}
			el.classList.add('animated', anim.name);
			log('Played entrance animation:', anim.name);
		}
	}

	// Watch the entrance-animated items in this project. As each scrolls into
	// view we give Elementor a brief grace period to handle it, and if it has
	// not, we play the animation ourselves. This guarantees the effect runs and
	// keeps the staggered, scroll-based timing.
	function setupEntranceAnimations(panel) {

		var items = panel.querySelectorAll('.elementor-invisible');
		log('Entrance-animation elements:', items.length);

		if (!items.length) {
			return;
		}

		if (!('IntersectionObserver' in window)) {
			items.forEach(playAnimation);
			return;
		}

		var obs = new IntersectionObserver(function (entries, o) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) {
					return;
				}
				var el = entry.target;
				o.unobserve(el);
				setTimeout(function () {
					if (el.classList.contains('elementor-invisible')) {
						playAnimation(el);
					}
				}, 250);
			});
		}, { threshold: 0.15 });

		items.forEach(function (el) {
			obs.observe(el);
		});
	}

	// Nudge GSAP and other scroll-driven libraries to recalculate after the
	// page height has changed.
	function refreshScrollAnimations() {		try {
			if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') {
				window.ScrollTrigger.refresh();
				log('Refreshed GSAP ScrollTrigger.');
			} else if (window.gsap && window.gsap.ScrollTrigger) {
				window.gsap.ScrollTrigger.refresh();
				log('Refreshed gsap.ScrollTrigger.');
			}
		} catch (e) {
			log('ScrollTrigger refresh issue:', e);
		}
		// Many scroll effects recalculate on a resize event.
		window.dispatchEvent(new Event('resize'));
	}

	// Experimental: re-run a loaded project's own MotionPage init script so its
	// animations rebuild for the new content. We target only scripts whose id
	// starts with "mp-" so nothing else on the page is touched.
	function reExecuteMotionPageScripts(doc) {

		if (!cfg.reexecScripts) {
			return;
		}

		var scripts = doc.querySelectorAll('script[id^="mp-"]:not([src])');
		log('MotionPage inline scripts found in fetched page:', scripts.length);

		if (!scripts.length) {
			return;
		}

		scripts.forEach(function (old) {
			try {
				var fresh = document.createElement('script');
				if (old.id) {
					fresh.id = old.id + '-kdna-reexec';
				}
				fresh.textContent = old.textContent;
				document.body.appendChild(fresh);
				log('Re-ran MotionPage script:', old.id);
			} catch (e) {
				log('MotionPage re-run issue:', e);
			}
		});

		// Once MotionPage has rebuilt, recalculate scroll positions.
		setTimeout(refreshScrollAnimations, 60);
	}

	// --- Loading indicator -------------------------------------------------

	// Build the inside of the loader: a spinner, or a custom image if one is set.
	function buildLoaderInner() {
		var loader = cfg.loader || {};
		if (loader.type === 'image' && loader.image) {
			return '<img class="kdna-sps-loader-img" src="' + loader.image + '" alt="Loading">';
		}
		return '<span class="kdna-sps-spinner"></span>';
	}

	function showLoader() {
		if (!loaderEl) {
			loaderEl = document.createElement('div');
			loaderEl.className = 'kdna-sps-loader';
			loaderEl.innerHTML = buildLoaderInner();
			document.body.appendChild(loaderEl);
		}
		loaderEl.classList.add('is-active');
	}

	function hideLoader() {
		if (loaderEl) {
			loaderEl.classList.remove('is-active');
		}
	}

	// --- Marquee bands -----------------------------------------------------

	// The theme's marquee strips were initialised by an inline <script> bound to
	// window 'load' (which fires once and never sees AJAX-loaded projects, and
	// only ever grabs the first match on the page). We run the same effect here
	// instead — per panel, scoped, and idempotent — so every project's marquee
	// moves. Add the class .marquee (scrolls left) or .marquee2 (scrolls right)
	// in Elementor and REMOVE the old inline <script> so nothing runs twice.

	function initMarquees(scope) {
		var speed = (typeof cfg.marqueeSpeed === 'number' && cfg.marqueeSpeed > 0) ? cfg.marqueeSpeed : 0.7;
		scope.querySelectorAll('.marquee').forEach(function (el) {
			startMarquee(el, speed, 'left');
		});
		scope.querySelectorAll('.marquee2').forEach(function (el) {
			startMarquee(el, speed, 'right');
		});
	}

	function startMarquee(parent, speed, direction) {
		// Never clone or start the same strip twice (guards re-init and double load).
		if (parent.getAttribute('data-kdna-marquee') || !parent.children.length) {
			return;
		}
		parent.setAttribute('data-kdna-marquee', '1');

		if (direction === 'right') {
			// Mirrors the old Marquee2(): two extra clones, scrolling rightward.
			var twin = parent.innerHTML;
			parent.innerHTML += twin + twin;
			var totalWidth = parent.children[0].clientWidth * 2;
			var j = parent.children[0].clientWidth;
			setInterval(function () {
				j -= speed;
				if (j <= 0) { j = totalWidth; }
				parent.children[0].style.marginLeft = '-' + j + 'px';
			}, 0);
			log('Marquee (.marquee2, right) started');
			return;
		}

		// Mirrors the old Marquee(): one clone, scrolling leftward.
		var clone = parent.innerHTML;
		parent.innerHTML += clone;
		var i = 0;
		setInterval(function () {
			i += speed;
			if (i >= parent.children[0].clientWidth) { i = 0; }
			parent.children[0].style.marginLeft = '-' + i + 'px';
		}, 0);
		log('Marquee (.marquee, left) started');
	}

	// --- Start up ----------------------------------------------------------

	function init() {

		// When a new project is added, wake up its Elementor animations.
		document.addEventListener('kdna_sps_panel_added', function (e) {
			reinitElementor(e.detail.panel);
			initMarquees(e.detail.panel);
		});

		// Tag the project we started on as the first panel, so scrolling back up
		// restores its URL and title.
		container.classList.add('kdna-sps-panel');
		container.setAttribute('data-kdna-url', normalise(location.href));
		container.setAttribute('data-kdna-title', document.title);
		panels.push(container);
		observePanel(container);
		lastPanel = container;

		currentNextUrl = findNextLink(container);
		log('Settings: reinitAnimations=' + cfg.reinitAnimations + ', reexecScripts(MotionPage)=' + cfg.reexecScripts);
		log('First next project:', currentNextUrl);

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });

		// Start the marquees on the project we loaded on. Wait for full load so the
		// strip widths (which depend on images and fonts) are measured correctly.
		if (document.readyState === 'complete') {
			initMarquees(document);
		} else {
			window.addEventListener('load', function () { initMarquees(document); });
		}

		// In case the very first project is short, check straight away.
		maybeLoadMore();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
