import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = join(root, "assets/branding");
const icon = join(directory, "source/kine-icon.png");
const head = join(directory, "source/kine-head.png");
const welcome = join(root, "assets/mascot/2d/source/kine-welcome.png");
const font = join(root, "node_modules/@expo-google-fonts/comfortaa/700Bold/Comfortaa_700Bold.ttf");
const output = (name) => join(directory, name);

function image(args, name) {
  const result = spawnSync("magick", [...args, "-depth", "8", "-strip", output(name)], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr.trim());
  console.log(name);
}

// Store icons stay opaque; the OS supplies its own corner mask.
image([icon, "-resize", "1024x1024!", "-alpha", "off", "-define", "png:color-type=2"], "icon.png");
image([icon, "-resize", "48x48!", "-alpha", "off"], "favicon.png");

// This rounded head's visible pixels fit inside Android's 66/108 safe circle.
// Keep the same inset for both adaptive layers so launcher masks never clip Kine.
image(
  [
    head,
    "-trim",
    "+repage",
    "-resize",
    "580x580",
    "-background",
    "none",
    "-gravity",
    "center",
    "-extent",
    "1024x1024",
  ],
  "adaptive-foreground.png",
);
image(
  [
    output("adaptive-foreground.png"),
    "-colorspace",
    "gray",
    "-threshold",
    "28%",
    "-background",
    "black",
    "-alpha",
    "remove",
    "-alpha",
    "off",
    "-alpha",
    "copy",
    "-fill",
    "white",
    "-colorize",
    "100",
  ],
  "adaptive-monochrome.png",
);

// Android's launch API supplies a square icon container. A head mark fits there
// better than the tall iOS mascot/wordmark, and avoids clipping the lettering.
image(
  [
    head,
    "-trim",
    "+repage",
    "-resize",
    "600x600",
    "-background",
    "none",
    "-gravity",
    "center",
    "-extent",
    "720x720",
  ],
  "splash-android.png",
);

for (const [appearance, color] of [
  ["light", "#192f43"],
  ["dark", "#f8f2e3"],
]) {
  // Expo creates a square native image view; export a square lockup to match it.
  image(
    [
      "-size",
      "720x720",
      "canvas:none",
      "(",
      welcome,
      "-trim",
      "+repage",
      "-resize",
      "530x510",
      ")",
      "-gravity",
      "north",
      "-geometry",
      "+0+24",
      "-composite",
      "(",
      "-background",
      "none",
      "-fill",
      color,
      "-font",
      font,
      "-pointsize",
      "88",
      "label:KineVault",
      "-trim",
      "+repage",
      "-resize",
      "650x100",
      ")",
      "-gravity",
      "north",
      "-geometry",
      "+0+566",
      "-composite",
      "(",
      "-background",
      "none",
      "-fill",
      color,
      "-font",
      font,
      "-pointsize",
      "28",
      "-kerning",
      "8",
      "label:TRACK",
      "-trim",
      "+repage",
      ")",
      "-gravity",
      "north",
      "-geometry",
      "+0+680",
      "-composite",
    ],
    `splash-${appearance}.png`,
  );
}
