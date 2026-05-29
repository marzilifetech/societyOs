'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';

interface Society {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  showInDirectory: boolean;
}

interface ContactForm {
  contactEmail: string;
  contactPhone: string;
}

const FEATURE_FLAGS = [
  { key: 'canteen', label: 'Canteen' },
  { key: 'events', label: 'Events' },
  { key: 'medical', label: 'Medical' },
  { key: 'preOrders', label: 'Pre-Orders' },
  { key: 'propertyListings', label: 'Property Listings' },
  { key: 'travelPause', label: 'Travel Pause' },
] as const;

type FeatureKey = (typeof FEATURE_FLAGS)[number]['key'];

const BILLING_FIELDS = [
  { key: 'baseMaintenance', label: 'Base Maintenance (₹)' },
  { key: 'parking', label: 'Parking (₹)' },
  { key: 'water', label: 'Water (₹)' },
  { key: 'amenity', label: 'Amenity Charges (₹)' },
  { key: 'penaltyPerDay', label: 'Penalty / day (₹)' },
] as const;

type BillingKey = (typeof BILLING_FIELDS)[number]['key'];

const SLA_FIELDS = [
  { key: 'Plumbing', label: 'Plumbing (hours)' },
  { key: 'Electrical', label: 'Electrical (hours)' },
  { key: 'Cleaning', label: 'Cleaning (hours)' },
  { key: 'Carpentry', label: 'Carpentry (hours)' },
  { key: 'Security', label: 'Security (hours)' },
  { key: 'Other', label: 'Other (hours)' },
] as const;

type SlaKey = (typeof SLA_FIELDS)[number]['key'];

const SLA_DEFAULTS: Record<SlaKey, string> = {
  Plumbing: '4',
  Electrical: '2',
  Cleaning: '8',
  Carpentry: '24',
  Security: '1',
  Other: '12',
};

function readConfig<T>(config: Record<string, unknown> | null | undefined, key: string, fallback: T): T {
  if (!config || typeof config !== 'object') return fallback;
  const v = (config as Record<string, unknown>)[key];
  return (v ?? fallback) as T;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(
    Object.fromEntries(FEATURE_FLAGS.map((f) => [f.key, true])) as Record<FeatureKey, boolean>,
  );
  const [billing, setBilling] = useState<Record<BillingKey, string>>(
    Object.fromEntries(BILLING_FIELDS.map((f) => [f.key, ''])) as Record<BillingKey, string>,
  );
  const [contact, setContact] = useState<ContactForm>({ contactEmail: '', contactPhone: '' });
  const [profile, setProfile] = useState({ name: '', address: '', city: '', pincode: '', showInDirectory: false });
  const [profileSaved, setProfileSaved] = useState(false);
  const [sla, setSla] = useState<Record<SlaKey, string>>({ ...SLA_DEFAULTS });
  const [contactSaved, setContactSaved] = useState(false);
  const [featuresSaved, setFeaturesSaved] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);
  const [slaSaved, setSlaSaved] = useState(false);

  const { data: society, isLoading } = useQuery({
    queryKey: ['society-info'],
    queryFn: () => api.get<Society>('/admin/society'),
    retry: false,
  });

  // Hydrate state from society once loaded
  useEffect(() => {
    if (!society) return;
    const cfg = society.config ?? null;
    const featureCfg = readConfig<Record<string, unknown>>(cfg, 'features', {});
    setFeatures((prev) => {
      const next = { ...prev };
      for (const f of FEATURE_FLAGS) {
        const v = featureCfg[f.key];
        if (typeof v === 'boolean') next[f.key] = v;
      }
      return next;
    });
    const billingCfg = readConfig<Record<string, unknown>>(cfg, 'billing', {});
    setBilling((prev) => {
      const next = { ...prev };
      for (const f of BILLING_FIELDS) {
        const v = billingCfg[f.key];
        if (v != null && v !== '') next[f.key] = String(v);
      }
      return next;
    });
    setContact({
      contactEmail: readConfig<string>(cfg, 'contactEmail', ''),
      contactPhone: readConfig<string>(cfg, 'contactPhone', ''),
    });
    setProfile({
      name: society.name ?? '',
      address: society.address ?? '',
      city: society.city ?? '',
      pincode: society.pincode ?? '',
      showInDirectory: society.showInDirectory ?? false,
    });
    const slaCfg = readConfig<Record<string, unknown>>(cfg, 'slaConfig', {});
    setSla((prev) => {
      const next = { ...prev };
      for (const f of SLA_FIELDS) {
        const v = slaCfg[f.key];
        if (v != null && v !== '') next[f.key] = String(v);
      }
      return next;
    });
  }, [society]);

  const profileMutation = useMutation({
    mutationFn: () => api.patch('/admin/society', profile),
    onSuccess: () => {
      setProfileSaved(true);
      qc.invalidateQueries({ queryKey: ['society-info'] });
      toast.success('Society profile saved');
      setTimeout(() => setProfileSaved(false), 2000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const contactMutation = useMutation({
    mutationFn: (data: ContactForm) =>
      api.patch('/admin/society', {
        contactEmail: data.contactEmail.trim(),
        contactPhone: data.contactPhone.trim(),
      }),
    onSuccess: () => {
      setContactSaved(true);
      qc.invalidateQueries({ queryKey: ['society-info'] });
      toast.success('Contact details saved');
      setTimeout(() => setContactSaved(false), 2000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const featuresMutation = useMutation({
    mutationFn: (data: Record<FeatureKey, boolean>) =>
      api.patch('/admin/society', { config: { features: data } }),
    onSuccess: () => {
      setFeaturesSaved(true);
      qc.invalidateQueries({ queryKey: ['society-info'] });
      toast.success('Feature flags saved');
      setTimeout(() => setFeaturesSaved(false), 2000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const billingMutation = useMutation({
    mutationFn: (data: Record<BillingKey, string>) => {
      const numericData: Record<string, number | null> = {};
      for (const [key, raw] of Object.entries(data)) {
        if (raw === '') {
          numericData[key] = null;
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid value for ${key}`);
        numericData[key] = n;
      }
      return api.patch('/admin/society', { config: { billing: numericData } });
    },
    onSuccess: () => {
      setBillingSaved(true);
      qc.invalidateQueries({ queryKey: ['society-info'] });
      toast.success('Billing config saved');
      setTimeout(() => setBillingSaved(false), 2000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const slaMutation = useMutation({
    mutationFn: (data: Record<SlaKey, string>) => {
      const numericData: Record<string, number | null> = {};
      for (const [key, raw] of Object.entries(data)) {
        if (raw === '') { numericData[key] = null; continue; }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid SLA value for ${key}`);
        numericData[key] = n;
      }
      return api.patch('/admin/society', { config: { slaConfig: numericData } });
    },
    onSuccess: () => {
      setSlaSaved(true);
      qc.invalidateQueries({ queryKey: ['society-info'] });
      toast.success('SLA config saved');
      setTimeout(() => setSlaSaved(false), 2000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function toggleFeature(name: FeatureKey) {
    setFeatures((f) => ({ ...f, [name]: !f[name] }));
  }

  const infoRows = [
    { key: 'name' as const, label: 'Name' },
    { key: 'address' as const, label: 'Address' },
    { key: 'city' as const, label: 'City' },
    { key: 'pincode' as const, label: 'Pincode' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Society Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Society Info</h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {infoRows.map(({ key, label }) => (
                <div key={key} className={key === 'address' ? 'col-span-2' : ''}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    value={profile[key]}
                    onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 mb-4">
              <input
                type="checkbox"
                checked={profile.showInDirectory}
                onChange={(e) => setProfile((p) => ({ ...p, showInDirectory: e.target.checked }))}
              />
              Show in resident app directory
            </label>
            <button
              onClick={() => profileMutation.mutate()}
              disabled={profileMutation.isPending}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
                profileSaved ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-primary-500 text-white hover:bg-primary-600',
              )}
            >
              {profileMutation.isPending ? 'Saving…' : profileSaved ? 'Saved' : 'Save Profile'}
            </button>
          </>
        )}
      </div>

      {/* Contact Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Contact Details</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Contact Email</label>
            <input
              type="email"
              value={contact.contactEmail}
              onChange={(e) => setContact((c) => ({ ...c, contactEmail: e.target.value }))}
              placeholder="admin@society.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Contact Phone</label>
            <input
              type="tel"
              value={contact.contactPhone}
              onChange={(e) => setContact((c) => ({ ...c, contactPhone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => contactMutation.mutate(contact)}
            disabled={contactMutation.isPending}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
              contactSaved
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-primary-500 text-white hover:bg-primary-600',
            )}
          >
            {contactMutation.isPending ? 'Saving…' : contactSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Feature Flags</h2>
        </div>
        <div className="space-y-3 mb-4">
          {FEATURE_FLAGS.map((feature) => (
            <label
              key={feature.key}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="text-sm text-gray-700">{feature.label}</span>
              <button
                type="button"
                onClick={() => toggleFeature(feature.key)}
                aria-pressed={features[feature.key]}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors',
                  features[feature.key] ? 'bg-primary-500' : 'bg-gray-200',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    features[feature.key] ? 'translate-x-5' : 'translate-x-1',
                  )}
                />
              </button>
            </label>
          ))}
        </div>
        <button
          onClick={() => featuresMutation.mutate(features)}
          disabled={featuresMutation.isPending}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
            featuresSaved
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-primary-500 text-white hover:bg-primary-600',
          )}
        >
          {featuresMutation.isPending ? 'Saving…' : featuresSaved ? 'Saved' : 'Save Feature Flags'}
        </button>
      </div>

      {/* Billing Config */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Billing Config</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {BILLING_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 mb-1 block">{label}</label>
              <input
                type="number"
                min={0}
                step="1"
                value={billing[key]}
                onChange={(e) => setBilling((b) => ({ ...b, [key]: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => billingMutation.mutate(billing)}
          disabled={billingMutation.isPending}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
            billingSaved
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-primary-500 text-white hover:bg-primary-600',
          )}
        >
          {billingMutation.isPending ? 'Saving…' : billingSaved ? 'Saved' : 'Save Billing Config'}
        </button>
      </div>

      {/* SLA Configuration */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">SLA Configuration</h2>
          <span className="text-xs text-gray-400">Response time per complaint category</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {SLA_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-gray-400 mb-1 block">{label}</label>
              <input
                type="number"
                min={1}
                step="1"
                value={sla[key]}
                onChange={(e) => setSla((s) => ({ ...s, [key]: e.target.value }))}
                placeholder="Hours"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => slaMutation.mutate(sla)}
          disabled={slaMutation.isPending}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50',
            slaSaved
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-primary-500 text-white hover:bg-primary-600',
          )}
        >
          {slaMutation.isPending ? 'Saving…' : slaSaved ? 'Saved' : 'Save SLA Config'}
        </button>
      </div>

      {/* Admin Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Admin Info</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Name', value: user?.name },
            { label: 'Phone', value: user?.phone },
            { label: 'Role', value: user?.role?.replace('_', ' ') },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
