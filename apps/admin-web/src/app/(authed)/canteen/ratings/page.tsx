'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, X, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

interface DishRating {
  dishId: string;
  dishName: string;
  mealType: string;
  avgRating: number;
  reviewCount: number;
  reviews?: { residentName: string; rating: number; comment: string; date: string }[];
}

const MEAL_TYPES = ['ALL', 'BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn('w-4 h-4', s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300')}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function RatingsPage() {
  const [mealFilter, setMealFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDish, setSelectedDish] = useState<DishRating | null>(null);

  // TODO: backend has no aggregated ratings endpoint yet (`/canteen/admin/canteen/ratings`).
  // The page renders an empty state until that endpoint ships.
  const { data: ratings, isLoading, isError, refetch } = useQuery({
    queryKey: ['canteen-ratings', mealFilter, fromDate, toDate],
    queryFn: () => {
      const p = new URLSearchParams();
      if (mealFilter !== 'ALL') p.set('mealType', mealFilter);
      if (fromDate) p.set('from', fromDate);
      if (toDate) p.set('to', toDate);
      return api.get<DishRating[]>(`/canteen/admin/canteen/ratings?${p.toString()}`);
    },
    retry: false,
  });

  // TODO: backend has no per-dish reviews endpoint yet.
  const { data: dishReviews } = useQuery({
    queryKey: ['canteen-dish-reviews', selectedDish?.dishId],
    queryFn: () => api.get<DishRating>(`/canteen/admin/canteen/dishes/${selectedDish!.dishId}/reviews`),
    enabled: !!selectedDish,
    retry: false,
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dish Ratings</h1>
        <p className="text-gray-500 text-sm mt-1">Ranked by average resident rating</p>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        {MEAL_TYPES.map((mt) => (
          <button
            key={mt}
            onClick={() => setMealFilter(mt)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              mealFilter === mt
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {mt === 'ALL' ? 'All Meals' : mt.charAt(0) + mt.slice(1).toLowerCase()}
          </button>
        ))}
        <div className="flex gap-2 ml-auto">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} message="Ratings information couldn't be loaded. Your data is safe — please try again." />
        ) : !ratings?.length ? (
          <div className="py-16 text-center">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No ratings yet</p>
            <p className="text-sm text-gray-400 mt-1">Resident dish ratings will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Rank', 'Dish', 'Meal', 'Avg Rating', 'Reviews', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ratings.map((r, i) => (
                <tr key={r.dishId} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <span className={cn(
                      'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
                      i === 0 ? 'bg-amber-100 text-amber-600' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' : 'text-gray-500'
                    )}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.dishName}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{r.mealType}</span>
                  </td>
                  <td className="px-5 py-3"><StarDisplay rating={r.avgRating} /></td>
                  <td className="px-5 py-3 text-gray-600">{r.reviewCount}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setSelectedDish(r)}
                      className="text-xs text-primary-500 hover:underline"
                    >
                      View reviews
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedDish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedDish(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedDish.dishName}</h3>
                <StarDisplay rating={selectedDish.avgRating} />
              </div>
              <button onClick={() => setSelectedDish(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {!dishReviews?.reviews?.length ? (
              <p className="text-gray-400 text-sm py-8 text-center">No individual reviews</p>
            ) : (
              <div className="space-y-3">
                {dishReviews.reviews.map((rev, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{rev.residentName}</span>
                      <StarDisplay rating={rev.rating} />
                    </div>
                    <p className="text-sm text-gray-600">{rev.comment}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(rev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
