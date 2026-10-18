import { ButtonRow, AppButton } from "../components/button";
import { AppText } from "../components/ui";
import { EditorSection } from "./journal-ui";
import { Question } from "../onboarding/steps";
import { InlineMessage } from "../components/inline-message";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { createFocusedProfileEdit, focusedEditFeedback } from "./focused-editing";
import { useProfilePersistence } from "./provider";
import type { ProfileEditSection } from "./section-editing";
// Each open editor owns its edit; the parent keys it so a new section starts fresh.
export function ProfileEditor({
  section,
  close,
}: {
  section: ProfileEditSection;
  close: () => void;
}) {
  const profile = useProfilePersistence();
  const { edit, draft, error, busy, saving } = useDocumentEdit(() =>
    createFocusedProfileEdit(profile, section),
  );
  const { errors, others, message: failure } = focusedEditFeedback(error, section);
  return (
    <EditorSection testID="profile-editor">
      <AppText variant="heading" accessibilityRole="header">
        Edit {section}
      </AppText>
      <Question
        step={section}
        answers={draft}
        disabled={busy}
        errors={errors}
        edit={() => {}}
        update={(change) => {
          edit.change(change);
        }}
      />
      {others.map((message) => (
        <InlineMessage key={message}>{message}</InlineMessage>
      ))}
      {failure && <InlineMessage>{failure}</InlineMessage>}
      <ButtonRow>
        <AppButton
          fill
          label="Cancel"
          disabled={busy}
          onPress={() => {
            if (edit.cancel()) close();
          }}
        />
        <AppButton
          fill
          tone="primary"
          label={saving ? "Saving…" : `Save ${section}`}
          disabled={busy}
          onPress={() => {
            void edit.save().then((saved) => {
              if (saved) close();
            });
          }}
        />
      </ButtonRow>
    </EditorSection>
  );
}
