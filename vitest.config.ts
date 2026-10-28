import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": "/src",
      "@/lib/supabase": "/src/__mocks__/supabase.ts",
    },
  },
});
