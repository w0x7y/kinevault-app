import { createId } from "../persistence/create-id";
import { createDocumentProvider } from "../persistence/document-provider";
import { mediaFiles } from "./media-files";
import { createProfileMediaPersistence } from "./media-persistence";

export const {
  Provider: ProfileMediaProvider,
  useDocument: useProfileMedia,
  useStore: useProfileMediaStore,
} = createDocumentProvider({
  name: "ProfileMediaProvider",
  create: (storage) => createProfileMediaPersistence({ storage, files: mediaFiles, createId }),
  useValue: (snapshot, store) => ({
    ...snapshot,
    files: mediaFiles,
    retryLoad: store.retryLoad,
  }),
});
