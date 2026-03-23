import React from 'react';
import { Redirect } from 'expo-router';

export default function AIHomeScreen() {
  // Redirect to the AI tab
  return <Redirect href="/(tabs)/ai" />;
}
