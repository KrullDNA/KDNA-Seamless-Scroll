=== KDNA Seamless Portfolio Scroll ===
Author: Krull Design & Advertising
Version: 1.0.0

WHAT IT DOES
As a visitor nears the bottom of a portfolio project, the next project quietly
loads and slots in underneath, so the work pages flow as one continuous scroll.
The address bar and page title update to match whichever project is on screen,
so links stay shareable and the back button still behaves.

Inspired by continuous-scroll agency sites such as exoape.com.

WHERE IT RUNS
Single pages of the "portfolio" post type only. Assets never load anywhere else.

STAGE 1 (this version)
The core loading engine: detect the next project, fetch it, append it, and swap
the URL and title as you scroll. Loads content in straight away.

STILL TO COME
Stage 2: re-trigger Elementor animations on each loaded project.
Stage 3: a settings page to tune selectors and behaviour without code.
Stage 4: polish, including end-of-list handling and optional smooth scrolling.

TUNING (for the developer)
Three filters are available if the defaults need adjusting:
- kdna_sps_post_types        (array of post types to run on)
- kdna_sps_content_selectors (array of CSS selectors for the content wrapper)
- kdna_sps_next_link_selector (exact CSS selector for the Next Project link)
- kdna_sps_trigger_offset    (pixels from the bottom before loading starts)

DEBUGGING
Add ?kdna_debug=1 to a portfolio URL to see what the engine is doing in the
browser console (F12).
