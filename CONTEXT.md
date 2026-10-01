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

**Completed workout**: The completed sets in a session and the exercises that
have at least one completed set. Planned sets do not count toward its totals.

**Profile recovery**: Returning to a usable Profile after loading fails, by
retrying the saved data or confirming a fresh start.

**Workout volume**: Total kilograms lifted across completed sets, counting
weight multiplied by repetitions for each set.

**Daily activity**: Food, workout, step, and water records for the Selected day.
Saved food contributes to that day's calorie and macro totals.

**Food catalog**: Foods and prepared dishes with calories, macros, and known
serving weights, available to search when choosing what to log.

**Logged food**: A chosen food and gram amount recorded in a meal on a specific
day, with the calories and macros for that amount. Editing its amount or meal
changes the existing entry when saved; cancel preserves it.

**Meal**: Breakfast, Lunch, Dinner, or Snacks / Drinks within a day's food log.

**Detailed nutrient total**: The selected day's intake of a fat subtype, fiber,
sugars, mineral, vitamin D, caffeine, or alcohol. A missing food-source value
makes that nutrient's daily total unavailable; a reported zero is known intake.

**Kine**: The app's blue original creature, who guides setup and appears on each app tab.
