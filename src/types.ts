export const CLUB_ID = 'court_club_main';

export type CourtId = 'Court A' | 'Court B';

export type SlotId =
  | '0800-1000'
  | '1000-1200'
  | '1200-1500'
  | '1500-1700'
  | '1700-1900'
  | '2000-2200'
  | '2200-2400';

export type MaintenanceSlotId = 'ALL_DAY' | SlotId;

export type BookingStatus = 'active' | 'rain_cancelled';

export const MEMBERSHIP_CATEGORIES = ['Team', 'Coach', 'Member', 'Guest'] as const;

export type MembershipType = (typeof MEMBERSHIP_CATEGORIES)[number];

export type MaintenanceCategory =
  | 'Surface Resurfacing'
  | 'Net & Posts'
  | 'Floodlight System'
  | 'Line Repainting'
  | 'Drainage & Rain Clearing'
  | 'General Inspection';

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed';

export interface Player {
  id: string;
  clubId: string;
  name: string;
  membershipCode: string;
  membershipType: MembershipType;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Booking {
  id: string;
  clubId: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  courtId: CourtId;
  slotId: SlotId;
  playerId: string;
  playerName: string;
  status: BookingStatus;
  fee: number; // MYR (0.00 when rain_cancelled)
  standardFee: number; // MYR
  notes: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SlotPricing {
  id: SlotId;
  clubId: string;
  slotId: SlotId;
  label: string;
  hours: number;
  fee: number; // MYR
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MonthlyAdjustment {
  id: string; // `${month}_${playerId}`
  clubId: string;
  month: string; // YYYY-MM
  playerId: string;
  playerName: string;
  overrideTotal: number; // -1 means automatic sum, >= 0 means admin custom MYR override
  paymentStatus: 'unpaid' | 'paid';
  adminNote: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MaintenanceTask {
  id: string;
  clubId: string;
  date: string; // YYYY-MM-DD
  courtId: CourtId;
  slotId: MaintenanceSlotId;
  title: string;
  category: MaintenanceCategory;
  technician: string;
  cost: number; // MYR
  status: MaintenanceStatus;
  notes: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const COURTS: CourtId[] = ['Court A', 'Court B'];

export const DEFAULT_SLOTS: Omit<SlotPricing, 'clubId' | 'updatedBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: '0800-1000',
    slotId: '0800-1000',
    label: '08:00 – 10:00 hrs',
    hours: 2,
    fee: 40,
  },
  {
    id: '1000-1200',
    slotId: '1000-1200',
    label: '10:00 – 12:00 hrs',
    hours: 2,
    fee: 40,
  },
  {
    id: '1200-1500',
    slotId: '1200-1500',
    label: '12:00 – 15:00 hrs',
    hours: 3,
    fee: 50,
  },
  {
    id: '1500-1700',
    slotId: '1500-1700',
    label: '15:00 – 17:00 hrs',
    hours: 2,
    fee: 40,
  },
  {
    id: '1700-1900',
    slotId: '1700-1900',
    label: '17:00 – 19:00 hrs',
    hours: 2,
    fee: 50,
  },
  {
    id: '2000-2200',
    slotId: '2000-2200',
    label: '20:00 – 22:00 hrs',
    hours: 2,
    fee: 60,
  },
  {
    id: '2200-2400',
    slotId: '2200-2400',
    label: '22:00 – 24:00 hrs',
    hours: 2,
    fee: 60,
  },
];

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const VALIDATION_CONSTRAINTS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  MONTH_REGEX: /^\d{4}-\d{2}$/,
  PLAYER_NAME_MAX: 80,
  MEMBERSHIP_CODE_MAX: 24,
  BOOKING_NOTES_MAX: 200,
  SLOT_LABEL_MAX: 40,
  ADMIN_NOTE_MAX: 200,
  MAINT_TITLE_MAX: 100,
  MAINT_TECH_MAX: 80,
  MAINT_NOTES_MAX: 300,
  MAX_SLOT_FEE: 10000,
  MAX_MONTHLY_TOTAL: 100000,
} as const;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

export function makeBookingDocId(date: string, courtId: CourtId, slotId: SlotId): string {
  const courtSlug = courtId === 'Court A' ? 'CourtA' : 'CourtB';
  return sanitizeId(`${date}_${courtSlug}_${slotId}`);
}

export function makeMonthlyAdjustmentDocId(month: string, playerId: string): string {
  return sanitizeId(`${month}_${playerId}`);
}

export function formatMYR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `MYR ${safe.toFixed(2)}`;
}
