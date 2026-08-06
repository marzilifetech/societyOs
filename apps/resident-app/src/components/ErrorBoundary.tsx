import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Sentry } from '../lib/sentry';
import { serifFont } from './ui/redesign';

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
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', padding: 32, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#FBEEF5',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 34 }}>😕</Text>
        </View>
        <Text style={{ fontFamily: serifFont.bold, fontSize: 24, color: '#141414', marginBottom: 8, textAlign: 'center' }}>
          Something went wrong
        </Text>
        <Text style={{ color: 'rgba(0,0,0,0.55)', textAlign: 'center', marginBottom: 24, lineHeight: 21 }}>
          We&apos;ve been notified. You can retry, or report this issue below.
        </Text>
        <ScrollView style={{ maxHeight: 120, width: '100%', marginBottom: 24 }}>
          <Text style={{ color: 'rgba(0,0,0,0.40)', fontSize: 12 }}>{String(this.state.error.message)}</Text>
        </ScrollView>
        <TouchableOpacity
          onPress={this.reset}
          accessibilityLabel="Try again"
          accessibilityRole="button"
          style={{ backgroundColor: '#821A52', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.report}
          accessibilityLabel="Report issue"
          accessibilityRole="button"
          style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.12)', borderWidth: 1, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center' }}
        >
          <Text style={{ color: '#141414', fontWeight: '700' }}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
