// Gives Gradle room to package a release APK.
//
// The template caps the Gradle daemon at 2 GB of heap and 512 MB of metaspace.
// With Health Connect and expo-sensors, a release build for two CPU types runs
// out of metaspace in `:app:packageRelease` and fails.
const { withGradleProperties } = require("expo/config-plugins");

const jvmargs = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

module.exports = (config) =>
  withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === "property" && item.key === "org.gradle.jvmargs",
    );
    if (existing) existing.value = jvmargs;
    else config.modResults.push({ type: "property", key: "org.gradle.jvmargs", value: jvmargs });
    return config;
  });
