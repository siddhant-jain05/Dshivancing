import * as React from "react";

const MockComponent: React.FC<any> = () => null;

export const View = MockComponent;
export const Text = MockComponent;
export const ScrollView = MockComponent;
export const ActivityIndicator = MockComponent;
export const TouchableOpacity = MockComponent;
export const Image = MockComponent;
export const FlatList = MockComponent;
export const TextInput = MockComponent;
export const Button = MockComponent;
export const Switch = MockComponent;
export const Modal = MockComponent;
export const StatusBar = MockComponent;
export const KeyboardAvoidingView = MockComponent;
export const SafeAreaView = MockComponent;
export const Dimensions = { get: () => ({ width: 375, height: 812 }) };
export const Platform = { OS: "ios" as const, select: <T>(obj: { ios?: T; default: T }) => obj.ios ?? obj.default };
export const StyleSheet = {
  create: (styles: any) => styles,
  flatten: (style: any) => style,
  hairlineWidth: 1,
  absoluteFill: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
};
export const Alert = { alert: jest.fn() };
export const InteractionManager = { runAfterInteractions: (cb: () => void) => setTimeout(cb, 0) };
export const PixelRatio = { get: () => 1 };
export const Linking = { addEventListener: jest.fn(), removeEventListener: jest.fn(), openURL: jest.fn() };
export const AppState = { addEventListener: jest.fn(), removeEventListener: jest.fn(), currentState: "active" as const };
export const NetInfo = { addEventListener: jest.fn(), fetch: jest.fn(() => Promise.resolve({ isConnected: true })) };

export default {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Button,
  Switch,
  Modal,
  StatusBar,
  KeyboardAvoidingView,
  SafeAreaView,
  Dimensions,
  Platform,
  StyleSheet,
  Alert,
  InteractionManager,
  PixelRatio,
  Linking,
  AppState,
  NetInfo,
};
