import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextInput, View, type TextInputProps, type TextStyle } from "react-native";
import { Icon } from "./icon";
import { InlineMessage } from "./inline-message";
import { Tappable } from "./tappable";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing, type ThemeColors } from "../theme/tokens";

type TextFieldKind = "text" | "multiline" | "decimal" | "integer" | "email" | "url" | "password";

/**
 * The text-field surface: a quiet sunken well that lifts to the card color with a brand ring
 * while focused, and turns red while invalid. TextField draws it; only the bespoke fields (the
 * set-table cell and the search box) use it directly.
 */
export function inputSurface(
  colors: ThemeColors,
  { focused = false, invalid = false }: { focused?: boolean; invalid?: boolean } = {},
): TextStyle {
  return {
    minHeight: 52,
    paddingHorizontal: spacing.card - 2,
    paddingVertical: spacing.md,
    borderRadius: radius.control,
    borderWidth: focused || invalid ? 2 : 1,
    borderColor: invalid ? colors.error : focused ? colors.ring : colors.input,
    backgroundColor: focused ? colors.card : colors.background,
    color: colors.foreground,
    fontFamily: fonts.medium,
    fontSize: 16,
    outlineWidth: 0,
    outlineStyle: "solid",
  };
}

// Keyboard hints don't restrict hardware typing or pasted text; `filter` does.
const accepts = {
  integer: /^\d*$/,
  decimal: /^\d*(?:[.,]\d*)?$/,
};

const keyboards: Record<TextFieldKind, Partial<TextInputProps>> = {
  text: {},
  multiline: { multiline: true },
  decimal: { inputMode: "decimal", keyboardType: "decimal-pad" },
  integer: { inputMode: "numeric", keyboardType: "number-pad" },
  email: {
    inputMode: "email",
    keyboardType: "email-address",
    autoComplete: "email",
    autoCapitalize: "none",
    autoCorrect: false,
  },
  url: {
    inputMode: "url",
    keyboardType: "url",
    autoComplete: "off",
    autoCapitalize: "none",
    autoCorrect: false,
  },
  password: {
    autoComplete: "current-password",
    autoCapitalize: "none",
    autoCorrect: false,
    spellCheck: false,
  },
};

const lengths: Record<TextFieldKind, number> = {
  text: 400,
  multiline: 4000,
  decimal: 32,
  integer: 32,
  email: 400,
  url: 2000,
  password: 128,
};

const contentTypes: Partial<Record<string, TextInputProps["textContentType"]>> = {
  email: "emailAddress",
  "given-name": "givenName",
  "new-password": "newPassword",
  "current-password": "password",
};

const sizes: Record<"regular" | "large" | "figure" | "hero", TextStyle> = {
  regular: {},
  large: { minHeight: 56, fontSize: 18 },
  figure: { fontFamily: fonts.bold, fontSize: 18, fontVariant: ["tabular-nums"] },
  hero: {
    minHeight: 72,
    textAlign: "center",
    fontFamily: fonts.extrabold,
    fontSize: 32,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
};

/**
 * The one text field: a label, the input on the shared surface, and the field's error under it.
 * It owns focus and the surface's focused and invalid looks, the keyboard and autofill for its
 * `kind`, a length limit, invalid semantics (`aria-invalid` plus exactly one alert for `error`),
 * the unit suffix, and focusing once it becomes editable.
 *
 * - `label` is the visible label and the accessible name; `accessibilityLabel` names the input
 *   differently (e.g. with its unit), and `labelHidden` drops the visible label where a heading or
 *   caption beside the field already names it.
 * - `error` shows under the field; `invalid` marks it invalid when its message is shown elsewhere.
 * - `filter` drops typed or pasted characters that can't be part of a `decimal` or `integer`
 *   value. Without it the owner validates the text and explains a bad value.
 * - `unit` and `trailing` (e.g. a show-password toggle) sit inside the surface; `action` (e.g. a
 *   Remove button) sits beside it.
 * - `layout="inline"` puts a short figure beside its label, e.g. a set count.
 * - `autoFocus` focuses on mount, or as soon as a field that starts disabled becomes editable.
 */
export function TextField({
  label,
  accessibilityLabel = label,
  labelHidden = false,
  labelTone = "default",
  labelColor,
  value,
  onChange,
  kind = "text",
  filter = false,
  error,
  invalid = false,
  hint,
  description,
  unit,
  trailing,
  action,
  revealable = false,
  layout = "stacked",
  size = "regular",
  disabled = false,
  autoFocus = false,
  placeholder,
  maxLength = lengths[kind],
  autoComplete,
  autoCapitalize,
  autoCorrect,
  returnKeyType = kind === "multiline" ? undefined : "done",
  onSubmit,
  testID,
}: {
  label: string;
  accessibilityLabel?: string;
  labelHidden?: boolean;
  labelTone?: "default" | "muted";
  /** Colors the label, e.g. a macro's own color. */
  labelColor?: string;
  value: string;
  onChange: (value: string) => void;
  kind?: TextFieldKind;
  filter?: boolean;
  error?: string | null;
  invalid?: boolean;
  /** Read by screen readers after the name. */
  hint?: string;
  /** Muted guidance under the input. */
  description?: string;
  unit?: string;
  trailing?: ReactNode;
  action?: ReactNode;
  /** A `password` field gets a Show/Hide password toggle inside the surface; clearing the
   * field hides the password again. */
  revealable?: boolean;
  layout?: "stacked" | "inline";
  /** `large` for setup forms, `figure` for an amount in bold figures, `hero` for one big number. */
  size?: keyof typeof sizes;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: TextInputProps["autoComplete"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  returnKeyType?: "done" | "go";
  onSubmit?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    // A password the form clears (submitted, or the form reset) hides again.
    if (!value) setRevealed(false);
  }
  const input = useRef<TextInput>(null);
  const focusPending = useRef(autoFocus);
  // Phones refuse to focus a field that isn't editable, so the platform's own autoFocus would
  // be lost while the field is disabled at mount.
  useEffect(() => {
    if (!focusPending.current || disabled) return;
    focusPending.current = false;
    input.current?.focus();
  }, [disabled]);

  const invalidNow = Boolean(error) || invalid;
  const surface = inputSurface(colors, { focused, invalid: invalidNow });
  const multiline = kind === "multiline";
  const numeric = kind === "decimal" || kind === "integer";
  const inline = layout === "inline";
  const reveal = kind === "password" && revealable;
  const adorned = Boolean(unit || trailing || reveal);
  const keyboard = keyboards[kind];
  const completes = autoComplete ?? keyboard.autoComplete;

  const field = (
    <TextInput
      ref={input}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={error ?? hint}
      aria-invalid={invalidNow}
      value={value}
      onChangeText={(text) => {
        if (filter && numeric && !accepts[kind].test(text)) return;
        onChange(text);
      }}
      editable={!disabled}
      {...keyboard}
      autoComplete={completes}
      textContentType={completes ? contentTypes[completes] : undefined}
      autoCapitalize={autoCapitalize ?? keyboard.autoCapitalize}
      autoCorrect={autoCorrect ?? keyboard.autoCorrect}
      secureTextEntry={kind === "password" && !revealed}
      maxLength={maxLength}
      selectTextOnFocus={numeric}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmit}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      selectionColor={colors.ring}
      style={[
        surface,
        sizes[size],
        { minWidth: 0 },
        multiline && { minHeight: 84, textAlignVertical: "top" },
        inline && {
          width: 84,
          minHeight: 48,
          textAlign: "center",
          fontFamily: fonts.bold,
          fontVariant: ["tabular-nums"],
        },
        adorned && { flex: 1, borderWidth: 0, backgroundColor: "transparent" },
        !adorned && action ? { flex: 1 } : undefined,
      ]}
    />
  );
  const control = adorned ? (
    <View
      style={{
        flex: action ? 1 : undefined,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderRadius: radius.control,
        borderWidth: surface.borderWidth,
        borderColor: surface.borderColor,
        backgroundColor: surface.backgroundColor,
        paddingRight: trailing || reveal ? spacing.sm : spacing.card - 2,
      }}
    >
      {field}
      {unit && (
        <AppText variant="label" muted>
          {unit}
        </AppText>
      )}
      {trailing}
      {reveal && (
        <Tappable
          label={revealed ? "Hide password" : "Show password"}
          disabled={disabled}
          onPress={() => setRevealed((shown) => !shown)}
          style={{ alignItems: "center", justifyContent: "center", borderRadius: radius.control }}
        >
          <Icon name={revealed ? "eye-slash" : "eye"} size={20} color={colors.mutedForeground} />
        </Tappable>
      )}
    </View>
  ) : (
    field
  );
  return (
    <View
      style={[
        { gap: spacing.sm, minWidth: 0 },
        inline && { flexDirection: "row", alignItems: "center", gap: spacing.md },
      ]}
    >
      {!labelHidden && (
        <AppText
          variant="label"
          muted={labelTone === "muted"}
          style={[
            labelColor ? { color: labelColor } : undefined,
            inline && { flex: 1, minWidth: 0 },
          ]}
        >
          {label}
        </AppText>
      )}
      {action ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {control}
          {action}
        </View>
      ) : (
        control
      )}
      {description && (
        <AppText variant="caption" muted>
          {description}
        </AppText>
      )}
      <InlineMessage>{error}</InlineMessage>
    </View>
  );
}
