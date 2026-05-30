export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Auth
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'RESIDENT' | 'STAFF' | 'ADMIN' | 'SUPER_ADMIN';
  societyId: string;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

/** POST /auth/verify-otp — inner `data` after envelope unwrap (success HTTP only). */
export interface VerifyOtpUserPayload {
  id: string;
  phone: string;
  role: string;
  status: string;
  name?: string | null;
  societyId?: string;
}

export interface VerifyOtpTotpChallenge {
  totpRequired: true;
  userId: string;
}

export interface VerifyOtpSuccessPayload {
  token: string;
  accessToken: string;
  refreshToken: string;
  user: VerifyOtpUserPayload;
  isNewUser: boolean;
}

export type VerifyOtpPayload = VerifyOtpTotpChallenge | VerifyOtpSuccessPayload;

export function isVerifyOtpTotpChallenge(p: VerifyOtpPayload): p is VerifyOtpTotpChallenge {
  return 'totpRequired' in p && p.totpRequired === true;
}

/** Admin login user as returned inside verify-otp success (societyId may be filled client-side). */
export interface AdminVerifyOtpUser {
  id: string;
  name: string | null;
  phone: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  status: string;
  societyId?: string;
}

export interface AdminVerifyOtpSuccessPayload {
  token: string;
  accessToken: string;
  refreshToken: string;
  user: AdminVerifyOtpUser;
  isNewUser: boolean;
}

export type AdminVerifyOtpPayload = VerifyOtpTotpChallenge | AdminVerifyOtpSuccessPayload;

export interface Society {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

// Resident / Unit
export interface Unit {
  id: string;
  flatNumber: string;
  tower?: string;
  floor?: number;
  type?: string;
  area?: number;
}

export interface Resident {
  id: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string | null;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  unit?: Unit;
  createdAt: string;
}

// Visitor
export type VisitorStatus = 'PENDING' | 'CHECKED_IN' | 'CHECKED_OUT' | 'DENIED' | 'EXPIRED';

export interface Visitor {
  id: string;
  name: string;
  phone?: string;
  purpose: string;
  vehicleNumber?: string;
  qrToken: string;
  status: VisitorStatus;
  validFrom: string;
  validTill: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  residentId: string;
  createdAt: string;
}

// Service Request
export type ServiceRequestStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CLOSED';

export interface ServiceRequest {
  id: string;
  category: string;
  description: string;
  status: ServiceRequestStatus;
  rating?: number;
  ratingNote?: string;
  resident?: Pick<Resident, 'id' | 'name' | 'phone'>;
  unit?: Pick<Unit, 'flatNumber' | 'tower'>;
  createdAt: string;
  updatedAt: string;
}

// Complaint
export type ComplaintStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED' | 'REJECTED';

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: ComplaintStatus;
  isAnonymous: boolean;
  residentId?: string;
  createdAt: string;
}

// Notice
export type NoticeCategory = 'GENERAL' | 'MAINTENANCE' | 'EVENT' | 'EMERGENCY' | 'FINANCE';

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  isPinned: boolean;
  expiresAt?: string;
  createdAt: string;
}

// Event
export type EventCategory = 'SPORTS' | 'CULTURAL' | 'MEETING' | 'WORKSHOP' | 'FESTIVAL' | 'OTHER';

export interface Society_Event {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startAt: string;
  endAt: string;
  venue: string;
  maxAttendees?: number;
  registeredCount: number;
  isRegistered?: boolean;
  isWaitlisted?: boolean;
}

// Maintenance / Bill
export interface BillBreakdown {
  [label: string]: number;
}

export interface MaintenanceBill {
  id: string;
  month: number;
  year: number;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL' | 'WAIVED';
  breakdown?: BillBreakdown;
}

// SOS
export type SosStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM';

export interface SosAlert {
  id: string;
  status: SosStatus;
  note?: string | null;
  lat?: number;
  lng?: number;
  responseTimeSecs?: number;
  resident?: Pick<Resident, 'id' | 'name' | 'phone'> & { unit?: Pick<Unit, 'flatNumber'> };
  createdAt: string;
}

// Staff
export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  department?: string;
  societyId: string;
  createdAt?: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';

export interface AttendanceRecord {
  id: string;
  date: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: AttendanceStatus;
  isLate?: boolean;
  isEarlyDeparture?: boolean;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveType = 'CASUAL' | 'SICK' | 'EARNED' | 'EMERGENCY';

export interface LeaveRequest {
  id: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  adminNote?: string;
  createdAt: string;
}

// Medical
export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  availableDays: string[];
  slots: string[];
}

export interface Appointment {
  id: string;
  doctorId: string;
  doctor?: Pick<Doctor, 'name' | 'specialization'>;
  date: string;
  slot: string;
  status: 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  createdAt: string;
}

// Dashboard
export interface DashboardStats {
  totalResidents: number;
  activeResidents: number;
  pendingServiceRequests: number;
  openComplaints: number;
  upcomingEvents: number;
  activeSosAlerts: number;
  pendingVisitors: number;
  totalStaff: number;
}
