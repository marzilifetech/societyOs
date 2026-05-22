'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

const DESIGNATIONS = [
  'Security Guard',
  'Housekeeping',
  'Electrician',
  'Plumber',
  'Gardener',
  'Manager',
  'Accountant',
  'Receptionist',
];

const CATEGORIES = [
  { id: 'SECURITY', label: 'Security' },
  { id: 'HOUSEKEEPING', label: 'Housekeeping' },
  { id: 'MAINTENANCE', label: 'Maintenance' },
  { id: 'ADMIN', label: 'Admin' },
  { id: 'MEDICAL', label: 'Medical' },
];

export default function AddStaffPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    designation: '',
    categories: [] as string[],
    salary: '',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const trimmedPhone = form.phone.trim().replace(/\s/g, '');
      const phone = trimmedPhone.startsWith('+') ? trimmedPhone : `+91${trimmedPhone.replace(/^0+/, '')}`;
      return api.post('/admin/staff', {
        phone,
        name: form.name.trim(),
        designation: form.designation,
        categories: form.categories,
        salary: form.salary ? parseFloat(form.salary) : undefined,
      });
    },
    onSuccess: () => {
      setStep('success');
      toast.success('Staff added successfully');
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not add staff'),
  });

  const toggleCategory = (id: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter(c => c !== id)
        : [...prev.categories, id],
    }));
  };

  const isValid = form.name.length > 0 && form.phone.length >= 10 && form.designation;

  if (step === 'success') {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Staff Added</h1>
        <p className="text-gray-500 mb-6 text-center">
          {form.name} has been added to your society.<br />
          They can now login to the staff app.
        </p>
        <button
          onClick={() => router.push('/staff')}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          View All Staff
        </button>
        <button
          onClick={() => {
            setStep('form');
            setForm({ name: '', phone: '', designation: '', categories: [], salary: '' });
          }}
          className="mt-4 text-gray-500 hover:text-gray-700 text-sm"
        >
          Add Another
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-primary-500 hover:text-primary-600 inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Add New Staff</h1>
        <p className="text-gray-500 text-sm mt-1">Create staff account for your society</p>
      </div>

      <div className="space-y-4 bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3"
            placeholder="e.g. Rajesh Kumar"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3"
            placeholder="+91 98765 43210"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
          <select
            value={form.designation}
            onChange={e => setForm(prev => ({ ...prev, designation: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3"
          >
            <option value="">Select designation</option>
            {DESIGNATIONS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  form.categories.includes(cat.id)
                    ? 'bg-primary-50 border-primary-500 text-primary-600'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (₹)</label>
          <input
            type="number"
            value={form.salary}
            onChange={e => setForm(prev => ({ ...prev, salary: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3"
            placeholder="e.g. 25000"
          />
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending}
          className={`w-full py-3.5 rounded-xl font-medium mt-2 transition-colors ${
            isValid ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
          }`}
        >
          {mutation.isPending ? 'Adding…' : 'Add Staff Member'}
        </button>
      </div>
    </div>
  );
}