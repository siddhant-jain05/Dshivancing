import { render } from "@testing-library/react-native";
import CoachIntro from "./coach-intro";

describe("src/app/(tabs)/coach-intro", () => {
  it("renders without throwing", () => {
    render(<CoachIntro />);
  });
});
