import { render } from "@testing-library/react-native";
import Sessions from "./sessions";

describe("src/app/(tabs)/sessions", () => {
  it("renders without throwing", () => {
    render(<Sessions />);
  });
});
