import { render } from "@testing-library/react-native";
import Signup from "./signup";

describe("src/app/(auth)/signup", () => {
  it("renders without throwing", () => {
    render(<Signup />);
  });
});
