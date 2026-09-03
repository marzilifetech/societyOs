import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import i18nInstance from '../../src/lib/i18n';
import { api } from '../../src/lib/api';
import { DateField } from '../../src/components/common/DateField';
import { AppHeader } from '../../src/components/ui';

const LEAVE_TYPES = [
  { value: 'CASUAL', label: 'Casual', balanceKey: 'casual' as const },
  { value: 'MEDICAL', label: 'Medical', balanceKey: 'medical' as const },
  { value: 'PRIVILEGE', label: 'Privilege', balanceKey: 'privilege' as const },
];

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function LeaveRequestScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ type?: string }>();
  const today = formatDate(new Date());

  const [leaveType, setLeaveType] = useState<string>('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [fromDateError, setFromDateError] = useState('');
  const [toDateError, setToDateError] = useState('');

  // Prefill from query
  useEffect(() => {
    if (params.type && typeof params.type === 'string') {
      const match = LEAVE_TYPES.find((t) => t.value === params.type);
      if (match) setLeaveType(match.value);
    }
  }, [params.type]);

  const { data: balance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () =>
      api
        .get<any>('/staff/leave-balance')
        .catch((e) => {
          console.warn('[leave-balance] fetch failed', e?.message);
          return null;
        }),
  });

  const mutation = useMutation({
    /**
     * Canonical field names.
     *
     * This posted `{ leaveType, fromDate, toDate, reason }` — it had copied the
     * shape of the ADMIN leave-list RESPONSE, which renames these fields. The
     * API declares `{ type, startDate, endDate, reason }` and the global
     * ValidationPipe runs with `forbidNonWhitelisted`, so every submission came
     * back 400 and the button appeared to do nothing. The API now accepts both
     * spellings (so builds already in the field work), and this sends the
     * canonical one.
     */
    mutationFn: () =>
      api.post('/staff/leave', {
        type: leaveType,
        startDate: fromDate,
        endDate: toDate,
        reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-history'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        router.replace('/leave/history' as any);
      }, 1200);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const days = Math.max(
    1,
    Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1,
  );

  const selectedMeta = LEAVE_TYPES.find((t) => t.value === leaveType);
  const selectedBal = selectedMeta && balance ? balance[selectedMeta.balanceKey] : null;
  const remainingAfter = selectedBal
    ? Math.max(0, (selectedBal.total ?? 0) - (selectedBal.used ?? 0) - days)
    : null;

  const reasonValid = reason.trim().length >= 10;
  const dateValid = toDate >= fromDate;
  const balanceOk = !selectedBal || (selectedBal.total - selectedBal.used) >= days;
  const isValid = leaveType.length > 0 && reasonValid && dateValid && balanceOk && !fromDateError && !toDateError;

  function validateDates(from: string, to: string) {
    let fromErr = '';
    let toErr = '';
    if (from < today) {
      fromErr = "Please pick a date that hasn't passed yet.";
    }
    if (to < from) {
      toErr = 'Return date must be on or after the start date.';
    }
    setFromDateError(fromErr);
    setToDateError(toErr);
    return !fromErr && !toErr;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <AppHeader title={t('leave.requestTitle')} subtitle={t('leave.requestSubtitle')} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-6 pb-8">
          {/* Leave type chips */}
          <Text className="text-sm font-medium text-gray-700 mb-3">Leave Type *</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {LEAVE_TYPES.map((lt) => (
              <TouchableOpacity
                key={lt.value}
                className={`px-4 py-2.5 rounded-xl border ${
                  leaveType === lt.value
                    ? 'bg-primary-50 border-primary-500'
                    : 'bg-white border-gray-200'
                }`}
                onPress={() => setLeaveType(lt.value)}
              >
                <Text
                  className={`text-sm font-medium ${
                    leaveType === lt.value ? 'text-primary-600' : 'text-gray-700'
                  }`}
                >
                  {lt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date range */}
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1.5">From *</Text>
              <DateField
                value={fromDate}
                dateAsYMD
                onChange={(v) => {
                  setFromDate(v);
                  const newTo = v > toDate ? v : toDate;
                  if (v > toDate) setToDate(newTo);
                  validateDates(v, newTo);
                }}
                minimumDate={new Date()}
              />
              {!!fromDateError && (
                <Text className="text-xs text-amber-600 mt-1">{fromDateError}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1.5">To *</Text>
              <DateField
                value={toDate}
                dateAsYMD
                onChange={(v) => {
                  setToDate(v);
                  validateDates(fromDate, v);
                }}
                minimumDate={new Date(fromDate)}
              />
              {!!toDateError && (
                <Text className="text-xs text-amber-600 mt-1">{toDateError}</Text>
              )}
            </View>
          </View>

          {/* Days + balance hint */}
          {leaveType && dateValid && (
            <View className={`rounded-xl px-4 py-3 mb-6 ${balanceOk ? 'bg-primary-50' : 'bg-amber-50'}`}>
              <Text className={`text-sm ${balanceOk ? 'text-primary-600' : 'text-amber-700'}`}>
                <Text className="font-bold">{days}</Text> day{days !== 1 ? 's' : ''} of leave
                {selectedBal != null && (
                  <>
                    {' · '}
                    {balanceOk
                      ? `You will have ${remainingAfter} left`
                      : `Only ${selectedBal.total - selectedBal.used} available`}
                  </>
                )}
              </Text>
            </View>
          )}

          {/* Reason */}
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Reason * (min 10 chars)</Text>
          <TextInput
            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-base text-gray-900 min-h-[100px]"
            value={reason}
            onChangeText={setReason}
            placeholder="Briefly describe the reason for your leave..."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
          />
          {reason.length > 0 && !reasonValid && (
            <Text className="text-xs text-amber-600 mt-1">Please add a little more detail (at least 10 characters).</Text>
          )}

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center mt-6 ${isValid ? 'bg-primary-500' : 'bg-gray-200'}`}
            onPress={() => {
              if (!validateDates(fromDate, toDate)) return;
              mutation.mutate();
            }}
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-semibold text-base ${isValid ? 'text-white' : 'text-gray-400'}`}>
                Submit Request
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success modal/toast */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/30">
          <View className="bg-white rounded-2xl px-6 py-5 items-center shadow-lg">
            <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mb-2">
              <Ionicons name="checkmark" size={26} color="#16A34A" />
            </View>
            <Text className="text-base font-semibold text-gray-900">Submitted</Text>
            <Text className="text-xs text-gray-500 mt-1">Your leave request was sent</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
