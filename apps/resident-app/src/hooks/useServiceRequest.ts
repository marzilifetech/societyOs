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
