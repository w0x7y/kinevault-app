# KineVault Track

KineVault Track is the food and exercise tracking companion to the separate
KineVault workout creation studio.

## Language

**Onboarding flow**: The setup journey through profile questions and review,
including returning to an edited question and resuming unfinished setup.

**Profile**: The user's saved name, age, body details, activity, weight goal,
and calorie and macro choices. A draft profile includes the last saved setup step.

**Profile edit**: Changes to a completed profile that become permanent only
when the user saves them. Cancel preserves the previously saved profile.

**Calorie mode**: Whether the profile uses the standard adult estimate or a
manual target. Ages 16–17 always follow the teen manual path.

**Estimated target**: Approximate daily calories calculated from eligible adult
body details, activity, and a lose, maintain, or gain weight goal.

**Custom target**: Daily calories entered by the user. It remains fixed when
other profile details change, until the user chooses the estimate again.
Switching an estimate-enabled profile into the age 16–17 manual path clears
the prior calorie target; an existing manual target survives age edits.

**Macro target**: Daily grams of carbs, protein, or fat. Each target can follow
the calorie target or be set independently by the user. Calculated targets use
50% carbs, 25% protein, and 25% fat. Zero remains an explicit custom value;
clearing the custom value resumes calculation.

**Selected day**: The calendar date shared by the Home, Food, and Exercise
screens for viewing daily records. A selection following Today advances when
the local date changes. Selecting another day keeps it selected even if that
date later becomes Today; selecting Today resumes daily advancement.

**Today**: The current date in the device’s local time zone.

**Exercise definition**: A reusable, locally saved exercise with a name, optional
muscle group, equipment, notes, and single-load or separate left/right tracking.

**Workout template**: A named, ordered exercise list. Sets, reps, and weights
are entered when logging the saved workout rather than prescribed by the template.

**Workout log**: A record created from a saved workout on the Selected day.
Several logs may belong to a day. A workout draft becomes active through Start
workout, or becomes completed through manual logging. The workout menu gives
access to drafts and existing logs; there is no ad hoc session creation.

**Active workout**: The sole workout with a running wall-clock timer. Its saved
start time and draft sets survive tab switches and app reopening. It remains on
its original date across midnight. Finishing requires a successful durable save.

**Completed workout**: A finished or manually logged workout's valid sets and
the exercises that have at least one set. Drafts and active workouts do not
contribute to daily totals. Editing a completed workout requires an explicit save.

**Exercise snapshot**: The exercise definition retained in a template or log.
Historical logs survive changes or deletion of their library sources.

**Development exercises**: Squat, Push-up, and Dumbbell curl seeded once in a
development build. A saved marker prevents examples from returning after deletion.
Production builds leave the exercise library untouched.

**Side set**: One set with independently entered left/right reps and kilograms.
It contributes one set and the sum of both sides' reps and lifted volume.

**Recorded duration**: Elapsed seconds measured by a workout timer, or optional
minutes entered for a manually completed workout. Missing duration is unknown.

**Profile recovery**: Returning to a usable Profile after loading fails, by
retrying the saved data or confirming a fresh start.

**Workout volume**: Total kilograms lifted across completed sets, counting
weight multiplied by repetitions for each set.

**Daily activity**: Food, workout, step, and water records for the Selected day.
Saved food contributes to that day's calorie and macro totals. Home water combines
manual water with explicit millilitres on saved Drinks entries for that date,
and displays the total in litres. Drink edits and removals change hydration
with the same food-log save. Catalog saves do not record intake or hydration.
Unavailable food or water is distinct from a known empty day or zero intake;
food totals can be known while hydration or goal progress is unavailable.
Completed workout logs contribute independently to daily totals. Exercise
storage loading or failure does not hide known food records, and Food recovery
does not hide known workout totals.

**Manual water**: The millilitres entered directly for the Selected day,
separate from saved Drinks. Editing replaces that day's manual amount; zero
clears it without changing Drinks or other days.

**Water goal**: The user's daily hydration target, initially 1,500 ml and always
set. Manual water and saved Drinks contribute together, and reaching or exceeding
the target means completed goal progress.

**Food catalog**: Foods and prepared dishes with calories, macros, and known
serving weights, available to search when choosing what to log.

**Ingredient selection**: Choosing a Catalog food with genuine gram nutrition
for a Custom meal. Food catalog selection owns saved/bundled assembly, current
saved-item identity and kind, and the logging/ingredient search purposes.
Ingredient matches exclude Custom meals; matching volume-only drinks explain
their missing gram basis. Eligible rows fill pages, and counts and clamped page
positions refer only to those rows. Bundled drinks retain their source gram
nutrition. Logging search includes foods and meals with the existing ranking
and exact/generic metadata.

**Logged food**: A chosen solid gram amount or beverage volume recorded on a specific
day, with the calories and macros for that amount. Editing its amount or meal
changes the existing entry when saved; cancel preserves it. Drinks use one whole
volume from 1 to 10,000 ml for nutrition and hydration, automatically stored in Drinks
with explicit volume measurement and a nutrition snapshot. No gram mass is inferred.

**Logging attempt**: The Selected day, add/edit target, entered amounts and label
values, and chosen Meal prepared together for preview and saving. Preparation
selects grams or volume and supplies required-label guidance. Incomplete or invalid
input cannot be submitted. Ready input uses exactly the nutrition shown, preserving
logged snapshots and the shared legacy detailed-nutrient source fallback. Drink
preparation fixes the destination to Drinks; hydration changes only after the
food-log write succeeds. Failed attempts retain the entered fields and destination.

**Meal**: Breakfast, Lunch, Dinner, Snacks, or Drinks within a day's food log.
Legacy snacks remain Snacks and have no guessed drink volume.

**Custom food**: A reusable food with a name, serving weight, calories, and
macros entered by the user, plus an optional editable brand and detailed nutrients.
Blank detailed amounts mean unknown; zero is known. Imported foods require review
and Save before becoming reusable local foods.

**Catalog draft**: Unfinished editing of a reusable Custom food or Custom meal,
including a Product import under review. The in-memory draft owner keeps editable
fields, the retained Meal destination, and separate solid/drink label bases.
Opening or resuming a session restores its destination. Food and meal creation
remain independent. Cancel discards that session; only confirmed saves retire it.
Session handles keep an older save from retiring a replacement draft. Successful
catalog deletion retires only the affected item's editor. Day changes preserve
these reusable drafts. Untouched editors are not offered as resumable drafts.

**Custom meal**: A reusable collection of foods and their amounts. Its calories
and macros begin as ingredient totals and can be overridden for the whole meal.
Detailed nutrients use optional whole-meal overrides; clearing a value restores calculation.

**Meal nutrition override**: A calorie or macro value entered for a Custom meal.
It stays fixed when ingredient amounts change until calculated nutrition is restored.

**Detailed nutrient total**: The selected day's intake of a fat subtype, fiber,
sugars, mineral, vitamin D, caffeine, or alcohol. A missing food-source value
makes that nutrient's daily total unavailable; a reported zero is known intake.

**Product import**: The journey from barcode lookup to review of an editable
Custom food draft. Interrupted lookups can be retried; reviewed edits remain
available, and a canceled or replaced lookup cannot reopen its old review.
Food has two search-row controls: offline Search and barcode Scan, with a 75/25 split.
Saved imports retain provider attribution and join offline food and ingredient
search, including formatting differences and bounded typos in eligible words.
Missing nutrition is blank. Drinks use confirmed label values per 100 ml; explicit
Drink settings or provider beverage taxonomy establish classification. Volume
packaging alone is insufficient. Solid ingredients still require real gram nutrition.
The barcode badge marks only imports made through scanning or manual barcode lookup.
Unknown scanned products can become manual foods without claiming provider provenance.

**Kine**: The app's blue original creature, who guides setup and appears on each app tab.

**Drink nutrition basis**: Calories/macros and optional nutrients per 100 ml,
from a reviewed label or actual USDA non-iced fluid-volume serving. Unknown
basis requires user entry. Bundled drinks retain source gram nutrition for meal
ingredients; volume-only custom drinks cannot claim gram nutrition. Legacy
known-ml snapshots scale directly by volume. Legacy missing ml requires entered
ml and a label basis before an edit can move the entry into Drinks.
