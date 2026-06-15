import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/lib/api';
import { STATUS_CONFIG } from '../../src/lib/canteenConfig';
import { useCanteenMenu } from '../../src/hooks/useCanteenMenu';
import { DateField } from '../../src/components/common/DateField';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  SegmentedTabs,
  StatusPill,
  IconCircle,
  rd,
} from '../../src/components/ui';

// ── Types (unchanged from original) ──────────────────────────────────────────

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

// ── Order status pill tone ────────────────────────────────────────────────────

type RdTone = 'active' | 'resolved' | 'cancelled' | 'pending' | 'neutral';

function orderStatusTone(status: PreOrder['status']): RdTone {
  switch (status) {
    case 'PENDING': return 'pending';
    case 'CONFIRMED': return 'active';
    case 'READY': return 'resolved';
    case 'COLLECTED': return 'resolved';
    case 'CANCELLED': return 'cancelled';
    default: return 'neutral';
  }
}

function orderStatusLabel(status: PreOrder['status']): string {
  return STATUS_CONFIG[status]?.label ?? status;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PreOrderScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { dishId: preselectedDishId } = useLocalSearchParams<{ dishId?: string }>();
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

  // Pre-add the dish passed via params (from dish detail screen)
  useEffect(() => {
    if (!preselectedDishId || dishes.length === 0) return;
    const dish = dishes.find((d) => d.id === preselectedDishId);
    if (!dish) return;
    setCart((prev) => {
      if (prev.some((c) => c.dishId === dish.id)) return prev;
      return [...prev, { dishId: dish.id, quantity: 1, name: dish.name, price: dish.price }];
    });
  }, [preselectedDishId, dishes.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const tabOptions = [
    { key: 'new' as const, label: 'New Order' },
    { key: 'orders' as const, label: 'My Orders' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Pre-Order" />

      {/* Tabs */}
      <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 4, paddingBottom: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -t.screenPadding, paddingHorizontal: t.screenPadding }}>
          <SegmentedTabs options={tabOptions} value={tab} onChange={setTab} />
        </ScrollView>
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
    </View>
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
  const t = useTheme();
  const canContinue = cartItemCount > 0;
  const canSubmit = pickupAt.trim().length > 0 && !submitting;

  // Step 2: Review + schedule
  if (step === 2) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingBottom: 40 }}
      >
        <Display size="sm" style={{ marginBottom: 14 }}>Your Order</Display>

        <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 20 }}>
          {cart.map((item, idx) => (
            <View
              key={item.dishId}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: rd.cardBorder,
              }}
            >
              <Text style={{ flex: 1, fontSize: t.fontBase, color: t.textPrimary, marginRight: 8 }}>
                {item.name} × {item.quantity}
              </Text>
              <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                ₹{item.price * item.quantity}
              </Text>
            </View>
          ))}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: rd.cardBorder,
            }}
          >
            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>Total</Text>
            <Text style={{ fontSize: t.fontLg, fontWeight: '700', color: t.textPrimary }}>₹{cartTotal}</Text>
          </View>
        </RoundCard>

        {/* Pickup time */}
        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 8 }}>
          Pickup Time <Text style={{ color: rd.crimson }}>*</Text>
        </Text>
        <View style={{ marginBottom: 20 }}>
          <DateField value={pickupAt} onChange={setPickupAt} mode="datetime" minimumDate={new Date()} placeholder="Pick pickup time" />
        </View>

        {/* Notes */}
        <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 8 }}>
          Notes <Text style={{ fontSize: t.fontSm, fontWeight: '400', color: t.textMuted }}>(optional)</Text>
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special requests or allergies..."
          placeholderTextColor={t.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={500}
          style={{
            minHeight: 100,
            borderRadius: rd.radiusInput,
            borderWidth: 1,
            borderColor: rd.cardBorder,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: t.fontBase,
            color: t.textPrimary,
            marginBottom: 28,
          }}
        />

        <View style={{ gap: 10 }}>
          <PillButton label="Place Order" tone="dark" onPress={onSubmit} disabled={!canSubmit} loading={submitting} />
          <PillButton label="Back to Menu" tone="ghost" onPress={onBack} />
        </View>
      </ScrollView>
    );
  }

  // Step 1: Menu
  if (menusLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accentPrimary} size="large" />
      </View>
    );
  }

  if (menusError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <IconCircle icon="alert-circle-outline" size={64} bg={rd.crimsonSoft} color={rd.crimson} style={{ marginBottom: 16 }} />
        <Display size="sm" align="center">Failed to load menu</Display>
        <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>
          Check your connection and try again.
        </Text>
        <PillButton label="Retry" tone="dark" fullWidth={false} onPress={() => refetchMenus()} style={{ paddingHorizontal: 32 }} />
      </View>
    );
  }

  if (dishes.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <IconCircle icon="restaurant-outline" size={72} bg={rd.inkSoft} color="rgba(0,0,0,0.3)" style={{ marginBottom: 16 }} />
        <Display size="sm" align="center">No dishes available</Display>
        <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 8, textAlign: 'center' }}>
          The canteen menu hasn't been set up yet.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentPrimary} />
        }
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingBottom: cartItemCount > 0 ? 140 : 40 }}
      >
        <View style={{ gap: 10 }}>
          {dishes.map((dish) => {
            const qty = getQty(dish.id);
            return (
              <DishPickerRow key={dish.id} dish={dish} qty={qty} adjustCart={adjustCart} />
            );
          })}
        </View>
      </ScrollView>

      {/* Cart footer */}
      {cartItemCount > 0 && (
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
        >
          <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconCircle icon="bag-handle-outline" size={36} bg={rd.crimsonSoft} color={t.accentPrimary} />
                <View>
                  <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                    {cartItemCount} item{cartItemCount > 1 ? 's' : ''}
                  </Text>
                  <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>in cart</Text>
                </View>
              </View>
              <Text style={{ fontSize: t.fontLg, fontWeight: '700', color: t.textPrimary }}>₹{cartTotal}</Text>
            </View>
            <PillButton label="Continue to Schedule" tone="dark" icon="chevron-forward" onPress={onContinue} disabled={!canContinue} />
          </View>
        </SafeAreaView>
      )}
    </>
  );
}

// ── Dish picker row ────────────────────────────────────────────────────────────

function DishPickerRow({
  dish,
  qty,
  adjustCart,
}: {
  dish: Dish;
  qty: number;
  adjustCart: (d: Dish, delta: number) => void;
}) {
  const t = useTheme();
  return (
    <RoundCard tone="white" padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Veg/non-veg dot */}
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: dish.isVeg ? rd.green : rd.crimson,
            marginRight: 12,
          }}
        />

        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: t.fontBase, fontWeight: '600', color: t.textPrimary }}>{dish.name}</Text>
          {dish.category ? (
            <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 2 }}>{dish.category}</Text>
          ) : null}
          <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: t.textPrimary, marginTop: 4 }}>
            ₹{dish.price}
          </Text>
        </View>

        {/* Quantity controls */}
        {qty === 0 ? (
          <TouchableOpacity
            onPress={() => adjustCart(dish, 1)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Add ${dish.name}`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: rd.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => adjustCart(dish, -1)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Remove one ${dish.name}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: rd.cardBorder,
                backgroundColor: rd.inkSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="remove" size={18} color={t.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, minWidth: 20, textAlign: 'center' }}>
              {qty}
            </Text>
            <TouchableOpacity
              onPress={() => adjustCart(dish, 1)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Add another ${dish.name}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: rd.ink,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </RoundCard>
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
  const t = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accentPrimary} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <IconCircle icon="alert-circle-outline" size={64} bg={rd.crimsonSoft} color={rd.crimson} style={{ marginBottom: 16 }} />
        <Display size="sm" align="center">Failed to load orders</Display>
        <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>
          Could not fetch your orders.
        </Text>
        <PillButton label="Retry" tone="dark" fullWidth={false} onPress={() => refetch()} style={{ paddingHorizontal: 32 }} />
      </View>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <IconCircle icon="bag-handle-outline" size={72} bg={rd.inkSoft} color="rgba(0,0,0,0.3)" style={{ marginBottom: 16 }} />
        <Display size="sm" align="center">No orders yet</Display>
        <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 8, textAlign: 'center' }}>
          Place your first pre-order from the New Order tab.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentPrimary} />
      }
      contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingBottom: 40 }}
    >
      <View style={{ gap: 12, marginTop: 4 }}>
        {orders.map((order) => {
          const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
          const total = order.totalAmount ?? order.items.reduce((s, i) => s + (i.dish?.price ?? 0) * i.quantity, 0);
          return (
            <RoundCard key={order.id} tone="white" padding={t.cardPaddingLg}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="time-outline" size={13} color={t.textMuted} />
                    <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>
                      Pickup: {formatPickupTime(order.pickupAt)}
                    </Text>
                  </View>
                </View>
                <StatusPill label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
              </View>

              {order.items.slice(0, 3).map((item, idx) => (
                <Text key={item.dish?.id ?? idx} style={{ fontSize: t.fontSm, color: t.textSecondary, marginBottom: 2 }}>
                  {item.dish?.name ?? 'Dish'} × {item.quantity}
                </Text>
              ))}
              {order.items.length > 3 ? (
                <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>+{order.items.length - 3} more</Text>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: rd.cardBorder,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="calendar-outline" size={12} color={t.textMuted} />
                  <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>
                    {new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </Text>
                </View>
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>₹{total}</Text>
              </View>
            </RoundCard>
          );
        })}
      </View>
    </ScrollView>
  );
}
