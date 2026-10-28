import { render } from "@testing-library/react-native";
import RootLayout from "./_layout";

describe("src/app/_layout", () => {
  it("renders without throwing", () => {
    render(<RootLayout />);
  });
});
