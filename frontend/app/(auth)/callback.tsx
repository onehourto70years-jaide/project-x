import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import * as Linking from 'expo-linking';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    const processAuth = async () => {
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      try {
        // Get session_id from params or URL
        let sessionId = params.session_id as string;
        
        if (!sessionId) {
          // Try to get from URL hash (web)
          const url = await Linking.getInitialURL();
          if (url) {
            const hashMatch = url.match(/session_id=([^&]+)/);
            if (hashMatch) {
              sessionId = hashMatch[1];
            }
          }
        }

        if (sessionId) {
          await signIn(sessionId);
          router.replace('/(tabs)');
        } else {
          console.error('No session_id found');
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/(auth)/login');
      }
    };

    processAuth();
  }, [params.session_id]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#00d4ff" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  text: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
});
