# Resolution Presets Design

## Goal

Let users manually select a display preset so the dashboard remains usable
across Kindle 8, Kindle Paperwhite, Full HD, 2K, and 4K screens.

## Architecture

Add a screen preset selector beside the existing network controls. The
selector offers five named presets:

- Kindle 8 (600x800)
- Kindle Paperwhite (758x1024)
- Full HD (1920x1080)
- 2K (2560x1440)
- 4K (3840x2160)

The selector calls an ES5-compatible JavaScript function that applies one
screen-specific class to `body`. CSS owns the visual differences: content
max-width, spacing, type scale, controls, and large-clock layout. The
Paperwhite preset is the default when no preference is stored.

## Persistence and fallback

The selected preset is stored under a dedicated localStorage key through the
existing storage wrappers. Invalid or missing values fall back to Paperwhite.
The preset is applied during initialization before the first visible dashboard
render where possible, and changing it applies immediately without a reload.

## Compatibility

The implementation uses only existing HTML, CSS, and ES5 JavaScript patterns.
It does not depend on network access and does not change API data formats.
The AppCache version is bumped because cached static files change.

## Validation

Check JavaScript syntax, inspect the generated class and selector behavior,
and verify each preset in the browser preview at representative viewport
sizes. Confirm the saved selection survives reload and that Kindle 8 remains
readable without horizontal scrolling.
