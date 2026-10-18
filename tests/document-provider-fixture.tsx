// Isolated Metro entry: a document provider whose parent re-renders while the document stays put.
import { registerRootComponent } from "expo";
import { memo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { AccountStorage } from "../src/account/storage";
import { AccountStorageProvider } from "../src/account/storage-context";
import { createDocumentProvider } from "../src/persistence/document-provider";

let snapshot = { count: 0 };
const listeners = new Set<() => void>();
const fixture = createDocumentProvider({
  name: "FixtureProvider",
  create: () => ({
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start() {},
    stop() {},
    retryLoad() {},
  }),
});

// Memoized like a screen behind its navigator, so only the document's value re-renders it.
const Reader = memo(function Reader() {
  const { count } = fixture.useDocument();
  const renders = useRef(0);
  renders.current += 1;
  return <Text testID="reader">{`Count ${count}, reader render ${renders.current}`}</Text>;
});

function ProviderFixture() {
  const [parentRenders, setParentRenders] = useState(0);
  return (
    <AccountStorageProvider storage={{} as AccountStorage}>
      <View>
        <Text>{`Parent renders: ${parentRenders}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Re-render parent"
          onPress={() => setParentRenders((value) => value + 1)}
        >
          <Text>Re-render parent</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change document"
          onPress={() => {
            snapshot = { count: snapshot.count + 1 };
            for (const listener of listeners) listener();
          }}
        >
          <Text>Change document</Text>
        </Pressable>
        <fixture.Provider>
          <Reader />
        </fixture.Provider>
      </View>
    </AccountStorageProvider>
  );
}

registerRootComponent(ProviderFixture);
