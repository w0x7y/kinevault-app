import { Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { Tappable } from "./tappable";
import { Icon } from "./icon";
import { useReducedMotion } from "./motion";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

type SheetPageProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
  /** Accessible name of the back button, e.g. "Back to food log". */
  closeLabel?: string;
  /** Blocks closing while a save is in flight. */
  closeDisabled?: boolean;
  /** An optional action on the right of the header. */
  trailing?: ReactNode;
  /** Identifies the page on an open sheet: a new page starts at the top of the sheet. */
  page?: string | number;
  testID?: string;
  scrollRef?: Ref<ScrollView>;
}>;
type SheetHeader = Required<Pick<SheetPageProps, "title" | "closeLabel" | "closeDisabled">> &
  Pick<SheetPageProps, "trailing"> & { onClose: () => void };
/** Part of the header taken over by a page; deeper claims win. */
type HeaderClaim = { depth: number; header: Partial<SheetHeader> };
type SheetHost = {
  claimHeader: (owner: object, claim: HeaderClaim | null) => void;
  scrollView: RefObject<ScrollView | null>;
  scrollTo: (view: View) => void;
};
const SheetHostContext = createContext<SheetHost | null>(null);
// How many nested pages enclose the caller.
const SheetDepthContext = createContext(0);

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * A full page that slides up over the current tab, for flows that leave the day view: creating
 * or editing foods and workouts, scanning, importing and logging. The header's back button
 * closes it; on iOS the page is a native sheet that also closes with a downward swipe.
 *
 * A SheetPage rendered inside another one doesn't stack a second sheet: it takes over the open
 * page's header and body, so a flow can move from step to step (create, then the saved item)
 * on one page that stays up. A page that only redirects the back button uses `useSheetBack`.
 */
export function SheetPage(props: SheetPageProps) {
  const host = useContext(SheetHostContext);
  return host ? <NestedSheetPage host={host} {...props} /> : <SheetFrame {...props} />;
}

/**
 * Lets a page on a sheet rename, redirect or disable the back button, e.g. an import step going
 * back to the previous step, or a form blocking it while it saves. Unset fields keep the
 * sheet's own. Returns whether the caller is on a sheet.
 */
export function useSheetBack({
  label,
  onPress,
  disabled = false,
}: {
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const host = useContext(SheetHostContext),
    depth = useContext(SheetDepthContext);
  const press = useRef(onPress);
  useLayoutEffect(() => {
    press.current = onPress;
  });
  const redirected = onPress !== undefined;
  const header = useMemo<Partial<SheetHeader>>(
    () => ({
      closeDisabled: disabled,
      ...(label === undefined ? {} : { closeLabel: label }),
      ...(redirected ? { onClose: () => press.current?.() } : {}),
    }),
    [label, disabled, redirected],
  );
  // The back button belongs to the page that encloses the caller, over that page's own header.
  useHeaderClaim(host, depth + 0.5, header);
  return host !== null;
}

/**
 * Scrolls the sheet once the view given `ref` and `onLayout` has laid out, so it starts at the
 * top of the page, e.g. the section a page was opened for. Only the first layout scrolls.
 */
export function useSheetScrollTarget(enabled = true) {
  const host = useContext(SheetHostContext);
  const ref = useRef<View>(null),
    scrolled = useRef(false);
  return {
    ref,
    onLayout() {
      if (!enabled || !host || !ref.current || scrolled.current) return;
      scrolled.current = true;
      host.scrollTo(ref.current);
    },
  };
}

/** Claims part of the open sheet's header while the caller is mounted. */
function useHeaderClaim(host: SheetHost | null, depth: number, header: Partial<SheetHeader>) {
  const [owner] = useState(() => ({}));
  useLayoutEffect(() => {
    host?.claimHeader(owner, { depth, header });
  }, [host, owner, depth, header]);
  useLayoutEffect(() => () => host?.claimHeader(owner, null), [host, owner]);
}

function NestedSheetPage({
  host,
  title,
  onClose,
  closeLabel = "Back",
  closeDisabled = false,
  trailing,
  scrollRef,
  children,
}: SheetPageProps & { host: SheetHost }) {
  const depth = useContext(SheetDepthContext) + 1;
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  const header = useMemo<SheetHeader>(
    () => ({ title, closeLabel, closeDisabled, trailing, onClose: () => close.current() }),
    [title, closeLabel, closeDisabled, trailing],
  );
  useHeaderClaim(host, depth, header);
  // The open page's scroll view is attached after this page's layout effects, so it is
  // handed over once the commit has finished.
  useEffect(() => {
    assignRef(scrollRef, host.scrollView.current);
    return () => assignRef(scrollRef, null);
  }, [host, scrollRef]);
  return <SheetDepthContext.Provider value={depth}>{children}</SheetDepthContext.Provider>;
}

function SheetFrame({
  title: ownTitle,
  onClose: ownClose,
  closeLabel: ownLabel = "Back",
  closeDisabled: ownDisabled = false,
  trailing: ownTrailing,
  page,
  testID,
  scrollRef,
  children,
}: SheetPageProps) {
  const [claims, setClaims] = useState<ReadonlyMap<object, HeaderClaim>>(() => new Map());
  const scrollView = useRef<ScrollView | null>(null),
    content = useRef<View>(null),
    contentTop = useRef(0);
  const [host] = useState<SheetHost>(() => ({
    claimHeader(owner, claim) {
      setClaims((previous) => {
        const next = new Map(previous);
        if (claim) next.set(owner, claim);
        else next.delete(owner);
        return next;
      });
    },
    scrollView,
    scrollTo(view) {
      if (!content.current) return;
      view.measureLayout(
        content.current,
        (_x, y) => scrollView.current?.scrollTo({ y: contentTop.current + y, animated: false }),
        () => {},
      );
    },
  }));
  const { title, onClose, closeLabel, closeDisabled, trailing } = [...claims.values()]
    .sort((left, right) => left.depth - right.depth)
    .reduce<SheetHeader>((header, claim) => ({ ...header, ...claim.header }), {
      title: ownTitle,
      onClose: ownClose,
      closeLabel: ownLabel,
      closeDisabled: ownDisabled,
      trailing: ownTrailing,
    });
  // The sheet stays up while its page changes; each new page starts at the top.
  const shownPage = useRef(page);
  useLayoutEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    scrollView.current?.scrollTo({ y: 0, animated: false });
  }, [page]);
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  // iOS shows a page sheet with the system's own safe top; other platforms fill the screen.
  const pageSheet = Platform.OS === "ios";
  const close = () => {
    if (!closeDisabled) onClose();
  };
  return (
    <Modal
      visible
      animationType={reduced ? "none" : "slide"}
      presentationStyle={pageSheet ? "pageSheet" : undefined}
      accessibilityLabel={title}
      onRequestClose={close}
    >
      <SafeAreaView
        edges={pageSheet ? ["left", "right"] : ["top", "left", "right"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View testID={testID} accessibilityViewIsModal style={{ flex: 1 }}>
          {pageSheet && (
            <View aria-hidden style={[styles.grabber, { backgroundColor: colors.input }]} />
          )}
          <View style={styles.header}>
            <Tappable
              label={closeLabel}
              disabled={closeDisabled}
              onPress={close}
              style={({ pressed }) => [
                styles.back,
                { backgroundColor: pressed ? colors.accent : colors.muted },
              ]}
            >
              <Icon name="chevron-left" size={20} color={colors.primary} />
            </Tappable>
            <AppText
              variant="heading"
              accessibilityRole="header"
              numberOfLines={1}
              style={{ flex: 1, textAlign: "center" }}
            >
              {title}
            </AppText>
            <View style={styles.side}>{trailing}</View>
          </View>
          <ScrollView
            ref={(view) => {
              scrollView.current = view;
              assignRef(scrollRef, view);
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
          >
            {/* Pages measure their scroll targets against this view. */}
            <View
              ref={content}
              onLayout={(event) => {
                contentTop.current = event.nativeEvent.layout.y;
              }}
              style={styles.pages}
            >
              <SheetHostContext.Provider value={host}>{children}</SheetHostContext.Provider>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter - 6,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  side: { minWidth: 44, alignItems: "flex-end" },
  content: {
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  pages: { gap: spacing.layout },
});
