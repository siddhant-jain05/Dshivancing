import { render } from "@testing-library/react-native";
import CoachSetup from "./coach-setup";

describe("src/app/(tabs)/coach-setup", () => {
  it("renders without throwing", () => {
    render(<CoachSetup />);
  });
});
