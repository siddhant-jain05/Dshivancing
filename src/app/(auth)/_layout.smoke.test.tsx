import { render } from "@testing-library/react-native";
import AuthLayout from "./_layout";

describe("src/app/(auth)/_layout", () => {
  it("renders without throwing", () => {
    render(<AuthLayout />);
  });
});
