'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, UtensilsCrossed } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type MealType = 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';

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

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];

const defaultForm = { name: '', isVeg: true, price: 0, calories: 0, allergens: '' };

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function MenuEditorPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(toISODate(new Date()));
  const [meal, setMeal] = useState<MealType>('BREAKFAST');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: menu, isLoading, isError, refetch } = useQuery({
    queryKey: ['canteen-menu', date, meal],
    queryFn: () => api.get<Menu>(`/canteen/menu?date=${date}&mealType=${meal}`),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      let menuId = menu?.id;
      if (!menuId) {
        const m = await api.post<Menu>('/canteen/admin/canteen/menus', { date, mealType: meal });
        menuId = m.id;
      }
      return api.post(`/canteen/admin/canteen/menus/${menuId}/dishes`, {
        ...form,
        name: form.name.trim(),
        price: Number(form.price),
        calories: Number(form.calories),
        allergens: form.allergens.split(',').map((s) => s.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen-menu'] });
      setShowAdd(false);
      setForm(defaultForm);
      toast.success('Dish added');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to add dish'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/canteen/admin/canteen/dishes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen-menu'] });
      toast.success('Dish deleted');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Delete failed'),
  });

  const dishes = menu?.dishes ?? [];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Menu Editor</h1>
        <p className="text-gray-500 text-sm mt-1">Configure meals by date</p>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
        />
        <div className="flex gap-2">
          {MEAL_TYPES.map((mt) => (
            <button
              key={mt}
              onClick={() => setMeal(mt)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                meal === mt
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {mt.charAt(0) + mt.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

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
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Dish
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name', 'Type', 'Price', 'Calories', 'Allergens', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dishes.map((dish) => (
                <tr key={dish.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{dish.name}</td>
                  <td className="px-5 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', dish.isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {dish.isVeg ? 'Veg' : 'Non-Veg'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">₹{dish.price}</td>
                  <td className="px-5 py-3 text-gray-700">{dish.calories} kcal</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{dish.allergens.join(', ') || '—'}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => { if (window.confirm('Delete this dish?')) deleteMutation.mutate(dish.id); }}
                      disabled={deleteMutation.isPending}
                      className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button
        onClick={() => setShowAdd((v) => !v)}
        className="text-sm font-medium text-primary-500 hover:underline mb-4 inline-flex items-center gap-1"
      >
        {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {showAdd ? 'Cancel' : 'Add Dish'}
      </button>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Add Dish</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                placeholder="Dish name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <input
              type="number"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
              placeholder="Price (₹)"
              value={form.price || ''}
              onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
            />
            <input
              type="number"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
              placeholder="Calories (kcal)"
              value={form.calories || ''}
              onChange={(e) => setForm((f) => ({ ...f, calories: Number(e.target.value) }))}
            />
            <div className="col-span-2">
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                placeholder="Allergens (comma-separated)"
                value={form.allergens}
                onChange={(e) => setForm((f) => ({ ...f, allergens: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer col-span-2">
              <input
                type="checkbox"
                checked={form.isVeg}
                onChange={(e) => setForm((f) => ({ ...f, isVeg: e.target.checked }))}
              />
              Vegetarian
            </label>
          </div>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!form.name || addMutation.isPending}
            className="mt-4 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {addMutation.isPending ? 'Adding…' : 'Add Dish'}
          </button>
        </div>
      )}
    </div>
  );
}
