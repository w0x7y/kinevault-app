import assert from "node:assert/strict";
import test from "node:test";
import {
  fieldText,
  heightFields,
  heightSaved,
  heightText,
  limitText,
  measureText,
  parseUnitSystem,
  savedText,
  type Quantity,
} from "../src/units/units.ts";

test("a saved Units setting is Metric unless it says Imperial", () => {
  assert.equal(parseUnitSystem("imperial"), "imperial");
  for (const value of [null, "", "metric", "Imperial", "{broken", 1])
    assert.equal(parseUnitSystem(value), "metric");
});

// Every value an imperial field takes, up to its largest valid one, shows back as typed.
const imperialFields: [Quantity, number, number][] = [
  ["weight", 1, 220462.3],
  ["bodyWeight", 1, 1102.3],
  ["length", 1, 118.1],
  ["distance", 2, 621.37],
  ["fluid", 0, 338],
  ["food", 1, 352.7],
];
for (const [quantity, digits, largest] of imperialFields)
  test(`every ${quantity} typed in imperial shows back exactly as typed`, () => {
    const scale = 10 ** digits;
    const step = Math.max(1, Math.floor((largest * scale) / 20000));
    for (let n = 0; n <= largest * scale; n += n < 2000 ? 1 : step) {
      const typed = String(n / scale);
      assert.equal(fieldText(quantity, savedText(quantity, typed, "imperial"), "imperial"), typed);
    }
  });

test("imperial fields save the metric figure their rules expect", () => {
  assert.equal(savedText("weight", "135", "imperial"), "61.235");
  assert.equal(savedText("bodyWeight", "180.5", "imperial"), "81.87");
  assert.equal(savedText("length", "32.2", "imperial"), "81.8");
  // Distances save tens of meters, and drinks whole milliliters.
  assert.equal(savedText("distance", "3.1", "imperial"), "4990");
  assert.equal(savedText("fluid", "16", "imperial"), "473");
  assert.equal(savedText("food", "5", "imperial"), "141.75");
  // A decimal comma and a trailing point read as numbers.
  assert.equal(savedText("bodyWeight", "180,5", "imperial"), "81.87");
  assert.equal(savedText("food", "5.", "imperial"), "141.75");
});

test("more decimals than a unit takes save exactly, so they show back or fail their rule", () => {
  for (const [quantity, typed] of [
    ["weight", "2.25"],
    ["bodyWeight", "180.55"],
    ["length", "32.25"],
    ["distance", "3.125"],
    ["fluid", "16.9"],
    ["food", "5.55"],
  ] as const) {
    const saved = savedText(quantity, typed, "imperial");
    assert.equal(fieldText(quantity, saved, "imperial"), typed, quantity);
  }
  // Body weight keeps two decimals of kg, a measurement one, a distance tens of meters and a
  // drink whole milliliters, so these don't pass their rules.
  assert.doesNotMatch(savedText("bodyWeight", "180.55", "imperial"), /^\d+(\.\d{1,2})?$/);
  assert.doesNotMatch(savedText("length", "32.25", "imperial"), /^\d+(\.\d)?$/);
  assert.doesNotMatch(savedText("distance", "3.125", "imperial"), /^\d+$/);
  assert.doesNotMatch(savedText("fluid", "16.9", "imperial"), /^\d+$/);
});

test("text that isn't a number stays as typed, so validation rejects it", () => {
  for (const quantity of ["weight", "distance", "fluid", "food"] as const)
    for (const text of ["", ".", "abc", "-1", "1e3", "5 lb"]) {
      assert.equal(savedText(quantity, text, "imperial"), text, `${quantity} ${text}`);
      assert.equal(fieldText(quantity, text, "imperial"), text, `${quantity} ${text}`);
    }
});

test("values saved in Metric show in the unit's rounding", () => {
  assert.equal(fieldText("weight", "60", "imperial"), "132.3");
  assert.equal(fieldText("bodyWeight", "80", "imperial"), "176.4");
  assert.equal(fieldText("length", "81", "imperial"), "31.9");
  assert.equal(fieldText("distance", "5000", "imperial"), "3.11");
  assert.equal(fieldText("fluid", "1500", "imperial"), "51");
  assert.equal(fieldText("food", "100", "imperial"), "3.5");
});

test("Metric fields show what was saved; a distance is typed in km and saved in meters", () => {
  for (const quantity of ["weight", "bodyWeight", "length", "fluid", "food"] as const)
    for (const text of ["61.235", "70,5", "", "abc"]) {
      assert.equal(savedText(quantity, text, "metric"), text);
      assert.equal(fieldText(quantity, text, "metric"), text);
    }
  for (const [km, meters] of [
    ["5.25", "5250"],
    ["5", "5000"],
    ["5.", "5000"],
    [".5", "500"],
    [" 0.01 ", "10"],
    ["0", "0"],
    ["0.005", "5"],
    ["05.20", "5200"],
    ["12345678", "12345678000"],
    // A phone whose decimal pad shows a comma.
    ["5,25", "5250"],
    ["", ""],
    [".", "."],
    ["5.2555", "5.2555"],
    ["abc", "abc"],
    ["-1", "-1"],
    ["1e3", "1e3"],
  ] as const)
    assert.equal(savedText("distance", km, "metric"), meters, km);
  for (const [meters, km] of [
    ["5250", "5.25"],
    ["5000", "5"],
    ["500", "0.5"],
    ["5", "0.005"],
    ["0", "0"],
    ["12345678000", "12345678"],
    ["", ""],
    ["5.2555", "5.2555"],
  ] as const)
    assert.equal(fieldText("distance", meters, "metric"), km, meters);
});

test("figures read in the chosen unit", () => {
  assert.equal(measureText("weight", 1.25, "metric"), "1.25 kg");
  assert.equal(measureText("weight", 61.235, "imperial"), "135 lb");
  assert.equal(measureText("weight", 1234.5, "imperial", 0), "2,722 lb");
  assert.equal(measureText("distance", 5250, "metric"), "5.25 km");
  assert.equal(measureText("distance", 10000, "metric"), "10 km");
  assert.equal(measureText("distance", 5000, "imperial"), "3.11 mi");
  assert.equal(measureText("length", 81.3, "imperial"), "32 in");
  assert.equal(measureText("fluid", 1500, "metric"), "1,500 ml");
  assert.equal(measureText("fluid", 1500, "imperial"), "51 fl oz");
  assert.equal(measureText("food", 150, "imperial"), "5.3 oz");
});

test("limits name a figure the rule accepts", () => {
  assert.equal(limitText("bodyWeight", 1, "metric", "min"), "1");
  assert.equal(limitText("fluid", 10000, "metric", "max"), "10,000");
  assert.equal(limitText("bodyWeight", 1, "imperial", "min"), "2.3");
  assert.equal(limitText("bodyWeight", 500, "imperial", "max"), "1,102.3");
  assert.equal(limitText("length", 10, "imperial", "min"), "4");
  assert.equal(limitText("distance", 10, "imperial", "min"), "0.01");
  assert.equal(limitText("distance", 1000000, "imperial", "max"), "621.37");
  assert.equal(limitText("fluid", 1, "imperial", "min"), "1");
  assert.equal(limitText("fluid", 10000, "imperial", "max"), "338");
  assert.equal(limitText("food", 10000, "imperial", "max"), "352.7");
  // The named imperial limits save inside the metric ones.
  assert.ok(Number(savedText("bodyWeight", "1102.3", "imperial")) <= 500);
  assert.ok(Number(savedText("distance", "621.37", "imperial")) <= 1000000);
  assert.ok(Number(savedText("length", "4", "imperial")) >= 10);
});

test("height reads and is typed in feet and inches", () => {
  assert.equal(heightText(175, "metric"), "175 cm");
  assert.equal(heightText(175, "imperial"), "5 ft 8.9 in");
  assert.equal(heightText(182.88, "imperial"), "6 ft 0 in");
  assert.deepEqual(heightFields("175"), { feet: "5", inches: "8.9" });
  assert.deepEqual(heightFields(""), { feet: "", inches: "" });
  assert.deepEqual(heightFields("abc"), { feet: "", inches: "" });
  assert.equal(heightSaved({ feet: "", inches: "" }), "");
  // Inches past 12 still count; unreadable text stays readable so validation rejects it.
  assert.equal(heightSaved({ feet: "5", inches: "14" }), savedText("length", "74", "imperial"));
  assert.equal(heightSaved({ feet: "5", inches: "." }), "5 ft . in");
  for (let feet = 3; feet <= 8; feet++)
    for (let tenths = 0; tenths < 120; tenths++) {
      const fields = { feet: String(feet), inches: String(tenths / 10) };
      assert.deepEqual(heightFields(heightSaved(fields)), fields);
    }
});
