import * as React from "react";

const MockIcon: React.FC = () => null;

export default MockIcon;

export const Icon = MockIcon;
export const Button = MockIcon;
export const TabBarItemIOS = MockIcon;
export const TabBarItem = MockIcon;
export const ToolbarAndroid = MockIcon;
export const Image = MockIcon;
export const DrawerItemAndroid = MockIcon;
export const SearchBarAndroid = MockIcon;
export const TabItem = MockIcon;

export const getImageSource = jest.fn(() => Promise.resolve({ uri: "mock://icon" }));
