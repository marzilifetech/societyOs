import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { STATUS_CONFIG } from '../../src/lib/canteenConfig';
import { useCanteenMenu } from '../../src/hooks/useCanteenMenu';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { DateField } from '../../src/components/common/DateField';

// ── Types ──────────────────────────────────────────────────────────────────────

type Dish = {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  calories?: number;
  category?: string;
};

type Menu = {
  id: string;
  date: string;
  mealType: string;
  dishes?: Dish[];
};

type CartItem = { dishId: string; quantity: number; name: string; price: number };

type PreOrderItem = { dishId: string; quantity: number };

type PreOrder = {
  id: string;
  items: { dish: Dish; quantity: number }[];
  pickupAt: string;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'READY' | 'COLLECTED' | 'CANCELLED';
  totalAmount?: number;
  createdAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function allDishesFromMenus(menus: Menu[]): Dish[] {
  const seen = new Set<string>();
  const out: Dish[] = [];
  for (const m of menus) {
    for (const d of m.dishes ?? []) {
      if (!seen.has(d.id)) { seen.add(d.id); out.push(d); }
    }
  }
  return out;
}

function formatPickupTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function PreOrderScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'new' | 'orders'>('new');
  const [step, setStep] = useState<1 | 2>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickupAt, setPickupAt] = useState('');
  const [notes, setNotes] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    menus, menusLoading, menusError, refetchMenus,
    orders: myOrders, ordersLoading, ordersError, refetchOrders,
  } = useCanteenMenu(tab === 'orders');

  const dishes = menus ? allDishesFromMenus(menus) : [];

  const getQty = (dishId: string) => cart.find((c) => c.dishId === dishId)?.quantity ?? 0;

  const adjustCart = (dish: Dish, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.dishId === dish.id);
      const newQty = (existing?.quantity ?? 0) + delta;
      if (newQty <= 0) return prev.filter((c) => c.dishId !== dish.id);
      if (existing) return prev.map((c) => c.dishId === dish.id ? { ...c, quantity: newQty } : c);
      return [...prev, { dishId: dish.id, quantity: 1, name: dish.name, price: dish.price }];
    });
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const submitMutation = useMutation<PreOrder, Error>({
    mutationFn: () => {
      const items: PreOrderItem[] = cart.map((c) => ({ dishId: c.dishId, quantity: c.quantity }));
      return api.post<PreOrder>('/canteen/pre-orders', { items, pickupAt, notes: notes.trim() || undefined });
    },
    onSuccess: (data: PreOrder) => {
      qc.invalidateQueries({ queryKey: ['canteen-pre-orders'] });
      setCart([]);
      setPickupAt('');
      setNotes('');
      setStep(1);
      Alert.alert('Order placed!', `Ready at ${formatPickupTime(data.pickupAt)}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await (tab === 'orders' ? refetchOrders() : refetchMenus());
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#821A52" />
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-bold text-gray-900">Pre-Order</Text>
          <Text className="text-sm text-gray-500">Order ahead for pickup</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row mx-6 mb-4 bg-gray-100 rounded-2xl p-1">
        {(['new', 'orders'] as const).map((tabKey) => {
          const isActive = tab === tabKey;
          return (
            <TouchableOpacity
              key={tabKey}
              onPress={() => setTab(tabKey)}
              className={`flex-1 rounded-xl items-center justify-center min-h-[40px] ${isActive ? 'bg-white' : ''}`}
              style={isActive ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 } : undefined}
              accessibilityRole="button"
              accessibilityLabel={tabKey === 'new' ? 'New Order tab' : 'My Orders tab'}
            >
              <Text className={`font-semibold text-sm ${isActive ? 'text-primary-500' : 'text-gray-500'}`}>
                {tabKey === 'new' ? 'New Order' : 'My Orders'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'new' ? (
        <NewOrderView
          step={step}
          dishes={dishes}
          menusLoading={menusLoading}
          menusError={menusError}
          cart={cart}
          cartTotal={cartTotal}
          cartItemCount={cartItemCount}
          getQty={getQty}
          adjustCart={adjustCart}
          pickupAt={pickupAt}
          setPickupAt={setPickupAt}
          notes={notes}
          setNotes={setNotes}
          onContinue={() => setStep(2)}
          onBack={() => setStep(1)}
          onSubmit={() => submitMutation.mutate()}
          submitting={submitMutation.isPending}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          refetchMenus={refetchMenus}
        />
      ) : (
        <MyOrdersView
          orders={myOrders}
          isLoading={ordersLoading}
          isError={ordersError}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          refetch={refetchOrders}
        />
      )}
    </SafeAreaView>
  );
}

// ── New Order view ─────────────────────────────────────────────────────────────

function NewOrderView({
  step, dishes, menusLoading, menusError,
  cart, cartTotal, cartItemCount,
  getQty, adjustCart,
  pickupAt, setPickupAt, notes, setNotes,
  onContinue, onBack, onSubmit, submitting,
  refreshing, onRefresh, refetchMenus,
}: {
  step: 1 | 2;
  dishes: Dish[];
  menusLoading: boolean;
  menusError: boolean;
  cart: CartItem[];
  cartTotal: number;
  cartItemCount: number;
  getQty: (id: string) => number;
  adjustCart: (d: Dish, delta: number) => void;
  pickupAt: string;
  setPickupAt: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  refetchMenus: () => void;
}) {
  const canContinue = cartItemCount > 0;
  const canSubmit = pickupAt.trim().length > 0 && !submitting;

  if (step === 2) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        <Text className="text-lg font-semibold text-gray-900 mb-3">Your Order</Text>
        {cart.map((item) => (
          <View key={item.dishId} className="flex-row justify-between py-2 border-b border-gray-200">
            <Text className="text-base text-gray-700 flex-1">{item.name} × {item.quantity}</Text>
            <Text className="text-base font-bold text-primary-500">₹{item.price * item.quantity}</Text>
          </View>
        ))}
        <View className="flex-row justify-between mt-3 mb-6">
          <Text className="text-base font-bold text-gray-900">Total</Text>
          <Text className="text-base font-bold text-primary-500">₹{cartTotal}</Text>
        </View>

        {/* Pickup time */}
        <View className="flex-row items-center gap-1.5 mb-1.5">
          <Ionicons name="time" size={16} color="#374151" />
          <Text className="font-semibold text-sm text-gray-900">Pickup Time *</Text>
        </View>
        <View className="mb-5">
          <DateField value={pickupAt} onChange={setPickupAt} mode="datetime" minimumDate={new Date()} placeholder="Pick pickup time" />
        </View>

        {/* Notes */}
        <View className="flex-row items-center gap-1.5 mb-1.5">
          <Ionicons name="create-outline" size={16} color="#374151" />
          <Text className="font-semibold text-sm text-gray-900">Notes (Optional)</Text>
        </View>
        <TextInput
          className="bg-gray-100 rounded-2xl px-4 py-3 text-base text-gray-900 mb-7"
          style={{ minHeight: 100, textAlignVertical: 'top' }}
          placeholder="Any special requests or allergies..."
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={onBack}
            className="flex-1 border border-gray-200 bg-gray-50 rounded-2xl items-center justify-center"
            style={{ minHeight: 48 }}
            accessibilityRole="button"
            accessibilityLabel="Back to menu"
          >
            <Text className="text-gray-700 font-semibold text-base">Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit}
            className={`rounded-2xl items-center justify-center ${canSubmit ? 'bg-primary-500' : 'bg-gray-200'}`}
            style={{ flex: 2, minHeight: 48 }}
            accessibilityRole="button"
            accessibilityLabel="Place pre-order"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-semibold text-base ${canSubmit ? 'text-white' : 'text-gray-400'}`}>
                Place Order
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Step 1 — Menu
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#821A52" />
      }
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {menusLoading ? (
        <View className="items-center justify-center py-20">
          <ActivityIndicator color="#821A52" size="large" />
        </View>
      ) : menusError ? (
        <View className="items-center py-20 px-8">
          <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-3">
            <Ionicons name="alert-circle" size={32} color="#DC2626" />
          </View>
          <Text className="text-lg font-semibold text-gray-900 mb-2">Failed to load menu</Text>
          <TouchableOpacity
            onPress={() => refetchMenus()}
            className="bg-primary-500 rounded-2xl px-6 py-3 mt-2"
            accessibilityRole="button"
            accessibilityLabel="Retry loading menu"
          >
            <Text className="text-white font-semibold text-base">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : dishes.length === 0 ? (
        <View className="items-center py-20 px-8">
          <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="restaurant-outline" size={40} color="#821A52" />
          </View>
          <Text className="text-lg font-semibold text-gray-900 mb-1">No dishes available</Text>
          <Text className="text-sm text-gray-500 text-center">The canteen menu hasn't been set up yet.</Text>
        </View>
      ) : (
        <View className="px-6 gap-3">
          {dishes.map((dish) => {
            const qty = getQty(dish.id);
            return (
              <View
                key={dish.id}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-row items-center"
              >
                <View
                  className={`w-6 h-6 rounded items-center justify-center mr-3 ${dish.isVeg ? 'bg-green-100' : 'bg-red-100'}`}
                >
                  <Ionicons
                    name={dish.isVeg ? 'leaf' : 'flame'}
                    size={14}
                    color={dish.isVeg ? '#16A34A' : '#DC2626'}
                  />
                </View>
                <View className="flex-1 mr-3">
                  <Text className="text-base font-semibold text-gray-900">{dish.name}</Text>
                  {dish.category ? (
                    <Text className="text-xs text-gray-400 mt-0.5">{dish.category}</Text>
                  ) : null}
                  <Text className="text-sm font-bold text-primary-500 mt-0.5">₹{dish.price}</Text>
                </View>
                {qty === 0 ? (
                  <TouchableOpacity
                    onPress={() => adjustCart(dish, 1)}
                    className="bg-primary-500 rounded-xl px-4 flex-row items-center justify-center gap-1"
                    style={{ minWidth: 44, minHeight: 40 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${dish.name} to cart`}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm">Add</Text>
                  </TouchableOpacity>
                ) : (
                  <View className="flex-row items-center gap-1.5">
                    <TouchableOpacity
                      onPress={() => adjustCart(dish, -1)}
                      className="bg-gray-100 border border-gray-200 rounded-xl items-center justify-center"
                      style={{ width: 36, height: 36 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove one ${dish.name}`}
                    >
                      <Ionicons name="remove" size={18} color="#374151" />
                    </TouchableOpacity>
                    <Text className="text-base font-bold text-gray-900 text-center" style={{ minWidth: 24 }}>{qty}</Text>
                    <TouchableOpacity
                      onPress={() => adjustCart(dish, 1)}
                      className="bg-primary-500 rounded-xl items-center justify-center"
                      style={{ width: 36, height: 36 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Add another ${dish.name}`}
                    >
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Cart footer */}
      {cartItemCount > 0 && (
        <View className="mx-6 mt-5">
          <View className="bg-primary-50 border border-primary-500/30 rounded-2xl p-4 flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="bag-handle" size={20} color="#821A52" />
              <View>
                <Text className="font-bold text-base text-gray-900">{cartItemCount} item{cartItemCount > 1 ? 's' : ''}</Text>
                <Text className="text-sm text-gray-500">in your cart</Text>
              </View>
            </View>
            <Text className="text-lg font-bold text-primary-500">₹{cartTotal}</Text>
          </View>
          <TouchableOpacity
            onPress={onContinue}
            disabled={!canContinue}
            className="bg-primary-500 rounded-2xl items-center justify-center flex-row gap-2"
            style={{ minHeight: 48 }}
            accessibilityRole="button"
            accessibilityLabel="Continue to schedule pickup"
          >
            <Text className="text-white font-semibold text-base">Continue to Schedule</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ── My Orders view ─────────────────────────────────────────────────────────────

function MyOrdersView({
  orders, isLoading, isError, refreshing, onRefresh, refetch,
}: {
  orders?: PreOrder[];
  isLoading: boolean;
  isError: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  refetch: () => void;
}) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#821A52" size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-3">
          <Ionicons name="alert-circle" size={32} color="#DC2626" />
        </View>
        <Text className="text-lg font-semibold text-gray-900 mb-2">Failed to load orders</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="bg-primary-500 rounded-2xl px-6 py-3 mt-2"
          accessibilityRole="button"
          accessibilityLabel="Retry loading orders"
        >
          <Text className="text-white font-semibold text-base">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#821A52" />
      }
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
    >
      {!orders || orders.length === 0 ? (
        <View className="items-center py-20">
          <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="bag-handle-outline" size={40} color="#821A52" />
          </View>
          <Text className="text-lg font-semibold text-gray-900 mb-1">No orders yet</Text>
          <Text className="text-sm text-gray-500 text-center">Place your first pre-order from the New Order tab.</Text>
        </View>
      ) : (
        <View className="gap-3 mt-1">
          {orders.map((order) => {
            const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
            const total = order.totalAmount ?? order.items.reduce((s, i) => s + (i.dish?.price ?? 0) * i.quantity, 0);
            return (
              <View
                key={order.id}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="font-semibold text-base text-gray-900">
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </Text>
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons name="time-outline" size={12} color="#6B7280" />
                      <Text className="text-sm text-gray-500">
                        Pickup: {formatPickupTime(order.pickupAt)}
                      </Text>
                    </View>
                  </View>
                  <StatusBadge status={order.status} config={STATUS_CONFIG} />
                </View>

                {order.items.slice(0, 3).map((item, idx) => (
                  <Text key={idx} className="text-sm text-gray-700 mb-0.5">
                    {item.dish?.name ?? 'Dish'} × {item.quantity}
                  </Text>
                ))}
                {order.items.length > 3 ? (
                  <Text className="text-sm text-gray-400">+{order.items.length - 3} more</Text>
                ) : null}

                <View className="flex-row justify-between mt-2.5 pt-2.5 border-t border-gray-200">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <Text className="font-bold text-base text-primary-500">₹{total}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
