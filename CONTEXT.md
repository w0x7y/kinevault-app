# KineVault Track

KineVault Track is the food and exercise tracking companion to the separate KineVault workout creation studio. Code and docs use the names below.

## Language

**Account**: The shared KineVault identity that signs in to Track, with email and password or Google, and owns its tracking. Signing out hides its local tracking but keeps unsent cloud saves for the next login.

**Email verification**: Confirming the email after creating an Account. Until then, onboarding answers stay on the device and tracking is locked. Resend allows three emails per address an hour, sign-up included.

**Email link**: A confirmation or password-recovery link. It completes only with a sign-in code this device requested; token-hash and session-token links are refused.

**Membership**: An Account's plan and status, set on the server. New Accounts get an active Free plan the app can't change. There are no payments.

**Account tracking**: Everything an Account saves and syncs: Profile and goals, Exercise definitions, Workout templates and logs, Custom foods and meals, Logged food, Manual water, Water goal and Logged steps. Profile media stays on the device.

**Account tracking document**: One saved part of Account tracking (Profile, Exercises, Food log, Custom foods, Water log, Water goal or Logged steps) with its own storage key. Each one syncs, and can conflict, on its own.

**Account management attempt**: An export or account deletion started in Settings. Deletion needs the password, or a Google sign-in from the last 10 minutes for a Google Account, and allows five attempts per Account an hour.

**Cloud conflict**: Different edits to one Account tracking document on two devices. The user picks the copy to keep, and both are kept until then.

**Onboarding flow**: The setup questions and review, including editing an answer and resuming unfinished setup.

**Profile**: The user's name, age, body details, activity, weight goal, and calorie and macro choices. Age is a whole number from 18 to 100; a Profile without a valid age reopens setup at the age question.

**Profile edit**: Changes to a completed Profile that apply on Save, which merges only the edited section. A failed save keeps the fields, and Cancel keeps the saved Profile.

**Personal journal**: The Profile page's Overview, Goals and Photos sections, opened from the avatar menu. It shows Today and leaves the Selected day unchanged.

**Tracking streak**: Consecutive local dates with food or drinks, positive Manual water or a Completed workout. The current streak ends today or yesterday.

**Workout graph**: Weekly volume, duration or one exercise's heaviest load over 4, 12 or 52 weeks. Weeks with no data are gaps.

**Progress photo**: An optional local image with a date and note. Progress comparison shows the earliest dated photo beside the latest.

**Profile media**: The avatar and Progress photos, stored apart from Profile answers. Old image files are deleted only after the new metadata is saved.

**Profile media edit**: Unsaved avatar or Progress photo choices. A failed save keeps them, and Cancel discards them.

**Body-weight measurement**: A dated kilogram value in the Personal journal, at most one per date. It is separate from the body weight used for calorie estimates.

**Body-weight edit**: Unsaved changes to a Body-weight measurement, or a pending delete. A failed save keeps the values.

**Calorie mode**: Whether the Profile uses the Estimated target or a Custom target.

**Estimated target**: Daily calories estimated from adult body details, activity, and a lose, maintain or gain goal.

**Custom target**: Daily calories the user enters. It stays fixed when other Profile details change.

**Macro target**: Daily grams of carbs, protein or fat, either calculated from the calorie target (50% carbs, 25% protein, 25% fat) or set by the user. Zero is a valid custom value; clearing it goes back to the calculated target.

**Selected day**: The date Home, Food and Exercise show. It follows Today until the user picks another day, and picking Today makes it follow again.

**Today**: The current date in the device's local time zone.

**Exercise definition**: A reusable, account-owned exercise with a name, optional muscle group, equipment, notes and a Tracking mode.

**Tracking mode**: How an exercise's sets are entered: Single weight, Left and right (a Side set), Alternating (an Alternating set) or Timed (a Timed set). A change applies to future logs only.

**Alternating set**: Reps per side and kilograms. Both sides count: 10 reps per side at 12 kg is 20 reps and 240 kg.

**Timed set**: Whole seconds from 1 to 86,400 instead of reps and kilograms. It counts as a set with no reps or volume.

**Set clock**: A Timed set's stopwatch, or a countdown from its seconds. Stopping it or letting it run out logs the seconds, and Save, Log, End and Cancel log it first. It isn't saved, so closing the app loses it.

**Rest timer**: A countdown between sets on the Active workout's page. It defaults to 90 seconds, − and + change it by 15 seconds between 15 seconds and 10 minutes, and it buzzes when it runs out.

**Workout template**: A named, ordered exercise list with planned set counts (three by default). Duplicate saves a copy named "Leg day copy", then "Leg day copy 2" and so on.

**Workout log**: A record made from a saved workout on the Selected day. A draft becomes active through Start workout, or completed through manual logging. There are no ad hoc sessions.

**Workout edit**: Unfinished changes to a Workout log. Planned and active fields save as drafts, and completed changes need Save. Edit mode changes that log only, never its template, but edited notes also update the Exercise definition.

**Workout template draft**: A workout being created: its name, exercises and planned counts. Saving it doesn't change existing logs.

**Library draft**: Unfinished input in an Exercise library panel. It survives leaving the tab, and only a successful save closes it.

**Exercise tab view**: What the Exercise tab shows. Compact cards stay on the day, and every other panel, the Active workout included, opens as a page over it.

**Active workout**: The one workout with a running timer. It needs a name, survives app restarts, stays on its start date past midnight, and ends only after a successful save.

**Live workout card**: Replaces the day's cards on the Exercise tab while a workout is active, showing Kine working out and Open workout.

**Completed workout**: A finished or manually logged workout. Untouched blank sets are skipped, partly entered sets must be valid, and only completed workouts count toward daily totals.

**Previous sets**: The sets from the latest Completed workout with the same exercise, shown as hints in blank fields. Hints are never saved unless the user presses the set's number to copy them in.

**Exercise snapshot**: The copy of an exercise kept in a template or log, so history survives library edits and deletions.

**Demo link**: An exercise's optional link to a published KineVault exercise. Linking fills only a blank name, muscle group and equipment.

**Exercise demo**: A linked exercise's muted KineVault clip, shown as a poster until tapped. The public demo list refreshes when it is 24 hours old and works offline.

**Development exercises**: Squat, Push-up and Dumbbell curl, seeded once in a development preview with no Account. Signed-in Accounts and production builds never get them.

**Side set**: One set with separate left and right reps and kilograms. It counts as one set, and both sides add to reps and volume.

**RIR**: Reps in reserve, an optional 0 to 10 per set (per side for a Side set, none for a Timed set). It doesn't count toward volume or totals.

**Recorded duration**: Seconds from a workout timer, or minutes typed for a workout that isn't running. Blank means unknown.

**Profile recovery**: Getting a usable Profile back after loading fails, by retrying or starting fresh.

**Workout volume**: Kilograms times reps, summed over completed sets.

**Estimated one-rep max**: Epley's formula, kilograms × (1 + reps ÷ 30), or the weight itself for one rep.

**Personal record**: An exercise whose best Estimated one-rep max beats every earlier Completed workout with the same Exercise definition and Tracking mode. First workouts, ties, bodyweight lifts and Timed sets never count. Records are computed from logs, never stored.

**Daily activity**: The Selected day's food, workout, step and water records. Water is Manual water plus saved Drinks. Unavailable data is distinct from a known empty day.

**Phone steps**: Steps the phone counted, from Core Motion on iOS (last 7 days) or Health Connect on Android. They need permission and a native build, and are never stored or uploaded.

**Logged steps**: Steps entered by hand for a day, added to Phone steps. They are an Account tracking document, so they sync.

**Manual water**: Milliliters entered directly for a day, separate from Drinks. Zero clears it.

**Water goal**: The daily hydration target, 1,500 ml by default. Manual water and Drinks both count toward it.

**Document edit**: A draft of one saved document (Manual water, Logged steps, Water goal or a Profile section). Save validates against the latest saved version.

**Food catalog**: Foods and dishes with calories, macros and serving weights, searchable when logging.

**Ingredient selection**: Choosing a Catalog food with real gram nutrition as a Custom meal ingredient. Custom meals and volume-only drinks can't be picked.

**Logged food**: A gram amount or drink volume on one day, with its calories and macros. A drink is 1 to 10,000 whole ml, goes to Drinks, and never gets guessed grams.

**Logging attempt**: The day, entry, amounts and Meal being prepared for saving. Servings save as grams, the save uses exactly the nutrition shown, and a failed save keeps the fields.

**Meal**: Breakfast, Lunch, Dinner, Snacks or Drinks. Old snack entries stay in Snacks.

**Meal destination**: The Meal a new Logging attempt adds to. Returning to the food log resets it to Breakfast.

**Custom food**: A food the user enters, with a name, serving weight, calories and macros, plus an optional brand and detailed nutrients. Blank means unknown and zero is known.

**Catalog draft**: Unfinished editing of a Custom food or Custom meal, including a Product import. Cancel discards it, and only a confirmed save closes it.

**Food tab view**: What the Food tab shows over its log (search, details, editors, a Product import or Daily macros) and how it changes with the day, saving or leaving the tab.

**Custom meal**: A reusable set of foods and amounts. Its nutrition is the ingredient total unless overridden for the whole meal.

**Meal nutrition override**: A calorie or macro value entered for a Custom meal. It stays fixed until the user restores the calculated value.

**Detailed nutrient total**: The day's intake of a fat subtype, fiber, sugars, a mineral, vitamin D, caffeine or alcohol. One missing source value makes the total unavailable.

**Product import**: A barcode lookup that becomes an editable Custom food draft for review. Missing nutrition stays blank, drinks need label values per 100 ml, and volume packaging alone doesn't make a product a drink. Saved imports keep provider attribution.

**Kine**: The app's blue creature. He guides setup, greets on Home and appears in loading states.

**Drink nutrition basis**: Nutrition per 100 ml, from a reviewed label or a real USDA non-iced fluid serving. Volume-only custom drinks have no gram nutrition, and an old entry without ml needs ml and a label basis before it moves to Drinks.

**Reminder**: A device notification at a chosen time and weekdays for a weigh-in, water, a workout, food logging, a Progress photo or a custom note. Reminders are device settings, not Account tracking: sign-out cancels them and sign-in restores them.

**Workout import**: Saving a workout shared as a Tracked link as a Workout template, after a preview. Exercises reuse definitions with the same name, and importing the same link again replaces that template.
