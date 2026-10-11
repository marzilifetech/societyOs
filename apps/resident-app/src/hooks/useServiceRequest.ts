import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';

export function useServiceRequest(
  id: string | undefined,
  opts: {
    disputeReason: string;
    rating: number;
    ratingNote: string;
    onConfirmed?: () => void;
    onDisputed?: () => void;
    onRated?: () => void;
  },
) {
  const qc = useQueryClient();

  const confirm = useMutation({
    mutationFn: () => api.post(`/service-requests/${id}/confirm`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-request', id] });
      qc.invalidateQueries({ queryKey: ['my-service-requests'] });
      opts.onConfirmed?.();
      Alert.alert('Confirmed!', 'Service request has been closed.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const dispute = useMutation({
    mutationFn: () => api.post(`/service-requests/${id}/dispute`, { reason: opts.disputeReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-request', id] });
      qc.invalidateQueries({ queryKey: ['my-service-requests'] });
      opts.onDisputed?.();
      Alert.alert('Dispute Raised', 'Staff will be notified to revisit.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const rate = useMutation({
    mutationFn: () => api.post(`/service-requests/${id}/rate`, { rating: opts.rating, note: opts.ratingNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-request', id] });
      qc.invalidateQueries({ queryKey: ['my-service-requests'] });
      opts.onRated?.();
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  return { confirm, dispute, rate };
}

/**
 * Cancel a service request after a confirmation prompt. Shared by Home, the
 * Services tab and the request detail so every Cancel asks first, reports
 * failures and ignores taps while a cancel is already in flight.
 */
export function useCancelServiceRequest(opts: { onCancelled?: (id: string) => void } = {}) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => api.patch(`/service-requests/${id}/cancel`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['my-service-requests'] });
      qc.invalidateQueries({ queryKey: ['service-request', id] });
      opts.onCancelled?.(id);
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not cancel request.'),
  });

  const confirmCancel = (id: string) => {
    if (mutation.isPending) return;
    Alert.alert('Cancel request?', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => mutation.mutate(id) },
    ]);
  };

  return {
    confirmCancel,
    isPending: mutation.isPending,
    /** The request currently being cancelled, if any. */
    pendingId: mutation.isPending ? mutation.variables : undefined,
  };
}
