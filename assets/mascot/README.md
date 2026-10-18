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

Home shows the morning stretch (internally `today` / `kine-today.webp`). The
Exercise tab shows the side stretch (`exercise` / `kine-exercise.webp`) on a disc
in the live workout card while a workout runs. The fruit and spoon (Food) and
notebook and pencil (Settings) poses are still bundled and prefetched after Home's
pose, but no screen shows them since the October 2026 redesign.

Loading: the v2 pose holds a large hourglass with both hands. The shared
`KineLoading` component shows it on a soft brand disc without visible text, with a
polite accessible loading label; Kine bobs slowly unless motion is reduced. Home and
Food show a compact instance in a card while the food log loads; Food also uses it
for saved foods, showing only one while both load. Compact instances fit the water
and steps forms, barcode lookup, and workout import. Web startup also uses
the pose; native startup retains the existing splash until the app is ready.
There is no minimum display time, so it disappears as soon as loading ends.

Home shows a small Kine (84–96pt) beside the greeting; onboarding and account
screens stand Kine on a soft brand-tinted disc. The app uses Comfortaa,
Manrope and Ionicons; these character images are separate from the UI icon
font.

## Loading and asset sizes

The welcome asset is 840px, sharp at 3× up to 280pt; onboarding shows it at up to
248pt (200pt on short windows) and account screens at 96–116pt. Other poses are
456px, sharp at 3× up to 152pt: onboarding stages use 108–132pt, status screens
120pt, the live workout card 132pt, loading 96–140pt, and Home's greeting 84–96pt.
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
