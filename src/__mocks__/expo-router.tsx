// Mock navigation hooks
export const useRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  pop: jest.fn(),
  canGoBack: jest.fn(() => false),
  setParams: jest.fn(),
  getCurrentRoute: () => ({ name: "", params: {} }),
  state: { routes: [], index: 0, type: "history" as const },
});

export const useLocalSearchParams = () => ({});

export const useGlobalSearchParams = () => ({});

export const usePathname = () => "/";

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  pop: jest.fn(),
  canGoBack: jest.fn(() => false),
  state: { routes: [], index: 0, type: "history" as const },
};

// Mock components - return null for smoke testing
export const Link = () => null;

export const Stack = () => null;
const StackScreen: React.FC = () => null;
StackScreen.displayName = "Stack.Screen";
Stack.Screen = StackScreen as any;

export const Tabs = () => null;
const TabsScreen: React.FC = () => null;
TabsScreen.displayName = "Tabs.Screen";
Tabs.Screen = TabsScreen as any;

export const ExpoRoot = () => null;

export default { Stack, Tabs, ExpoRoot, Link, useRouter, useLocalSearchParams, router };
