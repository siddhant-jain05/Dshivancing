import { render } from "@testing-library/react-native";
import CoachApplication from "./coach-application";

describe("src/app/(tabs)/coach-application", () => {
  it("renders without throwing", () => {
    render(<CoachApplication />);
  });
});
