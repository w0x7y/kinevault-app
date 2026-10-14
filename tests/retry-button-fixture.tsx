// Isolated Metro entry: a RetryButton whose retry rejects when the test says so.
import { registerRootComponent } from "expo";
import { useState } from "react";
import { Text, View } from "react-native";
import { RetryButton } from "../src/exercise/demo/retry-button";
import { ThemeProvider } from "../src/theme/provider";

const control = globalThis as unknown as { failPendingRetry?: () => void };

function RetryFixture() {
  const [attempts, setAttempts] = useState(0);
  return (
    <ThemeProvider>
      <View>
        <Text>{`Retries started: ${attempts}`}</Text>
        <RetryButton
          accessibilityLabel="Retry fixture"
          onRetry={() => {
            setAttempts((value) => value + 1);
            return new Promise<void>((_, reject) => {
              control.failPendingRetry = () => reject(new Error("Fixture retry failed"));
            });
          }}
        />
      </View>
    </ThemeProvider>
  );
}

registerRootComponent(RetryFixture);
