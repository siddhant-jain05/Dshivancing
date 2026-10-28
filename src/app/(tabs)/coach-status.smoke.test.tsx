import { render } from "@testing-library/react-native";
import CoachStatus from "./coach-status";

describe("src/app/(tabs)/coach-status", () => {
  it("renders without throwing", () => {
    render(<CoachStatus />);
  });
});
