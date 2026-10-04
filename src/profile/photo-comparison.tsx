import { View } from "react-native";
import { AppText } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { spacing } from "../theme/tokens";
import { ProfileDialog } from "./profile-controls";
import type { ProgressPhoto } from "./media-model";
import { PhotoImage } from "./photo-image";
export function PhotoComparison({
  photos,
  close,
}: {
  photos: readonly [ProgressPhoto, ProgressPhoto];
  close: () => void;
}) {
  return (
    <ProfileDialog title="Compare progress photos" dismiss={close}>
      <View style={{ flexDirection: "row", gap: spacing.layout }}>
        {photos.map((photo) => (
          <View key={photo.id} style={{ flex: 1, gap: spacing.sm }}>
            <PhotoImage
              image={photo.image}
              contentFit="contain"
              accessibilityLabel={`Progress photo ${photo.date}`}
              style={{ width: "100%", height: 260 }}
            />
            <AppText variant="label">{photo.date}</AppText>
            {photo.note !== "" && (
              <AppText variant="caption" muted>
                {photo.note}
              </AppText>
            )}
          </View>
        ))}
      </View>
      <FoodButton label="Back to photos" onPress={close} />
    </ProfileDialog>
  );
}
