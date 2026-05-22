import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: any) => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      Animated.timing(opacity, { toValue: offline ? 1 : 0, duration: 300, useNativeDriver: true }).start();
    });
    return unsub;
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { opacity }]}>
      <Text style={styles.text}>No internet connection — please check your Wi-Fi or mobile data</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#92400E', padding: 12, alignItems: 'center' },
  text: { color: '#FEF3C7', fontSize: 14, textAlign: 'center' },
});
