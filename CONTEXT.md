# KineVault Track

KineVault Track is the food and exercise tracking companion to the separate
KineVault workout creation studio.

## Language

**Account**: The shared KineVault identity used to enter Track and own its saved
tracking. Each application keeps its own sign-in session. Track signs in with email
and password or with Google. Signing out hides that account's local tracking while
retaining unfinished cloud saves for its next login.

**Email verification**: Confirming the email address after creating an Account.
Until verification or a confirmed sign-in succeeds, onboarding answers remain on
the device and the user cannot enter tracking. The next step is presented with
the submitted email address and instructions to verify it and log in. Resend sends
another confirmation, up to three per address in a rolling hour on this device, sign-up
included. Signing up with an email that already has a confirmed Account sends nothing
and says to log in instead.

**Email link**: A confirmation or password-recovery link from an Account email. Only a
link carrying a sign-in code that this device requested completes; token-hash and
session-token links are refused, since anyone could take one from their own email.

**Membership**: An Account's plan and current status. New Accounts start with an
active Free membership. Track shows the assigned membership; users cannot change
their membership through client-side tracking edits. Payments are outside this version.

**Account tracking**: The Account's Profile and goals, Exercise definitions,
Workout templates and logs, Custom foods and meals, Logged food, Manual water,
Water goal and Logged steps. Completed-workout summaries and journal stats derive
from these saved records. Profile media remains private to the device.

**Account tracking document**: One saved part of Account tracking (Profile,
Exercises, Food log, Custom foods, Water log, Water goal or Logged steps) with its
own storage key and Settings name. Each document syncs, and can have a Cloud
conflict, on its own.

**Account management attempt**: An Account’s request to export tracking or
confirm permanent deletion, with feedback belonging to the Settings view that
started it. Deletion is confirmed with the password, or with a Google sign-in from the
last 10 minutes for an Account created with Google, and is limited to five attempts
per Account an hour. Confirmed deletion belongs to the Account even after that view
leaves.

**Cloud conflict**: Different saved tracking changes on two devices that cannot
be applied without replacing one copy. The user chooses the device or cloud copy
for the affected Account tracking document; both copies are retained until that choice.

**Onboarding flow**: The setup journey through profile questions and review,
including returning to an edited question and resuming unfinished setup. Leaving
the route during a save cannot trigger late navigation or feedback on return.

**Profile**: The user's saved name, age, body details, activity, weight goal,
and calorie and macro choices. A draft profile includes the last saved setup step.
Age is a whole number from 18 to 100. A completed Profile without a qualifying age,
such as one saved at 16 or 17 under the old rule, reopens setup at the age question
and keeps its other answers.

**Profile edit**: Changes to a completed profile that become permanent only
when the user saves them. Each edit retains its own fields after failure, merges
only its chosen section into the latest Profile on Save, and cannot close a newer
edit when an earlier save finishes; Cancel preserves the saved Profile.

**Personal journal**: The Profile page's Overview, Goals, and Photos sections.
It opens from the avatar menu, uses Today, and preserves the Selected day when
returning to the originating tab. A section edit merges only its owned fields
into the current saved Profile.

**Tracking streak**: Consecutive local dates with saved food/drinks, positive
Manual water, or a Completed workout. A date counts once. The current streak
ends today or yesterday; the longest includes all qualifying dates through
today. Edits/deletions recalculate both and future records are excluded.

**Workout graph**: Weekly completed volume, known duration, or a selected
exercise's heaviest positive recorded load over 4, 12, or 52 weeks. Weeks without
measurements remain gaps; unknown durations remain unknown or partial. Historical
exercise identity and tracking mode keep separate left/right history intact.

**Progress photo**: An optional local image with an editable date and note.
It does not count toward a streak; the dated journal scrolls horizontally, and
Progress comparison shows the earliest dated photo beside the latest.

**Profile media**: The avatar and Progress photos, stored separately from
Profile answers. Metadata publishes after durable image import. Replacement
or deletion publishes metadata before removing the old owned image files.

**Profile media edit**: Unsaved avatar or Progress photo choices, including a
chosen image and the photo's date and note. Failed saves retain these choices for
retry, Cancel discards them, and an earlier operation cannot change a newer edit.
Save feedback belongs to that edit; a new edit does not inherit an older failure.

**Body-weight measurement**: A dated kilogram value in the Personal journal,
independent of the body weight used for calorie estimates. Each date has at most
one measurement; saving to an occupied date replaces that measurement.

**Body-weight edit**: Unsaved changes to a Body-weight measurement, or a pending
confirmation to delete it. Failed saves retain entered values for retry; leaving
the journal discards the edit without undoing a completed measurement save.

**Calorie mode**: Whether the profile uses the standard adult estimate or a
manual target.

**Estimated target**: Approximate daily calories calculated from eligible adult
body details, activity, and a lose, maintain, or gain weight goal.

**Custom target**: Daily calories entered by the user. It remains fixed when
other profile details change, until the user chooses the estimate again.

**Macro target**: Daily grams of carbs, protein, or fat. Each target can follow
the calorie target or be set independently by the user. Calculated targets use
50% carbs, 25% protein, and 25% fat. Zero remains an explicit custom value;
clearing the custom value resumes calculation.

**Selected day**: The calendar date shared by the Home, Food, and Exercise
screens for viewing daily records. A selection following Today advances when
the local date changes. Selecting another day keeps it selected even if that
date later becomes Today; selecting Today resumes daily advancement.

**Today**: The current date in the device’s local time zone.

**Exercise definition**: A reusable, account-owned exercise with a name, optional
muscle group, equipment, notes, and a Tracking mode.

**Tracking mode**: How an Exercise definition's sets are entered: Single weight (reps
and kilograms), Left and right (a Side set), Alternating (an Alternating set) or Timed
(a Timed set). Every set has its exercise's mode. Changing the mode applies to future
workout logs; earlier logs keep the mode they were logged in.

**Alternating set**: One line of reps per side and kilograms, for exercises that
alternate sides. Its reps and lifted volume count both sides: 10 reps per side at 12 kg
is 20 reps and 240 kg.

**Timed set**: Whole seconds, from 1 to 86,400, instead of reps and kilograms, for
stretches and holds. It counts as a set with no reps or volume, and the Workout graph
has no weight to draw for it.

**Set clock**: A Timed set's running clock in a Workout edit. Started on a blank set it
is a stopwatch; started on a set with 1 to 86,400 whole seconds it counts down from
them (any other entry also runs a stopwatch). Stopping logs
the seconds it ran, and a countdown that runs out logs its seconds. Each Workout log runs
one clock at a time: starting another in the same log logs the first, and other logs keep
theirs. It keeps running while another exercise shows
or the workout's page is away (a countdown that runs out still logs and buzzes), and
Save, Log, End and Cancel log it first. It is not
saved, so closing the app loses it.

**Workout template**: A named, ordered exercise list with optional planned set
counts per exercise. Reps, weights and optional RIR are entered while logging. New templates
default to three sets per exercise; legacy templates retain their existing data.

**Workout log**: A record created from a saved workout on the Selected day.
Several logs may belong to a day. A workout draft becomes active through Start
workout, or becomes completed through manual logging. The Saved workouts menu gives
access to drafts and existing logs; there is no ad hoc session creation.
Selected drafts display compact workout cards. Start expands a card into the
scrolling exercise bar above the selected-exercise detail; manual logging remains available.
Workout settings on a compact draft can change planned counts before Start; they open on
the day itself. A card opened on its own from Saved workouts shows a Close workout
control that returns to the day.

**Workout edit**: Unfinished changes to a workout log. Planned and active fields
are saved as drafts; completed changes require explicit Save. Failed saves retain
the entered fields. Leaving for another panel preserves completed changes, while
Cancel discards them. Edit mode (the pencil) puts add and remove buttons beside each set
and lets the exercise bar remove (after a confirmation), reorder and add exercises; these
change only that log, never its Workout template. In edit mode an exercise's notes become
a field, and saving gives them to the Exercise definition too, so later workouts show them;
other saved logs keep their copy. The selected exercise row, a compact card's planned-set
settings, open notes, an open Details section, edit mode, Add exercise's search and a
pending removal belong to the edit, so a remounted editor keeps them.

**Workout template draft**: The name, ordered Exercise definitions and planned
counts being prepared for a reusable workout. A newly selected exercise defaults
to three sets; removing and re-adding it retains its entered count. The draft
checks only planned counts; the save command gives the reason for a blank or too-long
name or a missing exercise. Saving a template draft does not change existing workout logs.

**Library draft**: Unfinished input in an Exercise library panel: an Exercise
definition edit, a Workout template draft, Saved workouts actions or a Workout
import. It belongs to the panel that opened it and survives leaving the tab. Only a
durable success closes that panel, and a replaced panel's late result cannot close
a newer one.

**Exercise tab view**: Where the Exercise tab shows each Workout log and library
panel. Compact cards stay on the day; every other panel, the Active workout's
included, opens as a page over it with its own back control. While a workout is
active, the default view shows a Live workout card in place of the day's cards.

**Active workout**: The sole workout with a running wall-clock timer. Its name
must be nonblank before Start; an unnamed draft remains editable. Its saved
start time and draft sets survive tab switches and app reopening. It remains on
its original date across midnight. End workout requires a successful durable save.
The active editor retains local fields across searches and calendar changes.
It opens as a full page whose top bar centers the elapsed time; Start from a day
card opens that page, and Start from the manual page keeps it up. Its back
control saves the draft sets and leaves the workout running, and stays on the page
if that save fails. While it runs, the app header centers the same timer on every
tab and opens the page when tapped.

**Live workout card**: The Exercise tab's stand-in for the day's cards and the
Import button while a workout is active: Kine working out, the workout name, and
Open workout. It shows on the default view only, whatever the Selected day.

**Completed workout**: A finished or manually logged workout's valid sets and
the exercises that have at least one logged set. Untouched blank sets are skipped
on completion; partially entered sets require valid measurements. Drafts and active workouts do not
contribute to daily totals. Editing a completed workout requires an explicit save.
Template and completed editing share the active layout's exercise bar and detail;
a template's name and exercises are under Exercises, a completed workout's name
and duration under Details.

**Previous sets**: The sets of the latest Completed workout, on or before the
log's date, that includes the same Exercise definition. A blank set field shows
the matching previous set's value (reps, kilograms, RIR or seconds) as a hint; a set
past the previous ones shows none. Hints are never saved as entered values unless the
set's number is pressed, which copies its line's hints into the blank fields.

**Exercise snapshot**: The exercise definition retained in a template or log.
Historical logs survive changes or deletion of their library sources.

**Demo link**: An Exercise definition's optional reference to a published KineVault
exercise, chosen in the exercise form. Linking fills only blank name, muscle group
and equipment fields. Templates and logs show the library definition's current link,
or their saved copy's link when the library exercise was deleted.

**Exercise demo**: A linked exercise's muted KineVault clip, shown as a poster until
tapped, with its credit; leaving the screen returns it to the poster. A withdrawn
KineVault exercise shows "Demonstration unavailable." The demo list is public device
data. Track refreshes it once the saved copy is 24 hours old or older or empty, uses the saved copy when offline, and keeps it across
sign-out.

**Development exercises**: Squat, Push-up, and Dumbbell curl seeded once in a
development preview without an Account. A saved marker prevents examples from
returning after deletion. Signed-in Accounts and production builds leave the
exercise library untouched.

**Side set**: One set with independently entered left/right reps and kilograms.
It contributes one set and the sum of both sides' reps and lifted volume.

**RIR**: Reps in reserve, an optional whole number from 0 to 10 entered beside a set's
reps and weight (one per side for a Side set; Timed sets have none). It needs the set's
reps and doesn't count toward volume or totals.

**Recorded duration**: Elapsed seconds measured by a workout timer, or optional
minutes typed for a workout that isn't running. Blank or missing duration is unknown.

**Profile recovery**: Returning to a usable Profile after loading fails, by
retrying the saved data or confirming a fresh start.

**Workout volume**: Total kilograms lifted across completed sets, counting
weight multiplied by repetitions for each set.

**Daily activity**: Food, workout, step, and water records for the Selected day.
Saved food contributes to that day's calorie and macro totals. Home water combines
manual water with explicit milliliters on saved Drinks entries for that date,
and displays the total in litres. Drink edits and removals change hydration
with the same food-log save. Catalog saves do not record intake or hydration.
Unavailable food or water is distinct from a known empty day or zero intake;
food totals can be known while hydration or goal progress is unavailable.
Completed workout logs contribute independently to daily totals. Exercise
storage loading or failure does not hide known food records, and Food recovery
does not hide known workout totals.

**Phone steps**: The steps the phone counted on the Selected day: Core Motion on
iOS, which keeps the last 7 days, and Health Connect on Android. Reading them
needs the user's permission and a native build; the web preview and Expo Go on
Android have none. They are read on the device and never uploaded.

**Logged steps**: Steps entered by hand for the Selected day, for walking the phone
missed. They add to Phone steps for the day's total. Editing replaces that day's
amount; zero clears it. They are an Account tracking document, so they sync to the
Account like the Water log and are in the account export. Phone steps are never
stored or uploaded.

**Manual water**: The milliliters entered directly for the Selected day,
separate from saved Drinks. Editing replaces that day's manual amount; zero
clears it without changing Drinks or other days.

**Water goal**: The user's daily hydration target, initially 1,500 ml and always
set. Manual water and saved Drinks contribute together, and reaching or exceeding
the target means completed goal progress. An entered replacement remains a draft
until Save; another device's goal update does not overwrite that entered amount.

**Document edit**: An entered draft of one durable document (Manual water, Logged steps,
Water goal, a Profile section) with its own save feedback. Its untouched draft comes from
the saved document, either once or following saved replacements until the user
types; Save validates against the latest saved document. A closed edit's late
result never reaches a newer edit.

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
selects grams or volume and supplies required-label guidance. Adding a gram-measured
food with a serving size can count Servings instead of Weight: the count times the
chosen serving, saved as grams. Incomplete or invalid
input cannot be submitted. Ready input uses exactly the nutrition shown, preserving
logged snapshots and the shared legacy detailed-nutrient source fallback. Drink
preparation fixes the destination to Drinks; hydration changes only after the
food-log write succeeds. Failed attempts retain the entered fields and destination.
Only the attempt's own save shows as saving; a food-log refresh doesn't block
logging, and a save started during one waits for it.

**Meal**: Breakfast, Lunch, Dinner, Snacks, or Drinks within a day's food log.
Legacy snacks remain Snacks and have no guessed drink volume.

**Meal destination**: The Meal a new Logging attempt adds to. Choosing a meal
while adding moves it; each Catalog draft captures it when opened and restores it
when reopened; returning to the food log resets it to Breakfast.

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
The draft owner handles validation, save feedback and retirement together. Changes
made during a pending save stay available even when the earlier version succeeds.

**Food tab view**: What the Food tab shows over its food log (search results, a
food's details, its catalog editor, a creation, a resumed draft, a Product import,
Daily macros) and how a day change, leaving the tab, saving or deleting changes it.
Pages keep their state while the tab is away.

**Custom meal**: A reusable collection of foods and their amounts. Its calories
and macros begin as ingredient totals and can be overridden for the whole meal.
Detailed nutrients use optional whole-meal overrides; clearing a value restores calculation.
The preview sums the ingredients with valid amounts and skips one still being typed.

**Meal nutrition override**: A calorie or macro value entered for a Custom meal.
It stays fixed when ingredient amounts change until calculated nutrition is restored.

**Detailed nutrient total**: The selected day's intake of a fat subtype, fiber,
sugars, mineral, vitamin D, caffeine, or alcohol. A missing food-source value
makes that nutrient's daily total unavailable; a reported zero is known intake.

**Product import**: The journey from barcode lookup to review of an editable
Custom food draft. Interrupted lookups can be retried; reviewed edits remain
available, and a canceled or replaced lookup cannot reopen its old review.
Saved imports retain provider attribution and join offline food and ingredient
search, including formatting differences and bounded typos in eligible words.
Missing nutrition is blank. Drinks use confirmed label values per 100 ml; explicit
Drink settings or provider beverage taxonomy establish classification. Volume
packaging alone is insufficient. Solid ingredients still require real gram nutrition.
The barcode badge marks only imports made through scanning or manual barcode lookup.
Unknown scanned products can become manual foods without claiming provider provenance.

**Kine**: The app's blue original creature, who guides setup, greets on Home and
appears in loading states.

**Drink nutrition basis**: Calories/macros and optional nutrients per 100 ml,
from a reviewed label or actual USDA non-iced fluid-volume serving. Unknown
basis requires user entry. Bundled drinks retain source gram nutrition for meal
ingredients; volume-only custom drinks cannot claim gram nutrition. Legacy
known-ml snapshots scale directly by volume. Legacy missing ml requires entered
ml and a label basis before an edit can move the entry into Drinks.

**Reminder**: A device notification at a chosen local time on selected weekdays
that prompts a weigh-in, water, a workout, food logging, a Progress photo, or a
custom note. Weigh-in, water, workout, and food reminders always exist and start
off; others can be added and deleted. Reminders are device settings for the
signed-in Account, not Account tracking: signing out cancels them and signing in
restores them. Turning one on asks for notification permission; a refusal keeps
it saved but off. Tapping a reminder opens its related screen.

**Workout import**: Adding a workout plan shared from another app as a Workout
template. Tracked is the first source: a pasted share link is downloaded by the
iOS or Android app, or through KineVault's server on the web, and previewed
before saving. Exercises reuse Exercise definitions with
the same name; others become new definitions with the shared prescription as notes.
Importing the same link again replaces that template; workout logs are unchanged.
