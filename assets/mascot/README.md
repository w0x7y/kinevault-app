# Kine

Kine is a flat 2D blue creature with cream mitten hands, feet, and asymmetrical
head tips. The twelve poses keep Kine's identity
and greeting motion. These full-body page poses are separate from the
purpose-built Kine launcher icon and splash assets in `../branding/`.

For in-app poses, the app imports only the transparent
`assets/mascot/2d/kine-*.webp` files (paths from `Application/`). The original
generated PNGs in `2d/source/` are high-resolution source artwork and are not bundled.
The welcome pose was converted from the original 3D Kine using the built-in
Imagegen tool. Each other pose was generated separately using the new 2D welcome
as its identity reference. Exact prompts and provenance are in `2d/prompts.json`.

Onboarding starts with welcome and flag (goal), then age confirmation, listening
(name), measuring tape (body), running (activity), bowl (calories), and celebration
(review). Age reuses `kine-body.webp`; there are twelve distinct image files for
thirteen pose keys, including loading.

Tabs: morning stretch (Home, internally `today` / `kine-today.webp`), fruit and
spoon (Food), side stretch (Exercise), notebook and pencil (Settings).

Loading: the v2 pose holds a large hourglass with both hands. The shared
`KineLoading` component shows it without visible text or animation, with a
polite accessible loading label. Home centers it while the food log loads;
Food uses it for the food log and saved foods, showing only one while both load.
Compact instances fit the water form and barcode lookup. Web startup also uses
the pose; native startup retains the existing splash until the app is ready.
There is no minimum display time, so it disappears as soon as loading ends.

Home places macro progress to Kine's left; Food and Exercise place their action
buttons there, and Settings places its title there. All four use the same equal
content/Kine split with a 12px gap and the same mascot size for a given content
width. A full-width calorie bar sits above Home's macro row. Kine stays visible
when daily records are empty; the disabled creation/view buttons do not log data.
The app uses Comfortaa and Font Awesome 6; these character images are separate
from the UI icon font.

## Loading and asset sizes

The welcome asset is 840px, supporting its 280pt onboarding display at 3×.
Other poses are 456px, supporting the 152pt onboarding display at 3×. Tab poses
scale with the shared two-column layout: `(content width - 12) / 2`, after the
screen's 12px side padding. Their maximum display is 366pt within the 768pt
screen container. The existing 456px artwork is not 3× resolution at that
largest size; review larger tablet/high-density displays before increasing the
asset budget or claiming full-size 3× sharpness.
WebP compression uses quality 80, full-quality alpha, and stripped metadata.
Actual sizes are recorded in `2d/manifest.json`.

`expo-image` loads the visible pose eagerly with high priority and keeps it in
memory and disk caches on native. After the current pose loads, the app warms the
next onboarding pose or adjacent tab poses. Prefetching never delays the screen.
The web preview uses the browser's image cache. No image crossfade delays the
existing page and greeting animations.

To rebuild optimized files from the source artwork, install ImageMagick and run:

```sh
npm run assets:mascot
```

The asset regression checks transparency, the 840px/456px dimensions, a 50 KB
limit per pose, a 200 KB limit for the original eleven poses, and a separate
20 KB startup budget for loading, for a 220 KB collection limit. Browser tests verify the loaded poses,
eager loading, and prefetching only the next pose on a cold welcome screen.
