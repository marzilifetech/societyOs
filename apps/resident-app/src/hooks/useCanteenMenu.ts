import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

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

type PreOrder = {
  id: string;
  items: { dish: Dish; quantity: number }[];
  pickupAt: string;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'READY' | 'COLLECTED' | 'CANCELLED';
  totalAmount?: number;
  createdAt: string;
};

export function useCanteenMenu(ordersEnabled: boolean) {
  const menusQuery = useQuery<Menu[]>({
    queryKey: ['canteen-menu'],
    queryFn: () => api.get<Menu[]>('/canteen/menu'),
  });

  const ordersQuery = useQuery<PreOrder[]>({
    queryKey: ['canteen-pre-orders'],
    queryFn: () => api.get<PreOrder[]>('/canteen/pre-orders'),
    enabled: ordersEnabled,
  });

  return {
    menus: menusQuery.data,
    menusLoading: menusQuery.isLoading,
    menusError: menusQuery.isError,
    refetchMenus: menusQuery.refetch,
    orders: ordersQuery.data,
    ordersLoading: ordersQuery.isLoading,
    ordersError: ordersQuery.isError,
    refetchOrders: ordersQuery.refetch,
  };
}
