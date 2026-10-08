// Isolated Metro entry: exercises real React render and commit recovery.
import { registerRootComponent } from "expo";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AppErrorBoundary } from "../src/components/error-boundary";

let renderFailure = false;

function CrashableChild() {
  if (renderFailure) throw new Error("Private fixture health record");
  return <Text>Healthy child committed</Text>;
}

function BoundaryFixture() {
  const [version, updateVersion] = useState(0);
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Crash child"
        onPress={() => {
          renderFailure = true;
          updateVersion((value) => value + 1);
        }}
      >
        <Text>Crash child</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Allow recovery"
        onPress={() => {
          renderFailure = false;
        }}
      >
        <Text>Allow recovery</Text>
      </Pressable>
      <AppErrorBoundary>
        <CrashableChild key={version} />
      </AppErrorBoundary>
    </View>
  );
}

registerRootComponent(BoundaryFixture);
