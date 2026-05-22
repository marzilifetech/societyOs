'use client';

import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plane } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ErrorState } from '@/components/ui/ErrorState';

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'WITHDRAWN' | 'DRAFT';
type ActiveTab = 'listings' | 'travel';
type TravelFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED';

interface PropertyListing {
  id: string;
  areaSqft: number;
  price: string;
  furnished: boolean;
  description?: string;
  status: string;
  createdAt: string;
  resident: {
    user: { name: string; phone: string };
    flat: { flatNumber: string; tower?: string };
  };
}

interface TravelPause {
  id: string;
  startDate: string;
  returnDate: string;
  status: string;
  servicesPaused: string[];
  resident: {
    user: { name: string; phone: string };
    flat: { flatNumber: string; tower?: string };
  };
}

function toDateStr(d: string) {
  return new Date(d).toISOString().split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
};

function EmptyState({ icon: Icon, title, message }: { icon: React.ComponentType<{ className?: string }>; title: string; message: string }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <Icon className="w-10 h-10 text-gray-300 mb-3" />
      <p className="font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{message}</p>
    </div>
  );
}

const LISTING_FILTERS: StatusFilter[] = ['ALL', 'PENDING', 'ACTIVE', 'WITHDRAWN', 'DRAFT'];
const TRAVEL_FILTERS: TravelFilter[] = ['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'];

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'listings', label: 'Property Listings' },
  { key: 'travel', label: 'Travel Pauses' },
];

export default function PropertyPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('listings');
  const [listingsFilter, setListingsFilter] = useState<StatusFilter>('ALL');
  const [travelFilter, setTravelFilter] = useState<TravelFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const {
    data: listings,
    isLoading: listingsLoading,
    isError: listingsError,
    refetch: refetchListings,
  } = useQuery({
    queryKey: ['property-listings', listingsFilter],
    queryFn: () =>
      api.get<PropertyListing[]>(
        `/notices/admin/property/listings${listingsFilter !== 'ALL' ? `?status=${listingsFilter}` : ''}`,
      ),
    enabled: activeTab === 'listings',
    retry: false,
  });

  const {
    data: travels,
    isLoading: travelLoading,
    isError: travelError,
    refetch: refetchTravel,
  } = useQuery({
    queryKey: ['travel-pauses', travelFilter],
    queryFn: () =>
      api.get<TravelPause[]>(
        `/admin/travel-pauses${travelFilter !== 'ALL' ? `?status=${travelFilter}` : ''}`,
      ),
    enabled: activeTab === 'travel',
    retry: false,
  });

  const approveListing = useMutation({
    mutationFn: (id: string) => {
      setPendingAction(id);
      return api.post(`/notices/admin/property/listings/${id}/approve`, {});
    },
    onSettled: () => setPendingAction(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-listings'] });
      toast.success('Listing approved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectListing = useMutation({
    mutationFn: (id: string) => {
      setPendingAction(id);
      return api.patch(`/notices/admin/property/listings/${id}/reject`, {});
    },
    onSettled: () => setPendingAction(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-listings'] });
      toast.success('Listing rejected');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveTravel = useMutation({
    mutationFn: (id: string) => {
      setPendingAction(id);
      return api.patch(`/admin/travel-pauses/${id}/approve`, {});
    },
    onSettled: () => setPendingAction(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-pauses'] });
      toast.success('Travel pause approved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectTravel = useMutation({
    mutationFn: (id: string) => {
      setPendingAction(id);
      return api.patch(`/admin/travel-pauses/${id}/reject`, {});
    },
    onSettled: () => setPendingAction(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel-pauses'] });
      toast.success('Travel pause rejected');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Property</h1>
      </div>

      {/* Main tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listings tab */}
      {activeTab === 'listings' && (
        <div>
          <div className="flex gap-2 mb-4">
            {LISTING_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setListingsFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  listingsFilter === f
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            {listingsLoading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
            ) : listingsError ? (
              <ErrorState onRetry={refetchListings} message="Property listings couldn't be loaded. Your data is safe — please try again." />
            ) : !listings?.length ? (
              <EmptyState icon={Building2} title="No property listings yet" message="Resident-submitted listings awaiting review will appear here." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left px-5 py-3 font-medium">Resident</th>
                    <th className="text-left px-5 py-3 font-medium">Unit</th>
                    <th className="text-left px-5 py-3 font-medium">Area</th>
                    <th className="text-left px-5 py-3 font-medium">Price</th>
                    <th className="text-left px-5 py-3 font-medium">Furnished</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {listings.map((listing) => (
                    <Fragment key={listing.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() =>
                          setExpandedId(expandedId === listing.id ? null : listing.id)
                        }
                      >
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {listing.resident.user.name}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {listing.resident.flat.tower
                            ? `${listing.resident.flat.tower}-${listing.resident.flat.flatNumber}`
                            : listing.resident.flat.flatNumber}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {listing.areaSqft.toLocaleString('en-IN')} sqft
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          ₹{Number(listing.price).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'text-xs font-medium px-2.5 py-1 rounded-full',
                              listing.furnished
                                ? 'bg-primary-50 text-primary-700'
                                : 'bg-gray-100 text-gray-500',
                            )}
                          >
                            {listing.furnished ? 'Furnished' : 'Unfurnished'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'text-xs font-medium px-2.5 py-1 rounded-full',
                              STATUS_BADGE[listing.status] ?? 'bg-gray-100 text-gray-500',
                            )}
                          >
                            {listing.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {new Date(listing.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td
                          className="px-5 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {listing.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveListing.mutate(listing.id)}
                                disabled={pendingAction === listing.id}
                                className="text-xs px-3 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-40"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { if (window.confirm('Reject this listing?')) rejectListing.mutate(listing.id); }}
                                disabled={pendingAction === listing.id}
                                className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedId === listing.id && listing.description && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-5 py-3 text-sm text-gray-600">
                            {listing.description}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Travel tab */}
      {activeTab === 'travel' && (
        <div>
          <div className="flex gap-2 mb-4">
            {TRAVEL_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTravelFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  travelFilter === f
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            {travelLoading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
            ) : travelError ? (
              <ErrorState onRetry={refetchTravel} message="Travel pause data couldn't be loaded. Your data is safe — please try again." />
            ) : !travels?.length ? (
              <EmptyState icon={Plane} title="No travel pauses yet" message="Travel pause requests from residents will appear here." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left px-5 py-3 font-medium">Resident</th>
                    <th className="text-left px-5 py-3 font-medium">Unit</th>
                    <th className="text-left px-5 py-3 font-medium">From</th>
                    <th className="text-left px-5 py-3 font-medium">To</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-left px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {travels.map((t) => {
                    const returningToday = toDateStr(t.returnDate) === today();
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {t.resident.user.name}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {t.resident.flat.tower
                            ? `${t.resident.flat.tower}-${t.resident.flat.flatNumber}`
                            : t.resident.flat.flatNumber}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {new Date(t.startDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          <span>
                            {new Date(t.returnDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          {returningToday && (
                            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              Returning Today
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'text-xs font-medium px-2.5 py-1 rounded-full',
                              STATUS_BADGE[t.status] ?? 'bg-gray-100 text-gray-500',
                            )}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {t.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveTravel.mutate(t.id)}
                                disabled={pendingAction === t.id}
                                className="text-xs px-3 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-40"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { if (window.confirm('Reject this travel pause?')) rejectTravel.mutate(t.id); }}
                                disabled={pendingAction === t.id}
                                className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40"
                              >
                                Reject
                              </button>
                            </div>
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
