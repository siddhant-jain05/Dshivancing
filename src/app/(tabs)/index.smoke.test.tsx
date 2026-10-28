import { render } from "@testing-library/react-native";
import Index from "./index";

describe("src/app/(tabs)/index", () => {
  it("renders without throwing", () => {
    render(<Index />);
  });
});
