import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import i18nInstance from '../lib/i18n';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { getUnwrapped, getUnwrappedArray } from '../lib/unwrapped-get';
import { ensurePermission } from '../lib/permissions';
import {
  getPosition,
  pointInPolygon,
  distanceToPolygon,
  type LatLng,
  type PositionFailure,
} from '../lib/geo';

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

type StaffSociety = {
  geofence?: LatLng[];
};

export function useAttendance(month: number, year: number, monthCalendarOpen: boolean) {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [insideGeofence, setInsideGeofence] = useState<boolean>(true);
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
    queryFn: () => getUnwrapped<StaffSociety>('/staff/society').catch(() => null as StaffSociety | null),
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

  useEffect(() => {
    void refreshPosition();
  }, [refreshPosition]);

  useEffect(() => {
    const polygon: LatLng[] | undefined = society?.geofence;

    // No geofence configured for this society: presence cannot be checked, so
    // allowing the check-in is correct rather than permissive.
    if (!polygon?.length) {
      setInsideGeofence(true);
      setDistance(null);
      return;
    }

    // A geofence IS configured but we have no fix. This used to fall into the
    // same branch as "no geofence" and set insideGeofence = true — so a staff
    // member who denied location could check in from anywhere and the geofence
    // silently did not run. Withhold the check-in and say why instead.
    if (!position) {
      setInsideGeofence(false);
      setDistance(null);
      return;
    }

    const inside = pointInPolygon(position, polygon);
    setInsideGeofence(inside);
    setDistance(inside ? 0 : distanceToPolygon(position, polygon));
  }, [position, society]);

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
          { text: t('duty.addReason'), onPress: () => router.push('/attendance/late-reason' as any) },
        ]);
      }
    },
    onError: (err: any) => {
      if (err?.status === 409 || /already checked in/i.test(err?.message ?? '')) {
        Alert.alert(t('duty.alreadyCheckedInTitle'), t('duty.alreadyCheckedInBody'));
        return;
      }
      Alert.alert(t('duty.couldNotCheckIn'), t('duty.tryAgainShort'));
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/staff/check-out', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-history', month, year] });
    },
    onError: () => Alert.alert(t('duty.couldNotCheckOut'), t('duty.tryAgainShort')),
  });

  const checkedIn = !!todayRecord?.checkIn;
  const checkedOut = !!todayRecord?.checkOut;

  const checkIn = async () => {
    if (submitting.current) return;

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

    if (!insideGeofence) {
      Alert.alert(t('duty.outsideSocietyTitle'), t('duty.outsideSocietyBody'));
      return;
    }
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        Alert.alert(t('duty.locationOffTitle'), t('duty.locationOffBody'));
        return;
      }
      const last = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if ((last.mocked as boolean | undefined) === true) {
        Alert.alert(t('duty.mockLocationTitle'), t('duty.mockLocationBody'));
        return;
      }
    } catch {
      // best effort
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

    submitting.current = true;
    try {
      await checkInMutation.mutateAsync({
        lat: position?.lat,
        lng: position?.lng,
        biometricVerified,
        deviceId,
      });
    } finally {
      submitting.current = false;
    }
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
