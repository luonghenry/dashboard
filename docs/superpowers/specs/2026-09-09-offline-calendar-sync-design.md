# Offline Calendar Sync Design

## Goal

Keep the dashboard's displayed calendar synchronized with the device's JST date
when network access is unavailable.

## Design

The existing one-second `updateClock()` interval remains the source of display
updates and uses the local device clock through `getJST()`. Each tick compares
the current JST year and month with the calendar state. When the date crosses
into a new month or year, the calendar state is updated and
`loadHolidaysForYear()` is called. That function already prefers bundled
holiday data and localStorage, and skips network requests while offline.

After the state change, the existing calendar rendering path rebuilds both
calendar views and the current-month holiday list. This preserves manual
calendar navigation during normal operation and avoids adding any network
dependency to clock or calendar updates.

## Error handling and compatibility

No new network calls, storage formats, or language features are introduced.
The implementation remains ES5-compatible for Kindle WebKit. If holiday data
is unavailable, the calendar still updates its date and renders without
holiday markers, matching the existing fallback behavior.

## Validation

Verify by inspecting the date rollover logic and running the repository's
available static checks; no build system or automated test suite is defined.
