import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Sentry } from '../lib/sentry';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
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
      <View className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-5xl mb-4">😕</Text>
        <Text className="text-xl font-bold text-gray-900 mb-2">Something went wrong</Text>
        <Text className="text-sm text-gray-500 text-center mb-6">
          We&apos;ve been notified. Try retrying — if the issue persists, please report it below.
        </Text>
        <ScrollView style={{ maxHeight: 120 }} className="w-full mb-6">
          <Text className="text-xs text-gray-400">{String(this.state.error.message)}</Text>
        </ScrollView>
        <TouchableOpacity
          onPress={this.reset}
          accessibilityLabel="Retry"
          accessibilityRole="button"
          className="bg-primary-500 rounded-2xl px-8 py-3 mb-3 w-full items-center"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.report}
          accessibilityLabel="Report issue"
          accessibilityRole="button"
          className="bg-white border border-gray-200 rounded-2xl px-8 py-3 w-full items-center"
        >
          <Text className="text-gray-700 font-semibold">Report Issue</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
