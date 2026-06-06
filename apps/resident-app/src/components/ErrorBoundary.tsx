import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Sentry } from '../lib/sentry';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Ensure splash screen is dismissed even if the root layout crashes before
    // its useEffect can call hideAsync().
    SplashScreen.hideAsync().catch(() => {});
    try {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    } catch {
      /* ignore */
    }
  }

  reset = () => this.setState({ error: null });
  report = () => {
    if (!this.state.error) return;
    try {
      Sentry.captureException(this.state.error, { tags: { source: 'user-report' } });
    } catch {
      /* ignore */
    }
    this.reset();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', padding: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>😕</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#F5F5F7', marginBottom: 8 }}>
          Something went wrong
        </Text>
        <Text style={{ color: '#8E8E93', textAlign: 'center', marginBottom: 24 }}>
          We&apos;ve been notified. You can retry, or report this issue below.
        </Text>
        <ScrollView style={{ maxHeight: 120, width: '100%', marginBottom: 24 }}>
          <Text style={{ color: '#666', fontSize: 12 }}>{String(this.state.error.message)}</Text>
        </ScrollView>
        <TouchableOpacity
          onPress={this.reset}
          accessibilityLabel="Retry"
          accessibilityRole="button"
          style={{ backgroundColor: '#821A52', borderRadius: 4, paddingVertical: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.report}
          accessibilityLabel="Report issue"
          accessibilityRole="button"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center' }}
        >
          <Text style={{ color: '#F5F5F7', fontWeight: '600' }}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
