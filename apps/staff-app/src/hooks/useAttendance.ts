import { useState, useRef, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import i18nInstance from '../lib/i18n';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { getUnwrapped, getUnwrappedArray } from '../lib/unwrapped-get';
import { ensurePermission } from '../lib/permissions';
import { getPosition, checkGeofence, type Geofence, type LatLng, type PositionFailure } from '../lib/geo';

type TodayAttendance = {
  checkIn?: string;
  checkOut?: string;
  isLate?: boolean;
  isEarlyDeparture?: boolean;
};

type AttendanceHistoryRow = {
  id: string;
  date: string;
  status?: string;
  isLate?: boolean;
};

/** Polygon when the society drew one, or a circle. */
type StaffSociety = Geofence;

/** Server error codes for a refused check-in/out, mapped to what to tell the guard. */
function attendanceErrorMessage(err: unknown, fallback: string): string {
  switch ((err as { code?: string })?.code) {
    case 'LOCATION_REQUIRED':
      return 'Turn on location and try again — check-in confirms you are on society premises.';
    case 'OUTSIDE_GEOFENCE':
      return 'You appear to be outside the society. Move inside the premises and try again.';
    case 'NOT_CHECKED_IN':
      return 'You are not checked in.';
    default:
      return (err as Error)?.message || fallback;
  }
}

export function useAttendance(month: number, year: number, monthCalendarOpen: boolean) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [position, setPosition] = useState<LatLng | null>(null);
  /** Why we have no fix, or null when we do. Drives the attendance UI. */
  const [locationIssue, setLocationIssue] = useState<PositionFailure | null>(null);
  const submitting = useRef(false);

  const { data: todayRecord, isPending: todayPending } = useQuery({
    queryKey: ['today-attendance'],
    queryFn: () => getUnwrapped<TodayAttendance>('/staff/attendance/today'),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['attendance-history', month, year],
    queryFn: () =>
      getUnwrappedArray<AttendanceHistoryRow>(`/staff/attendance?month=${month}&year=${year}`),
    select: (d): AttendanceHistoryRow[] => (Array.isArray(d) ? d : []),
    enabled: !!user && monthCalendarOpen,
  });

  const { data: society } = useQuery({
    queryKey: ['my-society'],
    queryFn: () =>
      getUnwrapped<StaffSociety>('/staff/society').catch(() => null as StaffSociety | null),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  /**
   * Acquire a fix, remembering WHY if we cannot.
   *
   * Prompting is deliberate here rather than passive: attendance is the first
   * thing a staff member does, and location is the point of the geofence, so
   * the ask is self-evident in context.
   */
  const refreshPosition = useCallback(async () => {
    const r = await getPosition();
    if (r.ok) {
      setPosition(r.position);
      setLocationIssue(null);
    } else {
      setPosition(null);
      setLocationIssue(r.reason);
    }
  }, []);

  // On every focus, not only the first mount: the Duty tab stays mounted, so a
  // guard who opened it at the gate and came back from inside the building
  // used to be judged (and shown the distance chip) by the old fix.
  useFocusEffect(
    useCallback(() => {
      void refreshPosition();
    }, [refreshPosition]),
  );

  // Drives the distance chip. The check-in gate re-judges the fresh fix it
  // takes itself (see runCheckIn).
  const { inside: insideGeofence, distance } = useMemo(
    () => checkGeofence(position, society),
    [position, society],
  );

  const checkInMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/staff/check-in', payload);
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['today-attendance'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (data?.isLate) {
        Alert.alert(t('duty.lateCheckInTitle'), t('duty.lateCheckInBody'), [
          { text: t('duty.later') },
          {
            text: t('duty.addReason'),
            onPress: () => router.push('/attendance/late-reason' as any),
          },
        ]);
      }
    },
    onError: (err: any) => {
      if (err?.status === 409 || /already checked in/i.test(err?.message ?? '')) {
        Alert.alert(t('duty.alreadyCheckedInTitle'), t('duty.alreadyCheckedInBody'));
        return;
      }
      Alert.alert(t('duty.couldNotCheckIn'), attendanceErrorMessage(err, t('duty.tryAgainShort')));
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/staff/check-out', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-history', month, year] });
    },
    onError: (err: unknown) =>
      Alert.alert(t('duty.couldNotCheckOut'), attendanceErrorMessage(err, t('duty.tryAgainShort'))),
  });

  const checkedIn = !!todayRecord?.checkIn;
  const checkedOut = !!todayRecord?.checkOut;

  const checkIn = async () => {
    // Held for the WHOLE flow (GPS, biometric prompt, request): it used to be
    // set only right before the request, so repeated taps while the GPS or
    // fingerprint prompt was up stacked prompts and duplicate check-ins.
    if (submitting.current) return;
    submitting.current = true;
    try {
      await runCheckIn();
    } catch {
      // Failures are shown by the mutation's onError; nothing may escape as
      // an unhandled rejection from a button press.
    } finally {
      submitting.current = false;
    }
  };

  const runCheckIn = async () => {
    // "We cannot tell where you are" is a different problem from "you are not
    // here", and needs a different fix. Telling a staff member standing in the
    // lobby that they are outside the society is how you get them to stop
    // trusting the app.
    if (locationIssue) {
      const retry = { text: t('common.retry') ?? 'Retry', onPress: () => void refreshPosition() };
      if (locationIssue === 'blocked' || locationIssue === 'permission') {
        await ensurePermission('location', {
          withRationale: locationIssue === 'permission',
          blockedMessage:
            'Check-in confirms you are on society premises, so it needs your location.',
        });
        await refreshPosition();
        return;
      }
      Alert.alert(
        t('duty.locationOffTitle'),
        locationIssue === 'timeout'
          ? 'Could not get a GPS fix. Step outside or near a window and try again.'
          : t('duty.locationOffBody'),
        [{ text: t('duty.later') ?? 'Later', style: 'cancel' }, retry],
      );
      return;
    }

    const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!servicesOn) {
      Alert.alert(t('duty.locationOffTitle'), t('duty.locationOffBody'));
      return;
    }
    // A fresh, BOUNDED fix for the check-in itself (the mount-time one may be
    // minutes old). The old second fix had no timeout and could hang indoors.
    const fix = await getPosition({ prompt: false });
    if (fix.ok && fix.mocked) {
      Alert.alert(t('duty.mockLocationTitle'), t('duty.mockLocationBody'));
      return;
    }
    const at = fix.ok ? fix.position : position;
    if (fix.ok) setPosition(fix.position);

    // Judge presence by the fix just taken: the tab's fix can be from where the
    // guard was minutes ago (outside the gate, or already gone home). This is
    // only the friendly early answer; the server re-checks the coordinates we
    // send and its OUTSIDE_GEOFENCE is final (see attendanceErrorMessage).
    const fence = checkGeofence(at, society);
    if (!fence.inside) {
      if (!at) {
        // A geofence is configured but no fix exists at all: that is "cannot
        // tell where you are", not "you are outside".
        Alert.alert(
          t('duty.locationOffTitle'),
          'Could not get a GPS fix. Step outside or near a window and try again.',
        );
        return;
      }
      Alert.alert(t('duty.outsideSocietyTitle'), t('duty.outsideSocietyBody'));
      return;
    }

    let biometricVerified = false;
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (has && enrolled) {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: t('duty.verifyCheckIn'),
          fallbackLabel: t('duty.usePin'),
          disableDeviceFallback: false,
        });
        if (!res.success) {
          Alert.alert(t('duty.verificationCancelledTitle'));
          return;
        }
        biometricVerified = true;
      }
    } catch {
      // ignore
    }

    const deviceId = `${Platform.OS}-${Platform.Version ?? 'unknown'}`;
    await checkInMutation.mutateAsync({
      lat: at?.lat,
      lng: at?.lng,
      biometricVerified,
      deviceId,
    });
  };

  const checkOut = () => {
    if (submitting.current) return;
    submitting.current = true;
    checkOutMutation.mutate(undefined, {
      onSettled: () => {
        submitting.current = false;
      },
    });
  };

  return {
    todayRecord,
    todayPending,
    history,
    historyLoading,
    position,
    distance,
    insideGeofence,
    /** Non-null when the fix failed; the attendance screen explains and retries. */
    locationIssue,
    refreshPosition,
    checkedIn,
    checkedOut,
    checkIn,
    checkOut,
    isCheckingIn: checkInMutation.isPending,
    isCheckingOut: checkOutMutation.isPending,
  };
}
