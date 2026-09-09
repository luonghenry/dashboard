# Resolution Presets Responsive Fix Design

## Problem

The screen selector changes the `body` class and persists the selected value,
but the current presets apply large fixed pixel sizes. On a narrow Kindle
viewport, Full HD, 2K, and 4K can therefore overflow horizontally or appear
not to fit the selected device.

## Design

Keep the existing five presets and localStorage behavior. Treat a preset as a
layout density preference rather than a request to enlarge the physical
viewport:

- all presets remain constrained to the actual viewport width;
- narrow viewports use a final responsive safety layer that caps large clock,
  calendar, timer, calculator, and control dimensions;
- wider viewports retain the distinct spacing and type scale for Full HD, 2K,
  and 4K;
- the network/status row and screen selector wrap or shrink within the
  viewport instead of creating horizontal overflow.

The implementation stays in the existing class-based CSS architecture and
uses ES5-compatible JavaScript without adding dependencies or changing stored
data shapes.

## Validation

Use the browser preview to select each preset and verify the class, stored
value, computed styles, and that document scroll width does not exceed the
viewport width. Check the Kindle 8 layout specifically for readable controls
and no horizontal scrolling. Run the existing JavaScript syntax and diff
checks.
