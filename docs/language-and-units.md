# Language and units

The interface is English only, by choice (2026-10-08). Settings has no language picker.

Open Food Facts may return a product name in another language, such as Hebrew. Keep that fallback, so a product with no English name can still be imported. Don't infer the interface language from a product's language.

Hebrew support, when it comes, needs extracted message keys, translations, locale-aware numbers and dates, and right-to-left layout, tested on real devices.

## Units

Settings has a Units choice, Metric (the default) or Imperial. It's a device setting (`kinevault-track.units` in AsyncStorage, like the appearance) and never syncs.

Units convert only at display and input. Saved values stay in grams, kilograms, centimeters, meters and milliliters, so exports, sync and health saving don't change. Calorie estimates still compute from kilograms and centimeters.

| Measured value                                  | Imperial            | Shown to | Saved as                 |
| ----------------------------------------------- | ------------------- | -------- | ------------------------ |
| Set weights, volume, records, the Workout graph | lb                  | 0.1 lb   | kg to the gram           |
| Body weight                                     | lb                  | 0.1 lb   | kg to 0.01               |
| Height                                          | ft and in           | 0.1 in   | cm to 0.1                |
| Body measurements                               | in                  | 0.1 in   | cm to 0.1                |
| Cardio distance                                 | mi                  | 0.01 mi  | meters, in tens          |
| Water, drinks and the Water goal                | fl oz (US)          | 1 fl oz  | whole ml                 |
| Food logged by weight, Custom meal ingredients  | oz                  | 0.1 oz   | grams to 0.01            |
| The Plate calculator                            | 45, 35 or 15 lb bar | 2.5 lb   | the kg bar it stands for |

- Nutrients stay in grams and milligrams in both systems, as on US labels. So do a Custom food's serving weight and the per 100 g and per 100 ml nutrition bases, which are copied from labels.
- A typed value saves precisely enough to show back exactly as typed. A field shows the shortest figure that saves the same value, and a value saved in Metric shows rounded.
- Validation keeps the metric limits. Messages name them in the chosen units, rounded inward, so 1 to 500 kg reads as 2.3 to 1,102.3 lb.
- The Plate calculator keeps one bar choice. Imperial shows the kilogram bar's counterpart: 20 kg is 45 lb, 15 kg 35 lb and 10 kg 15 lb.
- `src/units/units.ts` owns every conversion and figure. Fields take a saved metric value through `TextField`'s `quantity`.
