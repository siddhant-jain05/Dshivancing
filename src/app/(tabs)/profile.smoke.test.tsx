import { render } from "@testing-library/react-native";
import Profile from "./profile";

describe("src/app/(tabs)/profile", () => {
  it("renders without throwing", () => {
    render(<Profile />);
  });
});
