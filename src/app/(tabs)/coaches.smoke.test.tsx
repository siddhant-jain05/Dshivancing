import { render } from "@testing-library/react-native";
import Coaches from "./coaches";

describe("src/app/(tabs)/coaches", () => {
  it("renders without throwing", () => {
    render(<Coaches />);
  });
});
