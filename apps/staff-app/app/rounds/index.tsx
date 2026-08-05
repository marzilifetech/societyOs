// Local security round timer; server status from GET /staff/rounds (checklist when enabled).

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';
import { AppHeader, Card, EmptyState } from '../../src/components/ui';

type StaffRoundsResponse = { items: unknown[]; message?: string };

interface RoundEntry {
  id: string;
  startedAt: Date;
  completedAt: Date;
  durationSec: number;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function RoundsScreen() {
  const [rounds, setRounds] = useState<RoundEntry[]>([]);
  const [activeStart, setActiveStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: roundsMeta, isError: roundsError, refetch: refetchRounds } = useQuery({
    queryKey: ['staff-rounds'],
    queryFn: () => api.get<StaffRoundsResponse>('/staff/rounds'),
  });

  const today = new Date();

  // Detect shift from time-of-day
  const shiftLabel = (() => {
    const h = today.getHours();
    if (h < 8) return 'Night Shift';
    if (h < 16) return 'Morning Shift';
    return 'Evening Shift';
  })();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function handleStartRound() {
    if (activeStart) return;
    const start = new Date();
    setActiveStart(start);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }

  function handleCompleteRound() {
    if (!activeStart) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const now = new Date();
    const dur = Math.floor((now.getTime() - activeStart.getTime()) / 1000);
    const entry: RoundEntry = {
      id: String(Date.now()),
      startedAt: activeStart,
      completedAt: now,
      durationSec: dur,
    };
    setRounds((prev) => [entry, ...prev]);
    setActiveStart(null);
    setElapsed(0);
  }

  function handleCancelRound() {
    Alert.alert('Cancel Round?', 'This round will not be logged.', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Cancel Round',
        style: 'destructive',
        onPress: () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setActiveStart(null);
          setElapsed(0);
        },
      },
    ]);
  }

  const isActive = !!activeStart;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <AppHeader title="Security Rounds" />

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" showsVerticalScrollIndicator={false}>
        {roundsError ? (
          <ErrorCard
            message="Round details couldn't be loaded. You can still log rounds below."
            onRetry={() => refetchRounds()}
          />
        ) : roundsMeta?.message ? (
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Text className="text-amber-900 text-sm">{roundsMeta.message}</Text>
          </View>
        ) : null}

        {/* Date & Shift Info */}
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <Text className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Today</Text>
          <Text className="text-base font-semibold text-gray-900 mt-1">{formatDate(today)}</Text>
          <View className="mt-2 self-start bg-blue-100 rounded-full px-3 py-1">
            <Text className="text-xs font-semibold text-blue-700">{shiftLabel}</Text>
          </View>
        </View>

        {/* Active Round / Timer Card */}
        {isActive ? (
          <View className="bg-white rounded-2xl p-5 shadow-sm items-center">
            <Text className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-2">Round in Progress</Text>
            <Text className="text-5xl font-bold text-primary-500 tracking-tight">
              {formatDuration(elapsed)}
            </Text>
            <Text className="text-xs text-gray-400 mt-1">Started at {formatTime(activeStart!)}</Text>
            <View className="flex-row gap-3 mt-5 w-full">
              <TouchableOpacity
                onPress={handleCompleteRound}
                className="flex-1 bg-green-500 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-bold text-sm">Complete Round</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancelRound}
                className="bg-gray-100 rounded-xl py-3 px-4 items-center"
              >
                <Text className="text-gray-600 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleStartRound}
            className="bg-green-500 rounded-2xl py-5 items-center shadow-sm"
          >
            <Text className="text-white font-bold text-base">Start Round</Text>
          </TouchableOpacity>
        )}

        {/* Completed Rounds Today */}
        <View>
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Completed Today ({rounds.length})
          </Text>
          {rounds.length === 0 ? (
            <Card padding="none">
              <EmptyState icon="walk-outline" title="No rounds logged yet" />
            </Card>
          ) : (
            <View className="gap-3">
              {rounds.map((r, i) => (
                <View key={r.id} className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm font-semibold text-gray-900">Round {rounds.length - i}</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {formatTime(r.startedAt)} – {formatTime(r.completedAt)}
                    </Text>
                  </View>
                  <View className="bg-green-100 rounded-full px-3 py-1">
                    <Text className="text-xs font-semibold text-green-700">{formatDuration(r.durationSec)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
