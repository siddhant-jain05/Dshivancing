import { render } from "@testing-library/react-native";
import ApplicationDetail from "./[id]";

describe("src/app/admin/application/[id]", () => {
  it("renders without throwing", () => {
    render(<ApplicationDetail />);
  });
});
