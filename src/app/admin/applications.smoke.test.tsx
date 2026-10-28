import { render } from "@testing-library/react-native";
import Applications from "./applications";

describe("src/app/admin/applications", () => {
  it("renders without throwing", () => {
    render(<Applications />);
  });
});
