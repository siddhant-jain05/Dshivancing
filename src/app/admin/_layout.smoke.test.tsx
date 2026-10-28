import { render } from "@testing-library/react-native";
import AdminLayout from "./_layout";

describe("src/app/admin/_layout", () => {
  it("renders without throwing", () => {
    render(<AdminLayout>content</AdminLayout>);
  });
});
