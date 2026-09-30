# Kine

Kine is a flat 2D blue creature with cream mitten hands, feet, and asymmetrical
head tips. The eleven page poses keep the approved Original creature's identity
and greeting motion. This is character artwork, not an app icon.

The app imports only the transparent `2d/kine-<page>.webp` files. The original
generated PNGs in `2d/source/` are high-resolution source artwork and are not bundled.
The welcome pose was converted from the original 3D Kine using the built-in
Imagegen tool. Each other pose was generated separately using the new 2D welcome
as its identity reference. Exact prompts and provenance are in `2d/prompts.json`.

Onboarding: listening (name), flag (goal), measuring tape (body), running
(activity), bowl (calories), celebration (review).
Tabs: morning stretch (Today), fruit and spoon (Food), side stretch (Exercise),
notebook and pencil (Settings).

## Loading and asset sizes

The welcome asset is 840px, and the other poses are 456px. These support the
current 280pt / 152pt display sizes at 3× without shipping oversized artwork.
WebP compression uses quality 80, full-quality alpha, and stripped metadata.
Actual sizes and the comparison with the previous 10,017,730-byte 3D collection
are recorded in `2d/manifest.json`.

`expo-image` loads the visible pose eagerly with high priority and keeps it in
memory and disk caches on native. After the current pose loads, the app warms the
next onboarding pose or adjacent tab poses. Prefetching never delays the screen.
The web preview uses the browser's image cache. No image crossfade delays the
existing page and greeting animations.

To rebuild optimized files from the source artwork, install ImageMagick and run:

```sh
npm run assets:mascot
```

The asset regression checks transparency, 3× dimensions, a 50 KB limit per pose,
and a 200 KB limit for the full collection. Browser tests verify the loaded poses,
eager loading, and prefetching only the next pose on a cold welcome screen.

The historical 3D illustration remains in `design/mascot-assets/original-v2.png`
for the standalone concept comparison. It is not imported by the app.
