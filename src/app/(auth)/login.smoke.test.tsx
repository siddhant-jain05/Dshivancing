import { render } from "@testing-library/react-native";
import Login from "./login";

describe("src/app/(auth)/login", () => {
  it("renders without throwing", () => {
    render(<Login />);
  });
});
