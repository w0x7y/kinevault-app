import { Image } from "react-native";

export function Kine({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/mascot/kine.png")}
      resizeMode="contain"
      accessibilityLabel="Kine, your friendly blue companion"
      accessible={false}
      aria-hidden={true}
      style={{ width: size, height: size }}
    />
  );
}
