'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, UtensilsCrossed, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type MealType = 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';
type Tab = 'menu' | 'preorders';

interface Dish {
  id: string;
  name: string;
  price: number;
  calories: number;
  isVeg: boolean;
  allergens: string[];
}

interface Menu {
  id: string;
  date: string;
  mealType: string;
  dishes: Dish[];
}

interface AnalyticsResponse {
  topDishes: { name: string; count: number }[];
}

interface PreOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface PreOrder {
  id: string;
  status: string;
  total: number;
  pickupAt: string;
  items: PreOrderItem[];
  resident: {
    user: { name: string };
    flat?: { block?: string; number?: string };
  };
}

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];

const ORDER_STATUS_SEQUENCE: Record<string, string | null> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'READY',
  READY: 'COLLECTED',
  COLLECTED: null,
  CANCELLED: null,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  READY: 'bg-purple-100 text-purple-700',
  COLLECTED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getMondayOf(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return toISODate(mon);
}

const defaultDishForm = {
  name: '',
  isVeg: true,
  price: 0,
  calories: 0,
  allergens: '',
};

/**
 * `GET /canteen/menu?date=…` responds with every meal's menu for that date, as
 * an array — the `mealType` query parameter is accepted but the payload still
 * carries the whole day. Select the one this screen is showing.
 */
function pickMenu(res: Menu[] | Menu | null | undefined, mealType: string): Menu | null {
  if (!res) return null;
  const list = Array.isArray(res) ? res : [res];
  return list.find((m) => m?.mealType === mealType) ?? null;
}

export default function CanteenPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('menu');
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [selectedMealType, setSelectedMealType] = useState<MealType>('BREAKFAST');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(defaultDishForm);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(defaultDishForm);

  const today = toISODate(new Date());

  const { data: menu, isLoading, isError, refetch } = useQuery({
    queryKey: ['canteen-menu', selectedDate, selectedMealType],
    queryFn: () =>
      // The endpoint returns an ARRAY of menus for the date (one per meal).
      // Typing it as a single Menu meant `menu.dishes` was always undefined, so
      // the admin saw an empty menu while the resident app — which handles the
      // array — showed the dishes. That is the "dish is visible on the resident
      // app but not the admin dashboard" report.
      api
        .get<Menu[] | Menu>(`/canteen/menu?date=${selectedDate}&mealType=${selectedMealType}`)
        .then((res) => pickMenu(res, selectedMealType)),
    enabled: activeTab === 'menu',
  });

  const { data: analytics } = useQuery({
    queryKey: ['canteen-analytics'],
    queryFn: () => api.get<AnalyticsResponse>('/canteen/admin/canteen/analytics'),
  });

  const {
    data: preOrders,
    isLoading: preOrdersLoading,
    isError: preOrdersError,
    refetch: refetchPreOrders,
  } = useQuery({
    queryKey: ['canteen-preorders', today],
    queryFn: () => api.get<PreOrder[]>(`/canteen/pre-orders?date=${today}`),
    enabled: activeTab === 'preorders',
  });

  const deleteDishMutation = useMutation({
    mutationFn: (dishId: string) => api.delete(`/canteen/admin/canteen/dishes/${dishId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen-menu'] });
      toast.success('Dish deleted');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Delete failed'),
  });

  const addDishMutation = useMutation({
    mutationFn: async () => {
      let menuId = menu?.id;
      if (!menuId) {
        const newMenu = await api.post<Menu>('/canteen/admin/canteen/menus', {
          date: selectedDate,
          mealType: selectedMealType,
        });
        menuId = newMenu.id;
      }
      return api.post(`/canteen/admin/canteen/menus/${menuId}/dishes`, {
        ...addForm,
        name: addForm.name.trim(),
        price: Number(addForm.price),
        calories: Number(addForm.calories),
        allergens: addForm.allergens.split(',').map((s) => s.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen-menu'] });
      setShowAddForm(false);
      setAddForm(defaultDishForm);
      toast.success('Dish added');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to add dish'),
  });

  const updateDishMutation = useMutation({
    mutationFn: (dishId: string) =>
      api.patch(`/canteen/admin/canteen/dishes/${dishId}`, {
        ...editForm,
        name: editForm.name.trim(),
        price: Number(editForm.price),
        calories: Number(editForm.calories),
        allergens: editForm.allergens.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen-menu'] });
      setEditingDishId(null);
      toast.success('Dish updated');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Update failed'),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/canteen/pre-orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['canteen-preorders'] }),
    onError: (err: Error) => toast.error(err.message ?? 'Status update failed'),
  });

  const copyWeekMutation = useMutation({
    mutationFn: () => {
      const currentWeekStart = getMondayOf(new Date(selectedDate));
      const lastWeekStart = toISODate(
        new Date(new Date(currentWeekStart).setDate(new Date(currentWeekStart).getDate() - 7)),
      );
      return api.post<{ copied: number }>('/canteen/admin/canteen/menus/copy-week', {
        sourceWeekStart: lastWeekStart,
        targetWeekStart: currentWeekStart,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['canteen-menu'] });
      toast.success(`Copied ${data.copied} menu(s) from last week.`);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Copy failed'),
  });

  function shiftDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(toISODate(d));
  }

  function startEdit(dish: Dish) {
    setEditingDishId(dish.id);
    setEditForm({
      name: dish.name,
      isVeg: dish.isVeg,
      price: dish.price,
      calories: dish.calories,
      allergens: dish.allergens.join(', '),
    });
  }

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const dishes = menu?.dishes ?? [];
  const orders = preOrders ?? [];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canteen Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['menu', 'preorders'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {tab === 'menu' ? 'Menu' : 'Pre-orders'}
          </button>
        ))}
      </div>

      {activeTab === 'menu' && (
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1">
            {/* Date navigation + copy button */}
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => shiftDate(-1)}
                aria-label="Previous day"
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-800">{formattedDate}</span>
              <button
                onClick={() => shiftDate(1)}
                aria-label="Next day"
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="ml-auto">
                <button
                  onClick={() => {
                    if (window.confirm('Copy all menus from last week to this week? Existing menus will not be overwritten.')) {
                      copyWeekMutation.mutate();
                    }
                  }}
                  disabled={copyWeekMutation.isPending}
                  className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  {copyWeekMutation.isPending ? 'Copying…' : 'Copy from Last Week'}
                </button>
              </div>
            </div>

            {/* Meal type tabs */}
            <div className="flex gap-2 mb-5">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setSelectedMealType(mt)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    selectedMealType === mt
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {mt}
                </button>
              ))}
            </div>

            {/* Dishes table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto mb-4">
              {isLoading ? (
                <div className="py-16 text-center text-gray-400">Loading…</div>
              ) : isError ? (
                <ErrorState onRetry={refetch} message="Menu information couldn't be loaded. Your data is safe — please try again." />
              ) : dishes.length === 0 ? (
                <div className="py-16 text-center">
                  <UtensilsCrossed className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium text-gray-700">No dishes for this meal</p>
                  <p className="text-sm text-gray-400 mt-1 mb-4">Add a dish to start building this menu.</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Add Dish
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left px-5 py-3 font-medium">Name</th>
                      <th className="text-left px-5 py-3 font-medium">Veg</th>
                      <th className="text-left px-5 py-3 font-medium">Price</th>
                      <th className="text-left px-5 py-3 font-medium">Calories</th>
                      <th className="text-left px-5 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dishes.map((dish) =>
                      editingDishId === dish.id ? (
                        <tr key={dish.id} className="bg-primary-50">
                          <td className="px-5 py-2">
                            <input
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary-400"
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            />
                          </td>
                          <td className="px-5 py-2">
                            <input
                              type="checkbox"
                              checked={editForm.isVeg}
                              onChange={(e) => setEditForm((f) => ({ ...f, isVeg: e.target.checked }))}
                            />
                          </td>
                          <td className="px-5 py-2">
                            <input
                              type="number"
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary-400"
                              value={editForm.price}
                              onChange={(e) => setEditForm((f) => ({ ...f, price: Number(e.target.value) }))}
                            />
                          </td>
                          <td className="px-5 py-2">
                            <input
                              type="number"
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary-400"
                              value={editForm.calories}
                              onChange={(e) => setEditForm((f) => ({ ...f, calories: Number(e.target.value) }))}
                            />
                          </td>
                          <td className="px-5 py-2 flex gap-2">
                            <button
                              onClick={() => updateDishMutation.mutate(dish.id)}
                              disabled={updateDishMutation.isPending}
                              className="text-xs px-3 py-1 rounded-lg bg-primary-500 text-white font-medium disabled:opacity-40"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingDishId(null)}
                              className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={dish.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{dish.name}</td>
                          <td className="px-5 py-3">
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', dish.isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                              {dish.isVeg ? 'Veg' : 'Non-Veg'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-700">₹{dish.price}</td>
                          <td className="px-5 py-3 text-gray-700">{dish.calories} kcal</td>
                          <td className="px-5 py-3 flex gap-2">
                            <button
                              onClick={() => startEdit(dish)}
                              className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { if (window.confirm('Delete this dish?')) deleteDishMutation.mutate(dish.id); }}
                              disabled={deleteDishMutation.isPending}
                              className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add dish */}
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="text-sm font-medium text-primary-500 hover:underline mb-4 inline-flex items-center gap-1"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddForm ? 'Cancel' : 'Add Dish'}
            </button>

            {showAddForm && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                <h3 className="font-semibold text-gray-900 mb-4">Add Dish</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                      placeholder="Dish name *"
                      value={addForm.name}
                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <input
                    type="number"
                    className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                    placeholder="Price (₹)"
                    value={addForm.price || ''}
                    onChange={(e) => setAddForm((f) => ({ ...f, price: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                    placeholder="Calories (kcal)"
                    value={addForm.calories || ''}
                    onChange={(e) => setAddForm((f) => ({ ...f, calories: Number(e.target.value) }))}
                  />
                  <div className="col-span-2">
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-400"
                      placeholder="Allergens (comma-separated)"
                      value={addForm.allergens}
                      onChange={(e) => setAddForm((f) => ({ ...f, allergens: e.target.value }))}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer col-span-2">
                    <input
                      type="checkbox"
                      checked={addForm.isVeg}
                      onChange={(e) => setAddForm((f) => ({ ...f, isVeg: e.target.checked }))}
                      className="rounded"
                    />
                    Vegetarian
                  </label>
                </div>
                <button
                  onClick={() => addDishMutation.mutate()}
                  disabled={!addForm.name || addDishMutation.isPending}
                  className="mt-4 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                >
                  {addDishMutation.isPending ? 'Adding…' : 'Add Dish'}
                </button>
              </div>
            )}
          </div>

          {/* Analytics sidebar */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Top Dishes</h3>
              {!analytics?.topDishes?.length ? (
                <p className="text-sm text-gray-400">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topDishes.slice(0, 3).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                        <p className="text-xs text-gray-400">{d.count} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preorders' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Today&apos;s Pre-orders —{' '}
              {new Date(today + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <span className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            {preOrdersLoading ? (
              <div className="py-16 text-center text-gray-400">Loading…</div>
            ) : preOrdersError ? (
              <ErrorState onRetry={refetchPreOrders} message="Pre-orders couldn't be loaded. Please try again." />
            ) : orders.length === 0 ? (
              <div className="py-16 text-center">
                <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">No pre-orders for today</p>
                <p className="text-sm text-gray-400 mt-1">Resident orders will appear here as they come in.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 text-left">
                    <th className="px-5 py-3 font-medium">Resident</th>
                    <th className="px-5 py-3 font-medium">Unit</th>
                    <th className="px-5 py-3 font-medium">Items</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Pickup</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => {
                    const nextStatus = ORDER_STATUS_SEQUENCE[order.status];
                    const unit = order.resident.flat
                      ? `${order.resident.flat.block ?? ''}-${order.resident.flat.number ?? ''}`.replace(/^-|-$/, '')
                      : '—';
                    const pickupTime = order.pickupAt
                      ? new Date(order.pickupAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '—';
                    const itemSummary = Array.isArray(order.items)
                      ? order.items.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ')
                      : '—';

                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {order.resident.user.name ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{unit}</td>
                        <td className="px-5 py-3 text-gray-700 max-w-xs truncate" title={itemSummary}>
                          {itemSummary}
                        </td>
                        <td className="px-5 py-3 text-gray-700">₹{Number(order.total).toFixed(0)}</td>
                        <td className="px-5 py-3 text-gray-600">{pickupTime}</td>
                        <td className="px-5 py-3">
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600')}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {nextStatus ? (
                            <button
                              onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: nextStatus })}
                              disabled={updateOrderStatusMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-40"
                            >
                              Mark {STATUS_LABEL[nextStatus]}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
