import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="privacy-policy" options={{ gestureEnabled: false }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="callback" />
    </Stack>
  );
}
