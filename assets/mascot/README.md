# Kine

Kine is a flat 2D blue creature with cream mitten hands, feet and asymmetrical head tips. These full-body poses are for app screens. The launcher icon and splash have their own art in [`../branding/`](../branding/README.md).

The app imports only the transparent `2d/kine-*.webp` files. `2d/source/` holds the high-resolution source PNGs, which aren't bundled. Prompts and provenance are in `2d/prompts.json`, and actual sizes in `2d/manifest.json`.

## Poses

| File                 | Pose                      | Where                             | Size                                                     |
| -------------------- | ------------------------- | --------------------------------- | -------------------------------------------------------- |
| `kine-welcome.webp`  | Waving                    | Onboarding start, account screens | Up to 248pt, 200pt on short windows; account 96 to 116pt |
| `kine-goal.webp`     | Flag                      | Onboarding: goal                  | 108 to 132pt                                             |
| `kine-body.webp`     | Measuring tape            | Onboarding: age and body          | 108 to 132pt                                             |
| `kine-name.webp`     | Listening                 | Onboarding: name                  | 108 to 132pt                                             |
| `kine-activity.webp` | Running                   | Onboarding: activity              | 108 to 132pt                                             |
| `kine-calories.webp` | Bowl                      | Onboarding: calories              | 108 to 132pt                                             |
| `kine-review.webp`   | Celebration               | Onboarding: review                | 108 to 132pt                                             |
| `kine-today.webp`    | Morning stretch           | Home greeting                     | 84 to 96pt                                               |
| `kine-exercise.webp` | Side stretch              | Live workout card on Exercise     | 132pt                                                    |
| `kine-loading.webp`  | Holding a large hourglass | `KineLoading`                     | 96 to 140pt                                              |
| `kine-food.webp`     | Fruit and spoon           | Bundled and prefetched, not shown |                                                          |
| `kine-settings.webp` | Notebook and pencil       | Bundled and prefetched, not shown |                                                          |

Status screens show poses at 120pt. The welcome file is 840px, sharp at 3× up to 280pt. The others are 456px, sharp up to 152pt.

`KineLoading` shows the loading pose on a soft brand disc with no visible text and a polite loading label. Web startup uses it; native startup keeps the splash until the app is ready.

`expo-image` loads the visible pose first and caches it on native. Once it loads, the app prefetches the next onboarding pose or the nearby tab poses.

## Rebuild

Install ImageMagick, then run from `Application/`:

```sh
npm run assets:mascot
```

It writes WebP at quality 80 with full-quality alpha and no metadata. The asset test checks transparency, the 840px and 456px sizes, 50 KB per pose, 200 KB for the eleven original poses, 20 KB for the loading pose, and 220 KB in total.
