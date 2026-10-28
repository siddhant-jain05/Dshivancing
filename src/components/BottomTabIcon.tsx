import Ionicons from "react-native-vector-icons/Ionicons";

const ICONS: Record<string, string> = {
  home: "home-outline",
  people: "people-outline",
  plus: "add-outline",
  calendar: "calendar-outline",
  user: "person-outline",
};

export function BottomTabIcon({ name }: { name: string }) {
  return <Ionicons name={ICONS[name] ?? "help-outline"} size={24} color="#007AFF" />;
}
