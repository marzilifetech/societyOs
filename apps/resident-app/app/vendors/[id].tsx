import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { DateField } from '../../src/components/common/DateField';

type Vendor = {
  id: string;
  name: string;
  category: string;
  phone: string;
};

type OrderItem = {
  name: string;
  quantity: string;
  price: string;
};

type Order = {
  id: string;
  vendorId: string;
  status: string;
  total: number;
  createdAt: string;
  items?: OrderItem[];
};

const ORDER_STATUS_META: Record<string, { bgClass: string; textClass: string; label: string }> = {
  PENDING: { bgClass: 'bg-amber-100', textClass: 'text-amber-700', label: 'Pending' },
  CONFIRMED: { bgClass: 'bg-primary-100', textClass: 'text-primary-700', label: 'Confirmed' },
  DELIVERED: { bgClass: 'bg-green-100', textClass: 'text-green-700', label: 'Delivered' },
  CANCELLED: { bgClass: 'bg-red-100', textClass: 'text-red-700', label: 'Cancelled' },
};

function fmt(n: number) {
  return `₹${n.toFixed(2)}`;
}

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<OrderItem[]>([{ name: '', quantity: '1', price: '' }]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: vendor, isLoading: vendorLoading, isError: vendorError } = useQuery<Vendor>({
    queryKey: ['vendor', id],
    queryFn: () => api.get<Vendor>(`/vendors/${id}`),
    enabled: !!id,
  });

  const { data: orders, isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ['vendor-orders', id],
    queryFn: () => api.get<Order[]>(`/vendors/orders/mine?vendorId=${id}`),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (body: object) => api.post(`/vendors/${id}/orders`, body),
    onSuccess: () => {
      Alert.alert('Order placed!', 'Your order has been submitted to the vendor.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchOrders();
    setRefreshing(false);
  };

  const addItem = () => setItems((prev) => [...prev, { name: '', quantity: '1', price: '' }]);

  const updateItem = (idx: number, field: keyof OrderItem, value: string) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const total = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.price) || 0;
    return sum + qty * price;
  }, 0);

  const handleSubmit = () => {
    const validItems = items.filter((it) => it.name.trim() && it.quantity && it.price);
    if (validItems.length === 0) {
      Alert.alert('Required', 'Add at least one item with name, quantity, and price.');
      return;
    }
    mutation.mutate({ items: validItems, notes: notes.trim() || undefined, deliveryDate: deliveryDate.trim() || undefined });
  };

  if (vendorError) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center p-8">
        <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
          <Ionicons name="alert-circle" size={32} color="#821A52" />
        </View>
        <Text className="text-gray-500 text-base mb-4">Could not load vendor</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-primary-500 rounded-2xl px-6 py-3">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2" accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-xl font-bold flex-1" numberOfLines={1}>
          {vendorLoading ? 'Loading…' : vendor?.name ?? 'Vendor'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#821A52" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
      >
        {/* Vendor info card */}
        {vendor && (
          <View className="bg-gray-50 border border-gray-200 rounded-3xl p-4 mb-6">
            <View className="flex-row items-center mb-2">
              <View className="w-11 h-11 rounded-xl bg-primary-50 items-center justify-center mr-3">
                <Ionicons name="storefront" size={20} color="#821A52" />
              </View>
              <Text className="text-gray-900 text-xl font-extrabold">{vendor.name}</Text>
            </View>
            <View className="flex-row items-center mb-1 gap-1.5">
              <Ionicons name="business" size={14} color="#6B7280" />
              <Text className="text-gray-500 text-sm">{vendor.category}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="call" size={14} color="#6B7280" />
              <Text className="text-gray-500 text-sm">{vendor.phone}</Text>
            </View>
          </View>
        )}

        {/* Place Order */}
        <Text className="text-gray-500 text-xs font-bold mb-3 tracking-wide">PLACE ORDER</Text>

        {items.map((item, idx) => (
          <View key={idx} className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 mb-2.5">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-500 text-xs font-bold">ITEM {idx + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(idx)} className="px-2 py-1">
                  <Text className="text-red-600 text-[13px]">Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              value={item.name}
              onChangeText={(v) => updateItem(idx, 'name', v)}
              placeholder="Item name"
              placeholderTextColor="#9CA3AF"
              className="bg-gray-100 rounded-xl border border-gray-200 text-gray-900 text-[15px] p-3 min-h-[48px] mb-2"
            />
            <View className="flex-row gap-2">
              <TextInput
                value={item.quantity}
                onChangeText={(v) => updateItem(idx, 'quantity', v)}
                placeholder="Qty"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                className="bg-gray-100 rounded-xl border border-gray-200 text-gray-900 text-[15px] p-3 min-h-[48px] flex-1"
              />
              <TextInput
                value={item.price}
                onChangeText={(v) => updateItem(idx, 'price', v)}
                placeholder="Price (₹)"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                className="bg-gray-100 rounded-xl border border-gray-200 text-gray-900 text-[15px] p-3 min-h-[48px] flex-[2]"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={addItem}
          className="rounded-2xl border border-primary-200 py-3 items-center mb-4 min-h-[48px] justify-center flex-row gap-1.5"
        >
          <Ionicons name="add" size={18} color="#821A52" />
          <Text className="text-primary-500 font-bold">Add Item</Text>
        </TouchableOpacity>

        <Text className="text-gray-500 text-xs font-bold mb-2 tracking-wide">NOTES</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Special instructions…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          style={{ textAlignVertical: 'top' }}
          className="bg-gray-100 rounded-xl border border-gray-200 text-gray-900 text-[15px] p-3 min-h-[90px] mb-4"
        />

        <View className="mb-4">
          <DateField label="Delivery Date" value={deliveryDate} onChange={(iso) => setDeliveryDate(iso.slice(0, 10))} mode="date" minimumDate={new Date()} />
        </View>

        {/* Running total */}
        <View className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex-row justify-between items-center mb-5">
          <Text className="text-gray-500 text-[15px] font-semibold">Order Total</Text>
          <Text className="text-primary-500 text-2xl font-extrabold">{fmt(total)}</Text>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="bg-primary-500 rounded-2xl py-4 items-center min-h-[56px] mb-8"
        >
          <Text className="text-white text-[17px] font-bold">
            {mutation.isPending ? 'Placing Order…' : 'Place Order'}
          </Text>
        </TouchableOpacity>

        {/* My Orders */}
        <Text className="text-gray-500 text-xs font-bold mb-3 tracking-wide">MY ORDERS</Text>

        {ordersLoading && [1, 2].map((i) => (
          <View key={i} className="bg-gray-50 rounded-2xl h-[70px] mb-2.5" />
        ))}

        {ordersError && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 items-center mb-4">
            <Text className="text-gray-500 text-sm mb-2">Could not load orders</Text>
            <TouchableOpacity onPress={() => refetchOrders()}>
              <Text className="text-primary-500 text-[13px] font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!ordersLoading && !ordersError && orders?.length === 0 && (
          <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 items-center mb-4">
            <Text className="text-gray-400 text-sm">No orders yet</Text>
          </View>
        )}

        {orders?.map((order: Order) => {
          const meta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.PENDING;
          return (
            <View key={order.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 mb-2.5 flex-row justify-between items-center">
              <View>
                <Text className="text-gray-900 text-sm font-semibold">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                <Text className="text-gray-500 text-[13px] mt-0.5">{fmt(order.total)}</Text>
              </View>
              <View className={`rounded-full px-2.5 py-1 ${meta.bgClass}`}>
                <Text className={`text-xs font-bold ${meta.textClass}`}>{meta.label}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
