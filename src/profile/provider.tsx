import { createDocumentProvider } from "../persistence/document-provider";
import { createProfilePersistence } from "./persistence";

export const {
  Provider: ProfileProvider,
  useDocument: useProfile,
  useStore: useProfilePersistence,
} = createDocumentProvider({
  name: "ProfileProvider",
  create: (storage) => createProfilePersistence(storage),
  useValue: (snapshot, profile) => ({
    ...snapshot,
    save: profile.save,
    saveWeight: profile.saveWeight,
    removeWeight: profile.removeWeight,
    reset: profile.reset,
    retryLoad: profile.retryLoad,
  }),
});
