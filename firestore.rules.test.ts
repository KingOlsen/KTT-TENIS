/**
 * Security Rules Specification & Verification Suite for Dirty Dozen Payloads
 */

export interface DirtyPayloadTestCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'create' | 'update' | 'list';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyPayloadTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Booking Create',
    collection: 'bookings',
    docId: '2026-10-31_CourtA_0800-1000',
    operation: 'create',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      clubId: 'court_club_main',
      date: '2026-10-31',
      month: '2026-10',
      courtId: 'Court A',
      slotId: '0800-1000',
      playerId: 'player_1',
      playerName: 'Ahmad Razak',
      status: 'active',
      fee: 40,
      standardFee: 40,
      notes: '',
      createdBy: 'user_1',
      isFreeForever: true, // Shadow field
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Booking Create',
    collection: 'bookings',
    docId: '2026-10-31_CourtA_1000-1200',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: {
      clubId: 'court_club_main',
      date: '2026-10-31',
      month: '2026-10',
      courtId: 'Court A',
      slotId: '1000-1200',
      playerId: 'player_1',
      playerName: 'Ahmad Razak',
      status: 'active',
      fee: 40,
      standardFee: 40,
      notes: '',
      createdBy: 'victim_uid_999',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Spoof',
    collection: 'slotPricing',
    docId: '0800-1000',
    operation: 'update',
    auth: { uid: 'spoof_admin', email: 'sultanhaseng@gmail.com', email_verified: false },
    payload: {
      fee: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Orphaned Booking Create (Non-existent playerId)',
    collection: 'bookings',
    docId: '2026-10-31_CourtB_0800-1000',
    operation: 'create',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      clubId: 'court_club_main',
      date: '2026-10-31',
      month: '2026-10',
      courtId: 'Court B',
      slotId: '0800-1000',
      playerId: 'ghost_player_id',
      playerName: 'Ghost',
      status: 'active',
      fee: 40,
      standardFee: 40,
      notes: '',
      createdBy: 'user_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Rain Cancellation Non-Zero Fee Bypass',
    collection: 'bookings',
    docId: '2026-10-31_CourtA_0800-1000',
    operation: 'update',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      status: 'rain_cancelled',
      fee: 45, // Must be 0 when rain_cancelled
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Negative Rental Fee Injection',
    collection: 'slotPricing',
    docId: '0800-1000',
    operation: 'update',
    auth: { uid: 'admin_1', email: 'sultanhaseng@gmail.com', email_verified: true },
    payload: {
      fee: -100,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Invalid Time Slot Enum Injection',
    collection: 'bookings',
    docId: '2026-10-31_CourtA_0000-0200',
    operation: 'create',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      slotId: '0000-0200',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid Court Enum Injection',
    collection: 'bookings',
    docId: '2026-10-31_CourtC_0800-1000',
    operation: 'create',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      courtId: 'Court C',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    collection: 'players',
    docId: 'invalid$id#with!symbols',
    operation: 'create',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      name: 'Valid Name',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immortal Field Mutation (createdBy)',
    collection: 'bookings',
    docId: '2026-10-31_CourtA_0800-1000',
    operation: 'update',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      createdBy: 'other_user',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Re-opening on Completed Maintenance',
    collection: 'maintenance',
    docId: 'maint_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    payload: {
      status: 'in_progress',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unscoped List Query Scraping',
    collection: 'bookings',
    docId: '',
    operation: 'list',
    auth: { uid: 'user_1', email: 'player@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
