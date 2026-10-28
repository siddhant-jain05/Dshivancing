import * as React from "react";

export const SafeAreaView: React.FC = () => null;
export const SafeAreaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => children;
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
export const SafeAreaConsumer: React.FC<{ children: (insets: { top: number; right: number; bottom: number; left: number }) => React.ReactNode }> = ({ children }) => children({ top: 0, right: 0, bottom: 0, left: 0 });

export default {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
  SafeAreaConsumer,
};
