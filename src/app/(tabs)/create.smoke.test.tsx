import { render } from "@testing-library/react-native";
import Create from "./create";

describe("src/app/(tabs)/create", () => {
  it("renders without throwing", () => {
    render(<Create />);
  });
});
