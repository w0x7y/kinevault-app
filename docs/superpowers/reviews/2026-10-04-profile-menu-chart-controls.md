# Profile menu selection and chart controls

The Profile dropdown no longer focuses its first item when opened with a
pointer. The Profile row's current-page highlight and `aria-current="page"`
appear only on `/profile`. Keyboard opening still focuses the first item;
arrows, Home/End, Escape, outside dismissal, and return focus remain available.
Keyboard focus uses a border independently of the current-page background.

The chart icon beside Workout progress retains its appearance and placement
as a decorative view. Its press handler, expand/collapse state, daily measurement
list, and daily-selection state have been removed. Metric/exercise/range controls
and graph point selection remain functional; selected weekly values are still
announced below the graph.

Validation:

- `npm run check`: TypeScript and 565 direct tests passed.
- Profile and menu browser suites: 27 passed, zero failures, one expected
  optional capture skipped.
- Added pointer/current-route regression coverage and retained keyboard and
  menu dismissal tests. Chart coverage verifies the icon remains visible,
  clicking it produces no list, weekly selection still works, and range/metric
  changes and source recovery remain functional.
- TypeScript unused-local/parameter checks and web/iOS/Android exports passed.
- Android emulator confirmed the neutral Profile row on Home and current-page
  highlight on Profile. The shared browser confirmed a neutral Home menu and
  the visible, noninteractive chart icon with no data list after clicking.
- `git diff --check` passed.
