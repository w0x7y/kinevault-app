import { AppText } from "../../components/ui";

/**
 * A caption that stays mounted as a polite live region, because screen readers
 * announce changes to a live region's text but often miss one that arrives
 * together with its text. Without text it leaves the layout, so it adds no gap.
 */
export function StatusLine({ text }: { text: string }) {
  return (
    <AppText
      variant="caption"
      muted
      accessibilityLiveRegion="polite"
      style={text ? undefined : { position: "absolute" }}
    >
      {text}
    </AppText>
  );
}
