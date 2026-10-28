import { render } from "@testing-library/react-native";
import VerifyOtp from "./verify-otp";

describe("src/app/(auth)/verify-otp", () => {
  it("renders without throwing", () => {
    render(<VerifyOtp />);
  });
});
