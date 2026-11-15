/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import {
  Calendar,
  CloudRain,
  Check,
  Plus,
  Trash2,
  Wrench,
  Sliders,
  UserPlus,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Cloud,
  Edit3,
  Lock,
  X,
  FileText,
  Printer,
  Download,
} from 'lucide-react';
import { useCourtStore } from './useCourtStore';
import {
  COURTS,
  CourtId,
  DEFAULT_SLOTS,
  formatMYR,
  MaintenanceCategory,
  MaintenanceSlotId,
  MaintenanceStatus,
  MembershipType,
  SlotId,
} from './types';

// Error Boundary to surface structured Firestore permission errors cleanly
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class FirestoreErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected cloud synchronization error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let parsedDetails: Record<string, unknown> | null = null;
      try {
        parsedDetails = JSON.parse(this.state.errorMessage);
      } catch {
        parsedDetails = null;
      }

      return (
        <div className="min-h-screen bg-[#F8FAF8] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-3 flex-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  Cloud Storage Permission or Sync Error
                </h2>
                <p className="text-sm text-slate-600">
                  The requested operation was rejected by cloud security rules or network constraints.
                </p>
                {parsedDetails ? (
                  <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 overflow-x-auto">
                    {JSON.stringify(parsedDetails, null, 2)}
                  </pre>
                ) : (
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                    {this.state.errorMessage}
                  </p>
                )}
                <button
                  onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                  className="px-4 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Retry & Return to Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type ActiveTab = 'booking' | 'monthly' | 'maintenance' | 'admin';

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaultAdminPasswordDDMMYYYY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function addMonths(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-MY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatReadableMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  if (!y || !m) return monthStr;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-MY', {
    month: 'long',
    year: 'numeric',
  });
}

function getDayOfWeekName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'long' });
}

function CourtBookingWorkspace() {
  const {
    cloudLoading,
    players,
    bookings,
    slotPricing,
    monthlyAdjustments,
    maintenanceTasks,
    addPlayer,
    deletePlayer,
    createMultiSlotBookings,
    toggleRainCancellation,
    updateBookingFee,
    deleteBooking,
    updateSlotStandardFee,
    saveMonthlyAdjustment,
    addMaintenanceTask,
    updateMaintenanceStatus,
    deleteMaintenanceTask,
  } = useCourtStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('booking');

  // Booking Tab State
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayStr());
  const [selectedSlots, setSelectedSlots] = useState<
    Array<{ courtId: CourtId; slotId: SlotId }>
  >([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => players[0]?.id || '');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingFeedback, setBookingFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Add New User Inline Form State
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserType, setNewUserType] = useState<MembershipType>('Member');
  const [newUserCode, setNewUserCode] = useState('');

  // Monthly Ledger Tab State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getTodayStr().slice(0, 7));
  const [monthlyCourtFilter, setMonthlyCourtFilter] = useState<'ALL' | CourtId>('ALL');
  const [monthlyStatusFilter, setMonthlyStatusFilter] = useState<'ALL' | 'active' | 'rain_cancelled'>('ALL');
  const [editingMonthlyPlayerId, setEditingMonthlyPlayerId] = useState<string | null>(null);
  const [monthlyOverrideInput, setMonthlyOverrideInput] = useState<string>('');
  const [monthlyNoteInput, setMonthlyNoteInput] = useState<string>('');
  const [monthlyPaymentInput, setMonthlyPaymentInput] = useState<'unpaid' | 'paid'>('unpaid');

  // Admin Password Prompt State for Edit Monthly Total
  const [pendingPasswordPlayerId, setPendingPasswordPlayerId] = useState<string | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);

  // Official Receipt Popup Modal State
  const [receiptPlayerId, setReceiptPlayerId] = useState<string | null>(null);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState<boolean>(false);

  // Individual Booking Fee Edit State
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editingBookingFeeInput, setEditingBookingFeeInput] = useState<string>('');

  // Maintenance Tab State
  const [maintDate, setMaintDate] = useState<string>(() => getTodayStr());
  const [maintCourt, setMaintCourt] = useState<CourtId>('Court A');
  const [maintSlot, setMaintSlot] = useState<MaintenanceSlotId>('0800-1000');
  const [maintTitle, setMaintTitle] = useState<string>('');
  const [maintCategory, setMaintCategory] = useState<MaintenanceCategory>('Surface Resurfacing');
  const [maintTechnician, setMaintTechnician] = useState<string>('');
  const [maintCost, setMaintCost] = useState<string>('0');
  const [maintStatus, setMaintStatus] = useState<MaintenanceStatus>('scheduled');
  const [maintNotes, setMaintNotes] = useState<string>('');
  const [maintFeedback, setMaintFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Admin Slot Rate Drafts
  const [slotFeeDrafts, setSlotFeeDrafts] = useState<Record<string, string>>({});
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Keep selectedPlayerId valid when players list updates
  const effectivePlayerId = useMemo(() => {
    if (players.some((p) => p.id === selectedPlayerId)) {
      return selectedPlayerId;
    }
    return players[0]?.id || '';
  }, [players, selectedPlayerId]);

  // 7-day strip around selectedDate
  const weekDays = useMemo(() => {
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => addDays(selectedDate, offset));
  }, [selectedDate]);

  // Map slot pricing for quick lookup
  const slotPriceMap = useMemo(() => {
    const map = new Map<SlotId, number>();
    DEFAULT_SLOTS.forEach((s) => map.set(s.slotId, s.fee));
    slotPricing.forEach((s) => map.set(s.slotId, s.fee));
    return map;
  }, [slotPricing]);

  // Bookings for selectedDate
  const bookingsForSelectedDate = useMemo(() => {
    return bookings.filter((b) => b.date === selectedDate);
  }, [bookings, selectedDate]);

  // Active maintenance tasks for selectedDate
  const maintenanceForSelectedDate = useMemo(() => {
    return maintenanceTasks.filter(
      (m) => m.date === selectedDate && m.status !== 'completed'
    );
  }, [maintenanceTasks, selectedDate]);

  // Toggle slot selection across both Court A and Court B
  const handleToggleSlot = (courtId: CourtId, slotId: SlotId) => {
    setBookingFeedback(null);
    setSelectedSlots((prev) => {
      const exists = prev.some(
        (item) => item.courtId === courtId && item.slotId === slotId
      );
      const next = exists
        ? prev.filter((item) => !(item.courtId === courtId && item.slotId === slotId))
        : [...prev, { courtId, slotId }];

      const slotOrder = new Map<SlotId, number>(
        DEFAULT_SLOTS.map((s, idx) => [s.slotId, idx])
      );
      return next.sort((a, b) => {
        const courtCmp = a.courtId.localeCompare(b.courtId);
        if (courtCmp !== 0) return courtCmp;
        return (slotOrder.get(a.slotId) ?? 99) - (slotOrder.get(b.slotId) ?? 99);
      });
    });
  };

  // Total fee for currently selected slots across Court A and Court B
  const selectedSlotsTotalFee = useMemo(() => {
    return selectedSlots.reduce(
      (sum, item) => sum + (slotPriceMap.get(item.slotId) ?? 40),
      0
    );
  }, [selectedSlots, slotPriceMap]);

  // Handle adding a new player inline
  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingFeedback(null);
    try {
      const created = await addPlayer(newUserName, newUserType, newUserCode);
      setSelectedPlayerId(created.id);
      setNewUserName('');
      setNewUserCode('');
      setShowAddUserForm(false);
      setBookingFeedback({
        type: 'success',
        message: `Added player "${created.name}" (${created.membershipCode}) and selected for booking.`,
      });
    } catch (err) {
      setBookingFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not add player.',
      });
    }
  };

  // Confirm multi-slot booking across Court A and/or Court B
  const handleConfirmBooking = async () => {
    setBookingFeedback(null);
    if (!effectivePlayerId) {
      setBookingFeedback({
        type: 'error',
        message: 'Please select a player or add a new user first.',
      });
      return;
    }
    if (selectedSlots.length === 0) {
      setBookingFeedback({
        type: 'error',
        message: 'Select one or more available time slots on Court A or Court B.',
      });
      return;
    }
    try {
      const count = selectedSlots.length;
      const courtsBooked = Array.from(new Set(selectedSlots.map((s) => s.courtId))).join(' & ');
      await createMultiSlotBookings({
        date: selectedDate,
        selections: selectedSlots,
        playerId: effectivePlayerId,
        notes: bookingNotes,
      });
      setSelectedSlots([]);
      setBookingNotes('');
      setBookingFeedback({
        type: 'success',
        message: `Confirmed ${count} slot${count > 1 ? 's' : ''} (${courtsBooked}) for ${formatReadableDate(selectedDate)}.`,
      });
    } catch (err) {
      setBookingFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create booking.',
      });
    }
  };

  // Monthly Bookings & Player Rental Ledger Calculations
  const bookingsInSelectedMonth = useMemo(() => {
    return bookings.filter((b) => b.month === selectedMonth);
  }, [bookings, selectedMonth]);

  const filteredMonthlyBookings = useMemo(() => {
    const slotOrder = new Map<SlotId, number>(
      DEFAULT_SLOTS.map((s, index) => [s.slotId, index])
    );

    return bookingsInSelectedMonth
      .filter((b) => {
        if (monthlyCourtFilter !== 'ALL' && b.courtId !== monthlyCourtFilter) return false;
        if (monthlyStatusFilter !== 'ALL' && b.status !== monthlyStatusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;

        const courtCmp = a.courtId.localeCompare(b.courtId);
        if (courtCmp !== 0) return courtCmp;

        const orderA = slotOrder.get(a.slotId) ?? 99;
        const orderB = slotOrder.get(b.slotId) ?? 99;
        if (orderA !== orderB) return orderA - orderB;

        return a.slotId.localeCompare(b.slotId);
      });
  }, [bookingsInSelectedMonth, monthlyCourtFilter, monthlyStatusFilter]);

  interface PlayerMonthlySummary {
    playerId: string;
    playerName: string;
    membershipCode: string;
    membershipType: string;
    totalSlots: number;
    activeSlots: number;
    rainCancelledSlots: number;
    calculatedTotal: number;
    overrideTotal: number; // -1 if none
    finalPayableTotal: number;
    paymentStatus: 'unpaid' | 'paid';
    adminNote: string;
  }

  const monthlyPlayerSummaries = useMemo<PlayerMonthlySummary[]>(() => {
    const map = new Map<string, PlayerMonthlySummary>();

    // Initialize from bookings in selected month
    for (const b of bookingsInSelectedMonth) {
      const playerObj = players.find((p) => p.id === b.playerId);
      const existing = map.get(b.playerId) || {
        playerId: b.playerId,
        playerName: b.playerName,
        membershipCode: playerObj?.membershipCode || 'MBR',
        membershipType: playerObj?.membershipType || 'Member',
        totalSlots: 0,
        activeSlots: 0,
        rainCancelledSlots: 0,
        calculatedTotal: 0,
        overrideTotal: -1,
        finalPayableTotal: 0,
        paymentStatus: 'unpaid' as const,
        adminNote: '',
      };

      existing.totalSlots += 1;
      if (b.status === 'rain_cancelled') {
        existing.rainCancelledSlots += 1;
        // Rain cancellation fee is strictly MYR 0.00
      } else {
        existing.activeSlots += 1;
        existing.calculatedTotal += b.fee;
      }
      map.set(b.playerId, existing);
    }

    // Also include any players who have an explicit monthly adjustment in this month
    for (const adj of monthlyAdjustments) {
      if (adj.month !== selectedMonth) continue;
      const playerObj = players.find((p) => p.id === adj.playerId);
      const existing = map.get(adj.playerId) || {
        playerId: adj.playerId,
        playerName: adj.playerName,
        membershipCode: playerObj?.membershipCode || 'MBR',
        membershipType: playerObj?.membershipType || 'Member',
        totalSlots: 0,
        activeSlots: 0,
        rainCancelledSlots: 0,
        calculatedTotal: 0,
        overrideTotal: -1,
        finalPayableTotal: 0,
        paymentStatus: 'unpaid' as const,
        adminNote: '',
      };
      existing.overrideTotal = adj.overrideTotal;
      existing.paymentStatus = adj.paymentStatus;
      existing.adminNote = adj.adminNote;
      map.set(adj.playerId, existing);
    }

    const result = Array.from(map.values()).map((row) => ({
      ...row,
      finalPayableTotal: row.overrideTotal >= 0 ? row.overrideTotal : row.calculatedTotal,
    }));

    result.sort((a, b) => b.finalPayableTotal - a.finalPayableTotal);
    return result;
  }, [bookingsInSelectedMonth, monthlyAdjustments, players, selectedMonth]);

  const monthlyGrandTotalPayable = useMemo(() => {
    return monthlyPlayerSummaries.reduce((acc, r) => acc + r.finalPayableTotal, 0);
  }, [monthlyPlayerSummaries]);

  const monthlyRainWaivedAmount = useMemo(() => {
    return bookingsInSelectedMonth
      .filter((b) => b.status === 'rain_cancelled')
      .reduce((acc, b) => acc + b.standardFee, 0);
  }, [bookingsInSelectedMonth]);

  const openMonthlyRowEditor = (row: PlayerMonthlySummary) => {
    setEditingMonthlyPlayerId(row.playerId);
    setMonthlyOverrideInput(
      row.overrideTotal >= 0 ? String(row.overrideTotal) : String(row.calculatedTotal)
    );
    setMonthlyNoteInput(row.adminNote);
    setMonthlyPaymentInput(row.paymentStatus);
  };

  const startEditMonthlyRow = (row: PlayerMonthlySummary) => {
    setPendingPasswordPlayerId(row.playerId);
    setAdminPasswordInput('');
    setAdminPasswordError(null);
  };

  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedPassword = getDefaultAdminPasswordDDMMYYYY();
    if (adminPasswordInput.trim() !== expectedPassword) {
      setAdminPasswordError('Incorrect admin password.');
      return;
    }
    const targetRow = monthlyPlayerSummaries.find(
      (r) => r.playerId === pendingPasswordPlayerId
    );
    setPendingPasswordPlayerId(null);
    setAdminPasswordInput('');
    setAdminPasswordError(null);
    if (targetRow) {
      openMonthlyRowEditor(targetRow);
    }
  };

  const handleSaveMonthlyOverride = async (row: PlayerMonthlySummary, resetToAuto = false) => {
    const numericVal = resetToAuto ? -1 : Math.max(0, Number(monthlyOverrideInput) || 0);
    await saveMonthlyAdjustment({
      month: selectedMonth,
      playerId: row.playerId,
      playerName: row.playerName,
      overrideTotal: numericVal,
      paymentStatus: monthlyPaymentInput,
      adminNote: monthlyNoteInput,
    });
    setEditingMonthlyPlayerId(null);
  };

  // Active player summary for the Receipt Popup Modal
  const receiptPlayerSummary = useMemo(() => {
    if (!receiptPlayerId) return null;
    return monthlyPlayerSummaries.find((r) => r.playerId === receiptPlayerId) || null;
  }, [receiptPlayerId, monthlyPlayerSummaries]);

  const getReceiptNumber = (row: PlayerMonthlySummary): string => {
    const monthDigits = selectedMonth.replace('-', '');
    const codePart = (row.membershipCode || row.playerId.slice(0, 6))
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    return `KTT-${monthDigits}-${codePart}`;
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleDownloadReceipt = async (row: PlayerMonthlySummary) => {
    setIsDownloadingReceipt(true);
    try {
      const scale = 2;
      const width = 760;
      const hasCustomOverride = row.overrideTotal >= 0;
      const summaryRows: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Billing Period', value: `${formatReadableMonth(selectedMonth)} (${selectedMonth})` },
        { label: 'Active Court Slots Booked', value: `${row.activeSlots} slot${row.activeSlots === 1 ? '' : 's'}` },
        {
          label: 'Rain Cancelled Slots (Waived at MYR 0.00)',
          value: `${row.rainCancelledSlots} slot${row.rainCancelledSlots === 1 ? '' : 's'}`,
        },
        { label: 'Total Monthly Slots Reserved', value: `${row.totalSlots} slot${row.totalSlots === 1 ? '' : 's'}` },
        { label: 'Calculated Court Rental Fee', value: formatMYR(row.calculatedTotal) },
      ];

      if (hasCustomOverride) {
        summaryRows.push({
          label: 'Admin Adjusted Monthly Total',
          value: formatMYR(row.overrideTotal),
          highlight: true,
        });
      }

      const rowHeight = 36;
      const height = 430 + summaryRows.length * rowHeight + (row.adminNote ? 44 : 0);

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Outer border
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Top emerald accent bar
      ctx.fillStyle = '#065F46';
      ctx.fillRect(20, 20, width - 40, 8);

      // Load logo if available
      const logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `${import.meta.env.BASE_URL}assets/aistudio/WhatsApp_Image_2026-11-02_at_06.31.58_20dd0823.jpeg`;
      });

      let textStartX = 48;
      if (logoImg) {
        ctx.save();
        ctx.drawImage(logoImg, 48, 48, 56, 56);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.strokeRect(48, 48, 56, 56);
        ctx.restore();
        textStartX = 118;
      }

      // Header text
      ctx.fillStyle = '#022C22';
      ctx.font = 'bold 22px Outfit, sans-serif';
      ctx.fillText('KELAB TENIS TAIPING', textStartX, 72);

      ctx.fillStyle = '#475569';
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('OFFICIAL MONTHLY COURT RENTAL RECEIPT', textStartX, 94);

      // PAID Stamp on top right
      ctx.save();
      ctx.fillStyle = '#ECFDF5';
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.fillRect(width - 165, 52, 115, 42);
      ctx.strokeRect(width - 165, 52, 115, 42);
      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 16px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAID', width - 107.5, 79);
      ctx.restore();

      // Divider
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(48, 124);
      ctx.lineTo(width - 48, 124);
      ctx.stroke();

      // Metadata block
      const receiptNo = getReceiptNumber(row);
      const issueDate = formatReadableDate(getTodayStr());

      ctx.fillStyle = '#64748B';
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('RECEIVED FROM', 48, 150);
      ctx.fillText('MEMBERSHIP', 48, 192);
      ctx.fillText('RECEIPT NO.', 430, 150);
      ctx.fillText('ISSUE DATE', 430, 192);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(row.playerName, 48, 169);
      ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${row.membershipType} · ${row.membershipCode}`, 48, 211);

      ctx.font = 'bold 13px "IBM Plex Mono", monospace';
      ctx.fillText(receiptNo, 430, 169);
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(issueDate, 430, 211);

      // Summary Table Header
      const tableTop = 236;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(48, tableTop, width - 96, 32);
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(48, tableTop);
      ctx.lineTo(width - 48, tableTop);
      ctx.moveTo(48, tableTop + 32);
      ctx.lineTo(width - 48, tableTop + 32);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('MONTHLY RENTAL SUMMARY DESCRIPTION', 62, tableTop + 20);
      ctx.textAlign = 'right';
      ctx.fillText('SUMMARY / AMOUNT', width - 62, tableTop + 20);

      // Summary Rows
      let currentY = tableTop + 32;
      for (const item of summaryRows) {
        ctx.textAlign = 'left';
        ctx.fillStyle = item.highlight ? '#92400E' : '#334155';
        ctx.font = item.highlight
          ? '600 13px "Plus Jakarta Sans", sans-serif'
          : '500 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(item.label, 62, currentY + 23);

        ctx.textAlign = 'right';
        ctx.fillStyle = item.highlight ? '#92400E' : '#0F172A';
        ctx.font = '600 13px "IBM Plex Mono", monospace';
        ctx.fillText(item.value, width - 62, currentY + 23);

        currentY += rowHeight;
        ctx.strokeStyle = '#F1F5F9';
        ctx.beginPath();
        ctx.moveTo(48, currentY);
        ctx.lineTo(width - 48, currentY);
        ctx.stroke();
      }

      // Total Amount Paid Box
      const summaryTop = currentY + 18;
      const boxHeight = row.adminNote ? 104 : 74;
      ctx.fillStyle = '#F8FAF8';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.fillRect(48, summaryTop, width - 96, boxHeight);
      ctx.strokeRect(48, summaryTop, width - 96, boxHeight);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('TOTAL AMOUNT PAID (MYR)', 66, summaryTop + 34);

      ctx.fillStyle = '#64748B';
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Payment Status: PAID IN FULL', 66, summaryTop + 54);

      if (row.adminNote) {
        ctx.fillStyle = '#334155';
        ctx.font = 'italic 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`Note: ${row.adminNote}`, 66, summaryTop + 82);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = '#064E3B';
      ctx.font = 'bold 24px "IBM Plex Mono", monospace';
      ctx.fillText(formatMYR(row.finalPayableTotal), width - 66, summaryTop + 46);

      // Footer note
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748B';
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        'Thank you for your payment — KELAB TENIS TAIPING Management · Computer-generated official receipt',
        width / 2,
        height - 36
      );

      // Download PNG
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safePlayerSlug = row.playerName.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `KELAB-TENIS-TAIPING-Receipt-${selectedMonth}-${safePlayerSlug}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const handleSaveBookingFee = async (bookingId: string) => {
    const val = Math.max(0, Number(editingBookingFeeInput) || 0);
    await updateBookingFee(bookingId, val);
    setEditingBookingId(null);
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaintFeedback(null);
    try {
      await addMaintenanceTask({
        date: maintDate,
        courtId: maintCourt,
        slotId: maintSlot,
        title: maintTitle,
        category: maintCategory,
        technician: maintTechnician,
        cost: Number(maintCost) || 0,
        status: maintStatus,
        notes: maintNotes,
      });
      setMaintTitle('');
      setMaintNotes('');
      setMaintCost('0');
      setMaintFeedback({
        type: 'success',
        message: `Scheduled maintenance on ${maintCourt} (${maintSlot}) for ${formatReadableDate(maintDate)}.`,
      });
    } catch (err) {
      setMaintFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not schedule maintenance.',
      });
    }
  };

  const handleSaveSlotRate = async (slotId: SlotId) => {
    const raw = slotFeeDrafts[slotId];
    const current = slotPriceMap.get(slotId) ?? 40;
    const nextFee = raw !== undefined ? Math.max(0, Number(raw) || 0) : current;
    await updateSlotStandardFee(slotId, nextFee);
    setAdminFeedback(`Updated slot ${slotId} standard rental fee to ${formatMYR(nextFee)}.`);
    setTimeout(() => setAdminFeedback(null), 3500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF8] text-slate-900 pb-20 md:pb-0">
      {/* Top Bar Contract: Strictly 3 zones separated by gap-4 sm:gap-8 */}
      <header className="flex items-center justify-between gap-3 sm:gap-8 px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-slate-200">
        {/* Zone 1: Brand logo + wordmark */}
        <a
          href="#booking"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('booking');
          }}
          className="flex items-center gap-2.5 sm:gap-3 text-lg sm:text-xl font-bold tracking-tight text-emerald-950 font-display whitespace-nowrap shrink-0"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/aistudio/WhatsApp_Image_2026-11-02_at_06.31.58_20dd0823.jpeg`}
            alt="Kelab Tenis Taiping Logo"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover border border-slate-200 shadow-xs shrink-0"
          />
          <span className="truncate max-w-[185px] sm:max-w-none">KELAB TENIS TAIPING</span>
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-base font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('booking')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'booking'
                ? 'border-emerald-800 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Court Booking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'monthly'
                ? 'border-emerald-800 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Monthly Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'maintenance'
                ? 'border-emerald-800 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Maintenance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'admin'
                ? 'border-emerald-800 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Admin & Rates
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('booking');
              setShowAddUserForm(true);
            }}
            className="px-3.5 sm:px-4 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
          >
            + New Player
          </button>
        </div>
      </header>

      {/* Main Content Container — Maximum Viewport Width on Phone (px-2 sm:px-6) */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-2 sm:px-6 py-3 sm:py-8 space-y-4 sm:space-y-8">
        {/* Cloud Storage Sync Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 sm:px-0 pb-3 sm:pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display tracking-tight leading-snug">
              {activeTab === 'booking' && 'Tennis Court Schedule & Multi-Slot Reservations'}
              {activeTab === 'monthly' && 'Monthly Bookings & Rental Billing Ledger'}
              {activeTab === 'maintenance' && 'Court Surface & Facility Maintenance'}
              {activeTab === 'admin' && 'Admin Slot Pricing & Monthly Rental Overrides'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm sm:text-base text-slate-600">
              <span className="font-medium">Court A & Court B</span>
              <span aria-hidden="true">·</span>
              <span>7 Daily Slots (0800-1000 to 2200-2400)</span>
              <span aria-hidden="true">·</span>
              <span>Rain Waiver (MYR 0.00)</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-slate-800 font-semibold">
                <Cloud className="w-4 h-4 text-emerald-700 shrink-0" />
                {cloudLoading
                  ? 'Connecting to Real-Time Cloud Storage...'
                  : 'Automatic Real-Time Cloud Sync Active'}
              </span>
            </div>
          </div>
        </div>

        {/* =====================================================================
            TAB 1: COURT BOOKING (Select User/Add User, Date, Court A/B, Multi-Slot)
           ===================================================================== */}
        {activeTab === 'booking' && (
          <div className="space-y-4 sm:space-y-8">
            {/* Step 1 & 2 Control Strip: Player Selector + Add User & Date Picker */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              {/* Left 5 Cols: Booking Composer & Multi-Slot Checkout */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                      1. Reservation Details
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Select player, date, court, and tap slots to book.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddUserForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                  >
                    <UserPlus className="w-4 h-4" />
                    {showAddUserForm ? 'Close Form' : 'Add User'}
                  </button>
                </div>

                {/* Inline Add New User Form */}
                {showAddUserForm && (
                  <form
                    onSubmit={handleCreatePlayer}
                    className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">
                        Register New Player for Booking
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddUserForm(false)}
                        className="p-1.5 text-slate-500 hover:text-slate-700"
                        aria-label="Close form"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-800">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="e.g. Dato' Hafiz Ibrahim"
                        className="w-full px-3.5 py-3 text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[48px]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          Category
                        </label>
                        <select
                          value={newUserType}
                          onChange={(e) => setNewUserType(e.target.value as MembershipType)}
                          className="w-full px-3.5 py-3 text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[48px]"
                        >
                          <option value="Team">Team</option>
                          <option value="Coach">Coach</option>
                          <option value="Member">Member</option>
                          <option value="Guest">Guest</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          Ref Code (Optional)
                        </label>
                        <input
                          type="text"
                          maxLength={24}
                          value={newUserCode}
                          onChange={(e) => setNewUserCode(e.target.value)}
                          placeholder="Auto-generated"
                          className="w-full px-3.5 py-3 text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono min-h-[48px]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 px-4 text-base font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg transition-colors min-h-[48px]"
                    >
                      Save & Select User
                    </button>
                  </form>
                )}

                {/* Player Selector */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="booking-player-select"
                    className="block text-sm sm:text-base font-semibold text-slate-800"
                  >
                    Select User (Person Booking)
                  </label>
                  <select
                    id="booking-player-select"
                    value={effectivePlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    className="w-full px-3.5 py-3 text-base sm:text-lg font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[50px]"
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.membershipType})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Selector */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="booking-date-input"
                      className="block text-sm sm:text-base font-semibold text-slate-800"
                    >
                      Select Date
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(getTodayStr());
                        setSelectedSlots([]);
                      }}
                      className="text-sm font-semibold text-emerald-800 hover:underline py-1"
                    >
                      Jump to Today
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate((d) => addDays(d, -1));
                        setSelectedSlots([]);
                      }}
                      className="p-3 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 min-h-[48px] min-w-[48px] flex items-center justify-center"
                      aria-label="Previous day"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <input
                      id="booking-date-input"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                          setSelectedSlots([]);
                        }
                      }}
                      className="flex-1 px-3.5 py-2.5 text-base sm:text-lg font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[48px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate((d) => addDays(d, 1));
                        setSelectedSlots([]);
                      }}
                      className="p-3 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 min-h-[48px] min-w-[48px] flex items-center justify-center"
                      aria-label="Next day"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick 7-day selector strip */}
                  <div className="grid grid-cols-7 gap-1.5 pt-1">
                    {weekDays.map((dStr) => {
                      const isSelected = dStr === selectedDate;
                      const dayNum = dStr.slice(8, 10);
                      const [y, m, d] = dStr.split('-').map(Number);
                      const shortDow = new Date(y, m - 1, d).toLocaleDateString('en-US', {
                        weekday: 'short',
                      });
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dStr);
                            setSelectedSlots([]);
                          }}
                          className={`py-2 px-1 rounded-lg text-center transition-colors min-h-[54px] flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-800 text-white font-bold shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
                          }`}
                        >
                          <div className="text-xs opacity-90">{shortDow}</div>
                          <div className="text-sm sm:text-base font-mono font-bold tabular-nums">
                            {dayNum}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-Court & Multi-Slot Selection Summary */}
                <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-sm sm:text-base">
                    <span className="font-bold text-slate-800">
                      Selected Slots (Court A & Court B)
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-semibold tabular-nums text-slate-700">
                        {selectedSlots.length} slot{selectedSlots.length === 1 ? '' : 's'}
                      </span>
                      {selectedSlots.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlots([])}
                          className="text-sm font-semibold text-red-700 hover:text-red-800 underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedSlots.length === 0 ? (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Tap any available slots across both Court A and Court B on the schedule to reserve them together for {formatReadableDate(selectedDate)}.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                      {selectedSlots.map(({ courtId, slotId }) => (
                        <div
                          key={`${courtId}_${slotId}`}
                          className="flex items-center justify-between text-sm sm:text-base bg-white px-3.5 py-2.5 border border-slate-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {courtId}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-mono font-semibold text-slate-800">
                              {slotId} hrs
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold tabular-nums text-slate-900">
                              {formatMYR(slotPriceMap.get(slotId) ?? 40)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleSlot(courtId, slotId)}
                              className="p-1 text-slate-400 hover:text-red-600"
                              aria-label={`Remove ${courtId} slot ${slotId}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm sm:text-base font-bold text-slate-800">
                      Estimated Rental Total
                    </span>
                    <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-900">
                      {formatMYR(selectedSlotsTotalFee)}
                    </span>
                  </div>
                </div>

                {/* Optional Booking Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-sm sm:text-base font-semibold text-slate-800">
                    Booking Notes (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="e.g. Coaching session, club ladder match"
                    className="w-full px-3.5 py-3 text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[48px]"
                  />
                </div>

                {/* Feedback Banner */}
                {bookingFeedback && (
                  <div
                    className={`p-3.5 rounded-lg text-sm sm:text-base font-medium border ${
                      bookingFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {bookingFeedback.message}
                  </div>
                )}

                {/* Confirm Multi-Slot Booking CTA */}
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={selectedSlots.length === 0}
                  className={`w-full py-3.5 px-4 text-base sm:text-lg font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[54px] ${
                    selectedSlots.length > 0
                      ? 'bg-emerald-800 text-white hover:bg-emerald-700 cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-5 h-5 shrink-0" />
                  <span className="truncate">
                    {selectedSlots.length > 0
                      ? `Confirm Booking (${selectedSlots.length} Slot${selectedSlots.length > 1 ? 's' : ''} · ${formatMYR(selectedSlotsTotalFee)})`
                      : 'Tap Time Slots on Court A / B to Book'}
                  </span>
                </button>
              </div>

              {/* Right 7 Cols: Side-by-Side Court A & Court B Slot Matrix with Clash Prevention */}
              <div className="lg:col-span-7 space-y-4 sm:space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                        2. Court A & Court B Schedule — {formatReadableDate(selectedDate)}
                      </h2>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Tap any available slots across Court A and Court B. Booked slots display the player and prevent clashes.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-slate-700 font-mono tabular-nums">
                      <Calendar className="w-4 h-4 text-emerald-800" />
                      <span>{selectedDate}</span>
                    </div>
                  </div>

                  {/* Side-by-Side Court A and Court B Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    {COURTS.map((courtId) => {
                      const courtSelectedCount = selectedSlots.filter(
                        (s) => s.courtId === courtId
                      ).length;
                      return (
                        <div key={courtId} className="space-y-3">
                          <div className="flex items-center justify-between pb-2.5 border-b-2 border-slate-200">
                            <span className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                              {courtId}
                            </span>
                            <span className="text-sm font-mono font-semibold text-slate-600 tabular-nums">
                              {courtSelectedCount > 0
                                ? `${courtSelectedCount} selected`
                                : 'Tap slots below'}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {DEFAULT_SLOTS.map((slot) => {
                              const slotFee = slotPriceMap.get(slot.slotId) ?? slot.fee;
                              const existingBooking = bookingsForSelectedDate.find(
                                (b) => b.courtId === courtId && b.slotId === slot.slotId
                              );
                              const maintBlock = maintenanceForSelectedDate.find(
                                (m) =>
                                  m.courtId === courtId &&
                                  (m.slotId === 'ALL_DAY' || m.slotId === slot.slotId)
                              );
                              const isSelected = selectedSlots.some(
                                (s) => s.courtId === courtId && s.slotId === slot.slotId
                              );

                              // Case 1: Blocked by Maintenance
                              if (maintBlock) {
                                return (
                                  <div
                                    key={slot.slotId}
                                    className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-base font-mono font-bold text-slate-900 tabular-nums">
                                        {slot.slotId} hrs
                                      </span>
                                      <span className="text-sm font-bold text-amber-800">
                                        Maintenance Lock
                                      </span>
                                    </div>
                                    <p className="text-base text-amber-950 font-semibold">
                                      {maintBlock.title}
                                    </p>
                                    <div className="text-sm text-amber-800">
                                      {maintBlock.category} · {maintBlock.technician}
                                    </div>
                                  </div>
                                );
                              }

                              // Case 2: Already Booked (Active or Rain Cancelled)
                              if (existingBooking) {
                                const isRain = existingBooking.status === 'rain_cancelled';
                                return (
                                  <div
                                    key={slot.slotId}
                                    className={`p-4 rounded-xl border transition-colors space-y-2.5 ${
                                      isRain
                                        ? 'border-sky-300 bg-sky-50/60'
                                        : 'border-red-300 bg-red-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 text-base">
                                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                                          {slot.slotId}
                                        </span>
                                        <span aria-hidden="true" className="text-slate-300">
                                          ·
                                        </span>
                                        <span
                                          className={
                                            isRain
                                              ? 'text-sky-800 font-bold text-sm sm:text-base'
                                              : 'text-red-800 font-bold text-sm sm:text-base'
                                          }
                                        >
                                          {isRain ? 'Rain Cancelled' : 'Booked'}
                                        </span>
                                      </div>

                                      <div className="text-right font-mono text-base tabular-nums">
                                        {isRain ? (
                                          <div className="flex items-center gap-1.5">
                                            <span className="line-through text-sm text-slate-400">
                                              {formatMYR(existingBooking.standardFee)}
                                            </span>
                                            <span className="font-bold text-sky-900">
                                              MYR 0.00
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="font-bold text-slate-900">
                                            {formatMYR(existingBooking.fee)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Booker Name Prominently Shown */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                                        {existingBooking.playerName}
                                      </div>
                                      <span className="text-xs sm:text-sm font-semibold text-red-700/90 shrink-0">
                                        Clash Protected
                                      </span>
                                    </div>

                                    {existingBooking.notes && (
                                      <p className="text-sm text-slate-700 truncate">
                                        {existingBooking.notes}
                                      </p>
                                    )}

                                    {/* Rain Cancellation & Release Controls */}
                                    <div
                                      className={`pt-2.5 border-t flex items-center justify-between gap-2 ${
                                        isRain ? 'border-slate-200/80' : 'border-red-200/80'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleRainCancellation(existingBooking.id)
                                        }
                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap min-h-[44px] ${
                                          isRain
                                            ? 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100'
                                            : 'bg-sky-100 text-sky-950 hover:bg-sky-200/80'
                                        }`}
                                      >
                                        {isRain ? (
                                          <>
                                            <RotateCcw className="w-4 h-4" />
                                            Restore ({formatMYR(existingBooking.standardFee)})
                                          </>
                                        ) : (
                                          <>
                                            <CloudRain className="w-4 h-4" />
                                            Rain - MYR0
                                          </>
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => deleteBooking(existingBooking.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-red-700 transition-colors min-h-[44px]"
                                        title="Remove booking and free slot"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              // Case 3: Available Slot (Selectable for Multi-Slot Booking)
                              return (
                                <button
                                  key={slot.slotId}
                                  type="button"
                                  onClick={() => handleToggleSlot(courtId, slot.slotId)}
                                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer min-h-[68px] ${
                                    isSelected
                                      ? 'border-emerald-700 bg-emerald-50/80 ring-2 ring-emerald-700'
                                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base sm:text-lg font-mono font-bold text-slate-900 tabular-nums">
                                        {slot.slotId}
                                      </span>
                                      <span aria-hidden="true" className="text-slate-300">
                                        ·
                                      </span>
                                      <span className="text-sm font-medium text-slate-600">
                                        {slot.hours} hrs
                                      </span>
                                    </div>
                                    <div className="text-sm font-semibold text-emerald-800">
                                      {isSelected
                                        ? 'Selected for reservation'
                                        : 'Available — Tap to select'}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-base sm:text-lg font-mono font-bold text-slate-900 tabular-nums">
                                      {formatMYR(slotFee)}
                                    </span>
                                    <div
                                      className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${
                                        isSelected
                                          ? 'bg-emerald-800 border-emerald-800 text-white'
                                          : 'border-slate-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-4 h-4" />}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =====================================================================
            TAB 2: MONTHLY LEDGER (Monthly Bookings List + Monthly Rental Totals)
           ===================================================================== */}
        {activeTab === 'monthly' && (
          <div className="space-y-4 sm:space-y-8">
            {/* Month Selector & Summary Metrics */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
                    className="p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="text-sm font-medium text-slate-600">Selected Billing Month</div>
                    <div className="text-xl sm:text-2xl font-bold font-display text-slate-900">
                      {formatReadableMonth(selectedMonth)}{' '}
                      <span className="text-sm font-mono font-normal text-slate-500">
                        ({selectedMonth})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
                    className="p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      if (e.target.value) setSelectedMonth(e.target.value);
                    }}
                    className="px-3.5 py-2 text-base font-mono font-semibold border border-slate-300 rounded-lg bg-white min-h-[44px]"
                  />
                </div>

                {/* Monthly Summary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-8 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <div>
                    <div className="text-sm font-medium text-slate-600">Monthly Bookings</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {bookingsInSelectedMonth.length} slots
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-600">Rain Waived (MYR 0.00)</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-sky-800">
                      {
                        bookingsInSelectedMonth.filter((b) => b.status === 'rain_cancelled')
                          .length
                      }{' '}
                      slots ({formatMYR(monthlyRainWaivedAmount)} waived)
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-600">Total Monthly Rental to Pay</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-900">
                      {formatMYR(monthlyGrandTotalPayable)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: Total Amount to Pay for Each Rental / Player Monthly */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3.5 sm:p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Monthly Rental Billing Summary per Player ({formatReadableMonth(selectedMonth)})
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Rain-cancelled bookings automatically compute at MYR 0.00. Admin can edit the total monthly amount to pay for any player.
                  </p>
                </div>
              </div>

              {monthlyPlayerSummaries.length === 0 ? (
                <div className="p-8 sm:p-10 text-center space-y-3">
                  <p className="text-base text-slate-600">
                    No court rentals recorded for {formatReadableMonth(selectedMonth)}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('booking')}
                    className="px-4 py-2.5 text-sm font-bold text-white bg-emerald-800 rounded-lg hover:bg-emerald-700 min-h-[44px]"
                  >
                    Create First Booking
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                        <th className="py-3.5 px-3.5 sm:px-4">Player (Person Booking)</th>
                        <th className="py-3.5 px-3.5 sm:px-4 text-right">Active Slots</th>
                        <th className="py-3.5 px-3.5 sm:px-4 text-right">Rain Cancelled (MYR 0.00)</th>
                        <th className="py-3.5 px-3.5 sm:px-4 text-right">Calculated Fee</th>
                        <th className="py-3.5 px-3.5 sm:px-4 text-right">Total Amount to Pay Monthly</th>
                        <th className="py-3.5 px-3.5 sm:px-4">Billing Status & Note</th>
                        <th className="py-3.5 px-3.5 sm:px-4 text-right">Admin Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-base">
                      {monthlyPlayerSummaries.map((row) => {
                        const isEditing = editingMonthlyPlayerId === row.playerId;
                        const hasCustomOverride = row.overrideTotal >= 0;

                        return (
                          <tr key={row.playerId} className="hover:bg-slate-50/80">
                            <td className="py-4 px-3.5 sm:px-4">
                              <div className="font-bold text-base sm:text-lg text-slate-900">
                                {row.playerName}
                              </div>
                              <div className="text-sm text-slate-600">
                                {row.membershipType} · {row.membershipCode}
                              </div>
                            </td>
                            <td className="py-4 px-3.5 sm:px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                              {row.activeSlots}
                            </td>
                            <td className="py-4 px-3.5 sm:px-4 text-right font-mono font-bold tabular-nums text-sky-800">
                              {row.rainCancelledSlots}
                            </td>
                            <td className="py-4 px-3.5 sm:px-4 text-right font-mono font-semibold tabular-nums text-slate-700">
                              {formatMYR(row.calculatedTotal)}
                            </td>
                            <td className="py-4 px-3.5 sm:px-4 text-right font-mono tabular-nums">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <span className="text-sm text-slate-500">MYR</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.50"
                                    value={monthlyOverrideInput}
                                    onChange={(e) => setMonthlyOverrideInput(e.target.value)}
                                    className="w-28 px-2.5 py-1.5 text-right text-base font-mono bg-white border border-emerald-700 rounded-lg focus:outline-none min-h-[42px]"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <span className="text-lg font-bold text-emerald-950">
                                    {formatMYR(row.finalPayableTotal)}
                                  </span>
                                  {hasCustomOverride && (
                                    <div className="text-xs font-semibold text-amber-800">
                                      Admin Edited Total
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-3.5 sm:px-4">
                              {isEditing ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <select
                                    value={monthlyPaymentInput}
                                    onChange={(e) =>
                                      setMonthlyPaymentInput(
                                        e.target.value as 'unpaid' | 'paid'
                                      )
                                    }
                                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg min-h-[42px]"
                                  >
                                    <option value="unpaid">Unpaid</option>
                                    <option value="paid">Paid</option>
                                  </select>
                                  <input
                                    type="text"
                                    maxLength={200}
                                    value={monthlyNoteInput}
                                    onChange={(e) => setMonthlyNoteInput(e.target.value)}
                                    placeholder="Adjustment note..."
                                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg flex-1 min-h-[42px]"
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                                  <span
                                    className={
                                      row.paymentStatus === 'paid'
                                        ? 'font-bold text-emerald-800'
                                        : 'font-bold text-amber-800'
                                    }
                                  >
                                    {row.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                                  </span>
                                  {row.adminNote && (
                                    <>
                                      <span aria-hidden="true"> · </span>
                                      <span className="text-slate-600">{row.adminNote}</span>
                                    </>
                                  )}
                                  {row.paymentStatus === 'paid' && (
                                    <button
                                      type="button"
                                      onClick={() => setReceiptPlayerId(row.playerId)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors"
                                    >
                                      <FileText className="w-4 h-4" />
                                      Receipt
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-3.5 sm:px-4 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveMonthlyOverride(row, false)}
                                    className="px-3 py-1.5 text-sm font-bold text-white bg-emerald-800 rounded-lg hover:bg-emerald-700 min-h-[40px]"
                                  >
                                    Save
                                  </button>
                                  {hasCustomOverride && (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMonthlyOverride(row, true)}
                                      className="px-2.5 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 min-h-[40px]"
                                      title="Reset to automatic sum"
                                    >
                                      Auto Sum
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingMonthlyPlayerId(null)}
                                    className="px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[40px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-end gap-2">
                                  {row.paymentStatus === 'paid' && (
                                    <button
                                      type="button"
                                      onClick={() => setReceiptPlayerId(row.playerId)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors min-h-[40px]"
                                    >
                                      <FileText className="w-4 h-4" />
                                      View Receipt
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startEditMonthlyRow(row)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors min-h-[40px]"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    Edit Monthly Total
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Section 2: Detailed List of Bookings Per Month */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3.5 sm:p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Detailed Monthly Booking List ({formatReadableMonth(selectedMonth)})
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Every slot booked across Court A and Court B, including rain cancellations (MYR 0.00) and individual fee adjustments.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(['ALL', 'Court A', 'Court B'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setMonthlyCourtFilter(c)}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors min-h-[38px] ${
                          monthlyCourtFilter === c
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {c === 'ALL' ? 'All Courts' : c}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'ALL', label: 'All Statuses' },
                        { id: 'active', label: 'Active' },
                        { id: 'rain_cancelled', label: 'Rain (MYR 0.00)' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setMonthlyStatusFilter(st.id)}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors min-h-[38px] ${
                          monthlyStatusFilter === st.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredMonthlyBookings.length === 0 ? (
                <div className="p-8 sm:p-10 text-center text-base text-slate-500">
                  No bookings match the selected filters for {formatReadableMonth(selectedMonth)}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                        <th className="py-3.5 px-3.5 sm:px-4">Date</th>
                        <th className="py-3.5 px-3.5 sm:px-4">Day</th>
                        <th className="py-3.5 px-3.5 sm:px-4">Court</th>
                        <th className="py-3.5 px-3.5 sm:px-4">Time Slot</th>
                        <th className="py-3.5 px-3.5 sm:px-4">Person Booking</th>
                        <th className="py-3.5 px-3.5 sm:px-4">Status & Notes</th>
                        <th className="py-3.5 px-3.5 sm:px-4 text-right">Rental Fee (MYR)</th>
                        <th className="py-3.5 px-3.5 sm:px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-base">
                      {filteredMonthlyBookings.map((b) => {
                        const isRain = b.status === 'rain_cancelled';
                        const isEditingFee = editingBookingId === b.id;

                        return (
                          <tr key={b.id} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-3.5 sm:px-4 font-mono text-sm font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                              {b.date}
                            </td>
                            <td className="py-3.5 px-3.5 sm:px-4 text-sm font-semibold text-slate-700 whitespace-nowrap">
                              {getDayOfWeekName(b.date)}
                            </td>
                            <td className="py-3.5 px-3.5 sm:px-4 font-bold text-slate-900 whitespace-nowrap">
                              {b.courtId}
                            </td>
                            <td className="py-3.5 px-3.5 sm:px-4 font-mono text-sm font-bold tabular-nums text-slate-900 whitespace-nowrap">
                              {b.slotId} hrs
                            </td>
                            <td className="py-3.5 px-3.5 sm:px-4 font-bold text-slate-900">
                              {b.playerName}
                            </td>
                            <td className="py-3.5 px-3.5 sm:px-4 text-sm">
                              <span
                                className={
                                  isRain
                                    ? 'font-bold text-sky-800'
                                    : 'font-bold text-emerald-800'
                                }
                              >
                                {isRain ? 'Cancelled on Rain (MYR 0.00)' : 'Active Booking'}
                              </span>
                              {b.notes && (
                                <>
                                  <span aria-hidden="true" className="text-slate-300">
                                    {' '}
                                    ·{' '}
                                  </span>
                                  <span className="text-slate-600">{b.notes}</span>
                                </>
                              )}
                            </td>
                            <td className="py-3.5 px-3.5 sm:px-4 text-right font-mono tabular-nums whitespace-nowrap">
                              {isEditingFee ? (
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.50"
                                    value={editingBookingFeeInput}
                                    onChange={(e) => setEditingBookingFeeInput(e.target.value)}
                                    className="w-24 px-2.5 py-1.5 text-right text-sm font-mono border border-emerald-700 rounded-lg"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveBookingFee(b.id)}
                                    className="px-2.5 py-1.5 text-sm font-bold text-white bg-emerald-800 rounded-lg"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingBookingId(null)}
                                    className="px-2 py-1.5 text-sm text-slate-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : isRain ? (
                                <div>
                                  <span className="line-through text-sm text-slate-400 mr-1.5">
                                    {formatMYR(b.standardFee)}
                                  </span>
                                  <span className="font-bold text-sky-900">MYR 0.00</span>
                                </div>
                              ) : (
                                <span className="font-bold text-slate-900">
                                  {formatMYR(b.fee)}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3.5 sm:px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleRainCancellation(b.id)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors min-h-[40px] ${
                                    isRain
                                      ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                      : 'bg-sky-100 text-sky-950 hover:bg-sky-200/80'
                                  }`}
                                >
                                  {isRain ? 'Restore Active' : 'Rain - MYR0'}
                                </button>
                                {!isRain && !isEditingFee && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingBookingId(b.id);
                                      setEditingBookingFeeInput(String(b.fee));
                                    }}
                                    className="px-2.5 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[40px]"
                                  >
                                    Edit Fee
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteBooking(b.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 min-h-[40px]"
                                  title="Delete booking"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =====================================================================
            TAB 3: MAINTENANCE (Schedule Court Maintenance & Track Work Orders)
           ===================================================================== */}
        {activeTab === 'maintenance' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            {/* Left 5 Cols: Schedule Maintenance Form */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3.5">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-emerald-800" />
                  Schedule Court Maintenance
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Scheduled or In-Progress tasks automatically lock the selected court slot against player bookings.
                </p>
              </div>

              <form onSubmit={handleCreateMaintenance} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={maintDate}
                      onChange={(e) => setMaintDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-base font-mono bg-white border border-slate-300 rounded-lg min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Court
                    </label>
                    <select
                      value={maintCourt}
                      onChange={(e) => setMaintCourt(e.target.value as CourtId)}
                      className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-lg min-h-[48px]"
                    >
                      <option value="Court A">Court A</option>
                      <option value="Court B">Court B</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Blocked Time Slot
                    </label>
                    <select
                      value={maintSlot}
                      onChange={(e) => setMaintSlot(e.target.value as MaintenanceSlotId)}
                      className="w-full px-3.5 py-2.5 text-base font-mono bg-white border border-slate-300 rounded-lg min-h-[48px]"
                    >
                      <option value="ALL_DAY">ALL_DAY (Full Court Lock)</option>
                      {DEFAULT_SLOTS.map((s) => (
                        <option key={s.slotId} value={s.slotId}>
                          {s.slotId} hrs
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Category
                    </label>
                    <select
                      value={maintCategory}
                      onChange={(e) =>
                        setMaintCategory(e.target.value as MaintenanceCategory)
                      }
                      className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-lg min-h-[48px]"
                    >
                      <option value="Surface Resurfacing">Surface Resurfacing</option>
                      <option value="Net & Posts">Net & Posts</option>
                      <option value="Floodlight System">Floodlight System</option>
                      <option value="Line Repainting">Line Repainting</option>
                      <option value="Drainage & Rain Clearing">Drainage & Rain Clearing</option>
                      <option value="General Inspection">General Inspection</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Maintenance Work Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={maintTitle}
                    onChange={(e) => setMaintTitle(e.target.value)}
                    placeholder="e.g. Floodlight Halide Replacement on Court A"
                    className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-lg min-h-[48px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Technician / Vendor
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={maintTechnician}
                      onChange={(e) => setMaintTechnician(e.target.value)}
                      placeholder="CourtCare MY"
                      className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-lg min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Cost (MYR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={maintCost}
                      onChange={(e) => setMaintCost(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-base font-mono bg-white border border-slate-300 rounded-lg min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={maintStatus}
                      onChange={(e) => setMaintStatus(e.target.value as MaintenanceStatus)}
                      className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-lg min-h-[48px]"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Maintenance Notes
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={maintNotes}
                    onChange={(e) => setMaintNotes(e.target.value)}
                    placeholder="Scope of work or parts replaced..."
                    className="w-full px-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                {maintFeedback && (
                  <div
                    className={`p-3.5 rounded-lg text-sm sm:text-base font-medium border ${
                      maintFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {maintFeedback.message}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 text-base font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[50px]"
                >
                  <Plus className="w-5 h-5" />
                  Add Maintenance Log
                </button>
              </form>
            </div>

            {/* Right 7 Cols: Maintenance Log Table */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3.5 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Court Maintenance Schedule & History
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Mark a task as Completed once the court is ready to reopen for player bookings.
                  </p>
                </div>
                <span className="text-sm font-mono font-semibold tabular-nums text-slate-600">
                  {maintenanceTasks.length} records
                </span>
              </div>

              {maintenanceTasks.length === 0 ? (
                <div className="p-8 sm:p-10 text-center text-base text-slate-500">
                  No maintenance tasks logged yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {maintenanceTasks.map((task) => (
                    <div key={task.id} className="p-4 sm:p-5 hover:bg-slate-50/70 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {task.date}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-slate-900">{task.courtId}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {task.slotId === 'ALL_DAY' ? 'ALL DAY' : `${task.slotId} hrs`}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{task.category}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {formatMYR(task.cost)}
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              task.status === 'completed'
                                ? 'text-emerald-800'
                                : task.status === 'in_progress'
                                ? 'text-amber-800'
                                : 'text-slate-700'
                            }`}
                          >
                            {task.status === 'completed'
                              ? 'Completed (Court Open)'
                              : task.status === 'in_progress'
                              ? 'In Progress (Blocked)'
                              : 'Scheduled (Blocked)'}
                          </span>
                        </div>
                      </div>

                      <div className="text-base sm:text-lg font-bold text-slate-900">{task.title}</div>

                      <div className="text-sm text-slate-600">
                        Technician: {task.technician}
                        {task.notes ? ` · ${task.notes}` : ''}
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {task.status !== 'completed' && (
                            <>
                              {task.status === 'scheduled' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateMaintenanceStatus(task.id, 'in_progress')
                                  }
                                  className="px-3.5 py-2 text-sm font-bold bg-amber-100 text-amber-950 hover:bg-amber-200 rounded-lg min-h-[42px]"
                                >
                                  Start Work
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  updateMaintenanceStatus(task.id, 'completed')
                                }
                                className="px-3.5 py-2 text-sm font-bold bg-emerald-100 text-emerald-950 hover:bg-emerald-200 rounded-lg min-h-[42px]"
                              >
                                Mark Completed & Reopen Slot
                              </button>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteMaintenanceTask(task.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold text-slate-500 hover:text-red-600 min-h-[42px]"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: ADMIN & RATES (Edit Slot Rental Fees & Monthly Player Totals)
           ===================================================================== */}
        {activeTab === 'admin' && (
          <div className="space-y-4 sm:space-y-8">
            {adminFeedback && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm sm:text-base font-medium rounded-lg">
                {adminFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              {/* Left 6 Cols: Edit Rental Fee for Each of the 7 Time Slots */}
              <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3.5 sm:p-6 border-b border-slate-200">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-emerald-800" />
                    Edit Standard Rental Fee per Slot (MYR)
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Configure the MYR hourly/slot fee for each of the 7 daily booking windows across Court A and Court B.
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {DEFAULT_SLOTS.map((slot) => {
                    const currentFee = slotPriceMap.get(slot.slotId) ?? slot.fee;
                    const draftVal =
                      slotFeeDrafts[slot.slotId] !== undefined
                        ? slotFeeDrafts[slot.slotId]
                        : String(currentFee);

                    return (
                      <div
                        key={slot.slotId}
                        className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg font-mono font-bold text-slate-900 tabular-nums">
                              {slot.slotId}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-sm text-slate-600">
                              {slot.label} ({slot.hours} hrs)
                            </span>
                          </div>
                          <div className="text-sm text-slate-600 mt-0.5">
                            Current Active Fee:{' '}
                            <span className="font-mono font-bold text-slate-900 tabular-nums">
                              {formatMYR(currentFee)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-slate-600">MYR</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draftVal}
                            onChange={(e) =>
                              setSlotFeeDrafts((prev) => ({
                                ...prev,
                                [slot.slotId]: e.target.value,
                              }))
                            }
                            className="w-24 px-3 py-2 text-base font-mono font-bold text-right bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[44px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveSlotRate(slot.slotId)}
                            className="px-3.5 py-2 text-sm font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap min-h-[44px]"
                          >
                            Update Fee
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Right 6 Cols: Edit Monthly Total Amount to Pay per Player + Player Registry */}
              <div className="lg:col-span-6 space-y-4 sm:space-y-6">
                {/* Monthly Rental Total Override Card */}
                <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3.5 sm:p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                        Edit Monthly Amount to Pay per Rental
                      </h2>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Override or adjust the monthly total payable (MYR) for any player in {formatReadableMonth(selectedMonth)}.
                      </p>
                    </div>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        if (e.target.value) setSelectedMonth(e.target.value);
                      }}
                      className="px-3 py-1.5 text-sm font-mono font-semibold border border-slate-300 rounded-lg bg-white min-h-[42px]"
                    />
                  </div>

                  {monthlyPlayerSummaries.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500">
                      No active or rain-cancelled rentals in {formatReadableMonth(selectedMonth)}.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {monthlyPlayerSummaries.map((row) => {
                        const isEditing = editingMonthlyPlayerId === row.playerId;
                        return (
                          <div
                            key={row.playerId}
                            className="p-4 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-base sm:text-lg font-bold text-slate-900">
                                {row.playerName}
                              </div>
                              <div className="text-sm text-slate-600 font-mono tabular-nums">
                                {row.activeSlots} active · {row.rainCancelledSlots} rain (MYR 0.00) · Auto:{' '}
                                {formatMYR(row.calculatedTotal)}
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.50"
                                  value={monthlyOverrideInput}
                                  onChange={(e) => setMonthlyOverrideInput(e.target.value)}
                                  className="w-24 px-2.5 py-1.5 text-sm font-mono text-right border border-emerald-700 rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveMonthlyOverride(row, false)}
                                  className="px-3 py-1.5 text-sm font-bold text-white bg-emerald-800 rounded-lg"
                                >
                                  Save
                                </button>
                                {row.overrideTotal >= 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveMonthlyOverride(row, true)}
                                    className="px-2.5 py-1.5 text-sm text-slate-700 bg-slate-100 rounded-lg"
                                  >
                                    Reset
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setEditingMonthlyPlayerId(null)}
                                  className="px-2.5 py-1.5 text-sm text-slate-500"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="text-right font-mono tabular-nums">
                                  <div className="text-base sm:text-lg font-bold text-emerald-950">
                                    {formatMYR(row.finalPayableTotal)}
                                  </div>
                                  {row.overrideTotal >= 0 && (
                                    <div className="text-xs font-semibold text-amber-800">
                                      Custom Override
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => startEditMonthlyRow(row)}
                                  className="px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[42px]"
                                >
                                  Edit Total
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Registered Players Directory */}
                <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3.5 sm:p-6 border-b border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                          Registered Club Users ({players.length})
                        </h2>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Register and manage players available in the court booking dropdown.
                        </p>
                      </div>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          const created = await addPlayer(newUserName, newUserType, newUserCode);
                          setSelectedPlayerId(created.id);
                          setNewUserName('');
                          setNewUserCode('');
                          setAdminFeedback(
                            `Registered player "${created.name}" (${created.membershipType} · ${created.membershipCode}).`
                          );
                        } catch (err) {
                          setAdminFeedback(
                            err instanceof Error ? err.message : 'Failed to register player.'
                          );
                        }
                      }}
                      className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3.5"
                    >
                      <div className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4 text-emerald-700" />
                        Register New Player
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-800">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={80}
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="e.g. Dato' Hafiz Ibrahim"
                          className="w-full px-3.5 py-3 text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[48px]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-1">
                            Category
                          </label>
                          <select
                            value={newUserType}
                            onChange={(e) => setNewUserType(e.target.value as MembershipType)}
                            className="w-full px-3.5 py-3 text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[48px]"
                          >
                            <option value="Team">Team</option>
                            <option value="Coach">Coach</option>
                            <option value="Member">Member</option>
                            <option value="Guest">Guest</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-1">
                            Ref Code (Optional)
                          </label>
                          <input
                            type="text"
                            maxLength={24}
                            value={newUserCode}
                            onChange={(e) => setNewUserCode(e.target.value)}
                            placeholder="Auto-generated"
                            className="w-full px-3.5 py-3 text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono min-h-[48px]"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3 px-4 text-base font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg transition-colors min-h-[48px]"
                      >
                        Register Player
                      </button>
                    </form>
                  </div>
                  <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 sm:px-5 py-3.5 flex items-center justify-between text-base hover:bg-slate-50/70"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-sm text-slate-600">
                            {p.membershipType} · {p.membershipCode}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deletePlayer(p.id)}
                          className="p-2 text-slate-400 hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Delete player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Phone Thumb-Zone Bottom Navigation Bar (Visible on Phone/Tablet < md) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 grid grid-cols-4 h-16 shadow-lg"
      >
        <button
          type="button"
          onClick={() => setActiveTab('booking')}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors ${
            activeTab === 'booking'
              ? 'text-emerald-800 bg-emerald-50/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span>Booking</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors ${
            activeTab === 'monthly'
              ? 'text-emerald-800 bg-emerald-50/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Monthly</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors ${
            activeTab === 'maintenance'
              ? 'text-emerald-800 bg-emerald-50/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span>Maint.</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('admin')}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors ${
            activeTab === 'admin'
              ? 'text-emerald-800 bg-emerald-50/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span>Admin</span>
        </button>
      </nav>

      {/* Admin Password Verification Modal for Edit Monthly Total */}
      {pendingPasswordPlayerId && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-password-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="admin-password-modal-title"
                    className="text-base font-semibold text-slate-900"
                  >
                    Admin Password Required
                  </h3>
                  <p className="text-xs text-slate-500">
                    Authenticate to edit the monthly rental total for{' '}
                    <span className="font-medium text-slate-700">
                      {monthlyPlayerSummaries.find(
                        (r) => r.playerId === pendingPasswordPlayerId
                      )?.playerName || 'this player'}
                    </span>
                    .
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingPasswordPlayerId(null);
                  setAdminPasswordInput('');
                  setAdminPasswordError(null);
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close password dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-monthly-password-input"
                  className="block text-xs font-medium text-slate-700"
                >
                  Enter Admin Password
                </label>
                <input
                  id="admin-monthly-password-input"
                  type="password"
                  autoFocus
                  required
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (adminPasswordError) setAdminPasswordError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              {adminPasswordError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {adminPasswordError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPendingPasswordPlayerId(null);
                    setAdminPasswordInput('');
                    setAdminPasswordError(null);
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  Unlock & Edit Total
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Monthly Rental Payment Receipt Popup Modal */}
      {receiptPlayerSummary && (
        <div
          id="printable-receipt-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl my-8">
            {/* Top Modal Action Bar (Hidden when printing) */}
            <div className="no-print px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <FileText className="w-4 h-4 text-emerald-800" />
                <span>Official Payment Receipt</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
                <button
                  type="button"
                  disabled={isDownloadingReceipt}
                  onClick={() => handleDownloadReceipt(receiptPlayerSummary)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isDownloadingReceipt ? 'Generating...' : 'Download Receipt'}
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptPlayerId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  aria-label="Close receipt modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Content (Summaries Only) */}
            <div className="p-6 sm:p-8 space-y-6 bg-white">
              {/* Club Header & Official PAID Badge */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div className="flex items-center gap-3.5">
                  <img
                    src={`${import.meta.env.BASE_URL}assets/aistudio/WhatsApp_Image_2026-11-02_at_06.31.58_20dd0823.jpeg`}
                    alt="Kelab Tenis Taiping Logo"
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div>
                    <h3
                      id="receipt-modal-title"
                      className="text-xl font-bold tracking-tight text-emerald-950 font-display"
                    >
                      KELAB TENIS TAIPING
                    </h3>
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase mt-0.5">
                      Official Monthly Court Rental Receipt
                    </p>
                  </div>
                </div>

                <div className="px-4 py-1.5 bg-emerald-50 border-2 border-emerald-700 rounded-lg text-center">
                  <div className="text-sm font-bold font-mono tracking-widest text-emerald-900">
                    PAID
                  </div>
                  <div className="text-[10px] font-medium text-emerald-800">
                    Payment Verified
                  </div>
                </div>
              </div>

              {/* Player & Receipt Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500 block">Received From</span>
                    <span className="text-sm font-bold text-slate-900">
                      {receiptPlayerSummary.playerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Membership</span>
                    <span className="font-medium text-slate-800">
                      {receiptPlayerSummary.membershipType} · {receiptPlayerSummary.membershipCode}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 sm:text-right">
                  <div>
                    <span className="text-slate-500 block">Receipt Number</span>
                    <span className="font-mono font-bold text-slate-900">
                      {getReceiptNumber(receiptPlayerSummary)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Issue Date</span>
                    <span className="font-medium text-slate-800">
                      {formatReadableDate(getTodayStr())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Rental Summary Table (No Detailed Slot List) */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Monthly Rental Summary Description</th>
                      <th className="py-2.5 px-4 text-right">Summary / Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    <tr>
                      <td className="py-3 px-4 text-slate-700">Billing Month</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatReadableMonth(selectedMonth)} ({selectedMonth})
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-700">Active Court Slots Booked</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {receiptPlayerSummary.activeSlots} slot{receiptPlayerSummary.activeSlots === 1 ? '' : 's'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-700">
                        Rain Cancelled Slots (Waived at MYR 0.00)
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-sky-800">
                        {receiptPlayerSummary.rainCancelledSlots} slot{receiptPlayerSummary.rainCancelledSlots === 1 ? '' : 's'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-700">Total Monthly Slots Reserved</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {receiptPlayerSummary.totalSlots} slot{receiptPlayerSummary.totalSlots === 1 ? '' : 's'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-700">Calculated Court Rental Fee</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-800">
                        {formatMYR(receiptPlayerSummary.calculatedTotal)}
                      </td>
                    </tr>
                    {receiptPlayerSummary.overrideTotal >= 0 && (
                      <tr className="bg-amber-50/60">
                        <td className="py-3 px-4 font-medium text-amber-900">
                          Admin Adjusted Monthly Total
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-amber-900">
                          {formatMYR(receiptPlayerSummary.overrideTotal)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Paid & Remarks */}
              <div className="p-4 bg-[#F8FAF8] border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="font-semibold text-emerald-900">
                    Payment Status: PAID IN FULL
                  </div>
                  {receiptPlayerSummary.adminNote && (
                    <div className="text-slate-700 italic">
                      Note: {receiptPlayerSummary.adminNote}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Total Amount Paid
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-950">
                    {formatMYR(receiptPlayerSummary.finalPayableTotal)}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>Thank you for your payment — KELAB TENIS TAIPING Management</span>
                <span>Computer-generated official receipt</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/WhatsApp_Image_2026-11-02_at_06.31.58_20dd0823.jpeg`}
              alt="Kelab Tenis Taiping Logo"
              className="w-6 h-6 rounded object-cover border border-slate-200 shrink-0"
            />
            <span>KELAB TENIS TAIPING — Tennis Booking & Rental Management · Created by xKINGx</span>
          </div>
          <span>Currency: Malaysian Ringgit (MYR) · Rain Cancellation Waiver Policy Active</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <FirestoreErrorBoundary>
      <CourtBookingWorkspace />
    </FirestoreErrorBoundary>
  );
}
