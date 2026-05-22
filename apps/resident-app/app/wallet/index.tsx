import { ScrollView, View, Text, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { ErrorCard } from '../../src/components/ErrorCard';

// Lazy-load Razorpay so we don't crash in Expo Go where the native module isn't linked.
const getRazorpay = (): typeof import('react-native-razorpay').default | null => {
  try { return require('react-native-razorpay').default; } catch { return null; }
};

type RazorpayResult = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

type WalletBalance = { balance: number; currency: string };
type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
};

type TopUpStep = 'idle' | 'input' | 'confirm' | 'loading' | 'success' | 'error' | 'network-error';

export default function WalletScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [topUpStep, setTopUpStep] = useState<TopUpStep>('idle');
  const [amountText, setAmountText] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const { data: walletData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<WalletBalance>({
    queryKey: ['wallet-balance'],
    queryFn: () => api.get<WalletBalance>('/wallet/balance'),
  });

  const { data: transactions, isLoading: txLoading, isError: txError, refetch: refetchTx } = useQuery<Transaction[]>({
    queryKey: ['wallet-transactions'],
    queryFn: () => api.get<Transaction[]>('/wallet/transactions'),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchTx()]);
    setRefreshing(false);
  };

  const isLoading = balanceLoading || txLoading;

  const parsedAmount = parseInt(amountText, 10);
  const amountValid = !isNaN(parsedAmount) && parsedAmount >= 100 && parsedAmount <= 50000;

  async function handleConfirm() {
    setTopUpStep('loading');
    try {
      // Step 1: create the order on the backend.
      const order = await api.post<{ orderId: string; amount: number; currency?: string; key?: string }>(
        '/wallet/topup',
        { amount: parsedAmount },
      );

      // Step 2: open Razorpay sheet for the user to pay.
      const RazorpayCheckout = getRazorpay();
      if (!RazorpayCheckout) {
        // TODO: native module not linked (Expo Go). Call /verify with placeholders so the
        // backend rejects cleanly rather than silently crediting nothing.
        try {
          await api.post('/wallet/topup/verify', {
            orderId: order.orderId,
            paymentId: 'expo-go-placeholder',
            signature: 'expo-go-placeholder',
          });
        } catch {
          /* expected — backend HMAC check will fail */
        }
        setTopUpStep('error');
        return;
      }

      const options = {
        description: `Wallet top-up`,
        currency: order.currency ?? 'INR',
        amount: order.amount,
        order_id: order.orderId,
        key: order.key ?? process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? 'rzp_test_xxx',
        name: 'SocietyOS',
        prefill: { contact: '', email: '' },
        theme: { color: '#821A52' },
      };

      let paymentResult: RazorpayResult;
      try {
        paymentResult = (await RazorpayCheckout.open(options as any)) as RazorpayResult;
      } catch (rzErr: any) {
        // User cancelled or sheet error. Don't show the network/error card unless it's a real error.
        if (rzErr?.code === 'USER_CANCELLED' || rzErr?.code === 0 || /cancel/i.test(rzErr?.description ?? '')) {
          setTopUpStep('idle');
          return;
        }
        setTopUpStep('error');
        return;
      }

      // Step 3: verify with the backend so it credits the balance.
      const verified = await api.post<{ balance?: number }>('/wallet/topup/verify', {
        orderId: paymentResult.razorpay_order_id ?? order.orderId,
        paymentId: paymentResult.razorpay_payment_id,
        signature: paymentResult.razorpay_signature,
      });
      if (verified?.balance != null) setNewBalance(verified.balance);
      await refetchBalance();
      setTopUpStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('internet') || msg.includes('reach') || msg.includes('connection')) {
        setTopUpStep('network-error');
      } else {
        setTopUpStep('error');
      }
    }
  }

  function resetTopUp() {
    setTopUpStep('idle');
    setAmountText('');
    setNewBalance(null);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Wallet</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
        >
          {/* Balance Card */}
          <View className="bg-primary-50 border border-primary-100 rounded-3xl p-6 mb-6">
            <View className="flex-row items-center mb-2">
              <View className="w-10 h-10 rounded-xl bg-primary-100 items-center justify-center mr-3">
                <Ionicons name="wallet" size={20} color="#821A52" />
              </View>
              <Text className="text-xs font-semibold text-gray-500 tracking-wide">SOCIETY WALLET BALANCE</Text>
            </View>
            {balanceLoading ? (
              <View className="h-12 bg-gray-100 rounded-xl" />
            ) : (
              <Text className="text-gray-900 text-4xl font-extrabold tracking-tight">
                {walletData?.currency ?? '₹'}{walletData?.balance?.toLocaleString('en-IN') ?? '—'}
              </Text>
            )}

            {/* Top Up: idle button */}
            {topUpStep === 'idle' && (
              <TouchableOpacity
                onPress={() => setTopUpStep('input')}
                className="mt-5 bg-primary-500 rounded-2xl py-4 items-center flex-row justify-center gap-2"
                accessibilityRole="button"
                accessibilityLabel="Top up wallet"
              >
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text className="text-white text-base font-bold">Top Up</Text>
              </TouchableOpacity>
            )}

            {/* Top Up: amount input */}
            {topUpStep === 'input' && (
              <View className="mt-5">
                <Text className="text-gray-500 text-sm mb-2">Enter amount (₹100 – ₹50,000)</Text>
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="numeric"
                  placeholder="e.g. 500"
                  placeholderTextColor="#9CA3AF"
                  className="bg-gray-100 rounded-xl border border-gray-200 text-gray-900 text-xl font-bold p-4 mb-3"
                  autoFocus
                  accessibilityLabel="Top up amount in rupees"
                />
                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={resetTopUp}
                    className="flex-1 rounded-2xl py-4 items-center border border-gray-200 bg-white"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel top up"
                  >
                    <Text className="text-gray-500 text-base">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setTopUpStep('confirm')}
                    disabled={!amountValid}
                    className={`flex-[2] rounded-2xl py-4 items-center ${amountValid ? 'bg-primary-500' : 'bg-primary-200'}`}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to confirm"
                  >
                    <Text className="text-white text-base font-bold">Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Top Up: confirm */}
            {topUpStep === 'confirm' && (
              <View className="mt-5">
                <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
                  <Text className="text-gray-500 text-sm mb-1">You are about to add</Text>
                  <Text className="text-gray-900 text-3xl font-extrabold">₹{parsedAmount.toLocaleString('en-IN')}</Text>
                  <Text className="text-gray-500 text-sm mt-1">to your society wallet.</Text>
                </View>
                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={() => setTopUpStep('input')}
                    className="flex-1 rounded-2xl py-4 items-center border border-gray-200 bg-white"
                    accessibilityRole="button"
                    accessibilityLabel="Go back and change amount"
                  >
                    <Text className="text-gray-500 text-base">Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirm}
                    className="flex-[2] bg-primary-500 rounded-2xl py-4 items-center"
                    accessibilityRole="button"
                    accessibilityLabel={`Confirm adding ₹${parsedAmount} to wallet`}
                  >
                    <Text className="text-white text-base font-bold">Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Top Up: loading */}
            {topUpStep === 'loading' && (
              <View className="mt-5 items-center py-2">
                <ActivityIndicator color="#821A52" size="large" />
                <Text className="text-gray-500 text-sm mt-2.5">Processing your top-up...</Text>
              </View>
            )}

            {/* Top Up: success */}
            {topUpStep === 'success' && (
              <View className="mt-5 bg-green-50 border border-green-200 rounded-2xl p-4">
                <View className="items-center mb-2">
                  <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
                </View>
                <Text className="text-green-700 text-base font-bold text-center mb-1">
                  ₹{parsedAmount.toLocaleString('en-IN')} added successfully!
                </Text>
                {newBalance !== null && (
                  <Text className="text-gray-600 text-sm text-center mb-3">
                    Your new balance is ₹{newBalance.toLocaleString('en-IN')}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={resetTopUp}
                  className="bg-green-100 rounded-xl py-3 items-center"
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                >
                  <Text className="text-green-700 text-sm font-semibold">Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Top Up: error */}
            {topUpStep === 'error' && (
              <View className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <View className="items-center mb-2">
                  <Ionicons name="alert-circle" size={32} color="#D97706" />
                </View>
                <Text className="text-amber-800 text-sm text-center leading-5 mb-3">
                  Your top-up did not go through. Don't worry — no money has been deducted. Please try again.
                </Text>
                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={resetTopUp}
                    className="flex-1 rounded-xl py-3 items-center border border-gray-200 bg-white"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                  >
                    <Text className="text-gray-500 text-sm">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirm}
                    className="flex-[2] bg-amber-500 rounded-xl py-3 items-center"
                    accessibilityRole="button"
                    accessibilityLabel="Try again"
                  >
                    <Text className="text-white text-sm font-bold">Try Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Top Up: network error */}
            {topUpStep === 'network-error' && (
              <View className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <View className="items-center mb-2">
                  <Ionicons name="cloud-offline" size={32} color="#D97706" />
                </View>
                <Text className="text-amber-800 text-sm text-center leading-5 mb-3">
                  We couldn't connect. Please check your internet and try again.
                </Text>
                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={resetTopUp}
                    className="flex-1 rounded-xl py-3 items-center border border-gray-200 bg-white"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                  >
                    <Text className="text-gray-500 text-sm">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirm}
                    className="flex-[2] bg-amber-500 rounded-xl py-3 items-center"
                    accessibilityRole="button"
                    accessibilityLabel="Try again"
                  >
                    <Text className="text-white text-sm font-bold">Try Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Transactions */}
          <Text className="text-xs font-semibold text-gray-500 mb-3 tracking-wide">TRANSACTION HISTORY</Text>

          {isLoading && [1, 2, 3, 4].map((i: any) => (
            <View key={i} className="bg-gray-50 rounded-2xl h-16 mb-2" />
          ))}

          {txError && (
            <ErrorCard
              message="Your transaction history couldn't be loaded. Please try again — your wallet balance is safe."
              onRetry={() => refetchTx()}
              retryLabel="Reload Transactions"
            />
          )}

          {!isLoading && !txError && transactions?.length === 0 && (
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-8 items-center">
              <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
                <Ionicons name="card" size={32} color="#821A52" />
              </View>
              <Text className="text-gray-900 text-base font-semibold">No transactions yet</Text>
            </View>
          )}

          {transactions?.map((tx: any) => {
            const isCredit = tx.type === 'CREDIT' || tx.amount > 0;
            return (
              <View key={tx.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 mb-2 flex-row items-center">
                <View className={`w-11 h-11 rounded-xl mr-3 items-center justify-center ${isCredit ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Ionicons name={isCredit ? 'arrow-down' : 'arrow-up'} size={20} color={isCredit ? '#16A34A' : '#DC2626'} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-semibold">{tx.description}</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Text className={`text-base font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                  {isCredit ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
