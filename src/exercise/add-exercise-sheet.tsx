import { View } from "react-native";
import { AppButton } from "../components/button";
import { Icon } from "../components/icon";
import { ModalSheet } from "../components/modal-sheet";
import { Tappable } from "../components/tappable";
import { TextField } from "../components/text-field";
import { useTheme } from "../theme/provider";
import { radius } from "../theme/tokens";
import { Hairline } from "./controls";
import { AddExerciseRow } from "./library-forms";
import type { ExerciseDefinition } from "./model";

/**
 * Add exercise on a workout's edit mode: the Workout edit's library search and its results; tap
 * one to add it. With nothing to show, a + button creates the exercise instead.
 */
export function AddExerciseSheet({
  query,
  results,
  onSearch,
  onShowMore,
  onAdd,
  onCreate,
  onClose,
}: {
  query: string;
  /** None while it is closed. */
  results: { items: readonly ExerciseDefinition[]; more: boolean } | null;
  onSearch: (query: string) => void;
  onShowMore: () => void;
  onAdd: (exercise: ExerciseDefinition) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <ModalSheet
      open={results !== null}
      title="Add exercise"
      onDismiss={onClose}
      testID="add-exercise-sheet"
    >
      <TextField label="Search exercises" value={query} onChange={onSearch} />
      {results?.items.length ? (
        <View>
          {results.items.map((exercise, index) => (
            <View key={exercise.id}>
              {index > 0 && <Hairline />}
              <AddExerciseRow
                exercise={exercise}
                onPress={() => onAdd(exercise)}
                disabled={false}
              />
            </View>
          ))}
        </View>
      ) : (
        <Tappable
          testID="add-exercise-empty"
          label="Create new exercise"
          hint="No exercises match your search"
          onPress={onCreate}
          style={({ pressed }) => ({
            minHeight: 56,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.control,
            backgroundColor: pressed ? colors.accent : colors.muted,
          })}
        >
          <Icon name="plus" size={22} color={colors.primary} />
        </Tappable>
      )}
      {results?.more && (
        <AppButton size="compact" fill label="Show more exercises" onPress={onShowMore} />
      )}
      <AppButton label="Cancel" accessibilityLabel="Cancel adding an exercise" onPress={onClose} />
    </ModalSheet>
  );
}
