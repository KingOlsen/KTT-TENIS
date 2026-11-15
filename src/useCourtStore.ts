import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  Booking,
  CLUB_ID,
  CourtId,
  DEFAULT_SLOTS,
  MaintenanceCategory,
  MaintenanceSlotId,
  MaintenanceStatus,
  MaintenanceTask,
  makeBookingDocId,
  makeMonthlyAdjustmentDocId,
  MembershipType,
  MonthlyAdjustment,
  Player,
  sanitizeId,
  SlotId,
  SlotPricing,
  VALIDATION_CONSTRAINTS,
} from './types';

const SHARED_ACTOR_ID = 'club_shared_sync';

function getActorId(): string {
  return auth.currentUser?.uid || SHARED_ACTOR_ID;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const INITIAL_SEED_PLAYERS: Player[] = [
  {
    id: 'player_ahmad_razak',
    clubId: CLUB_ID,
    name: 'Ahmad Razak',
    membershipCode: 'MBR-104',
    membershipType: 'Member',
    createdBy: SHARED_ACTOR_ID,
  },
  {
    id: 'player_mei_ling_tan',
    clubId: CLUB_ID,
    name: 'Mei Ling Tan',
    membershipCode: 'TM-209',
    membershipType: 'Team',
    createdBy: SHARED_ACTOR_ID,
  },
  {
    id: 'player_kavin_subra',
    clubId: CLUB_ID,
    name: 'Kavin Subramaniam',
    membershipCode: 'MBR-118',
    membershipType: 'Member',
    createdBy: SHARED_ACTOR_ID,
  },
  {
    id: 'player_sarah_farid',
    clubId: CLUB_ID,
    name: 'Sarah Farid',
    membershipCode: 'GST-302',
    membershipType: 'Guest',
    createdBy: SHARED_ACTOR_ID,
  },
];

export function useCourtStore() {
  const [cloudLoading, setCloudLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>(INITIAL_SEED_PLAYERS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slotPricing, setSlotPricing] = useState<SlotPricing[]>(() =>
    DEFAULT_SLOTS.map((s) => ({
      ...s,
      clubId: CLUB_ID,
      updatedBy: SHARED_ACTOR_ID,
    }))
  );
  const [monthlyAdjustments, setMonthlyAdjustments] = useState<MonthlyAdjustment[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);

  // Real-time Firestore listeners active automatically across all devices without login
  useEffect(() => {
    setCloudLoading(true);
    let initialSlotsChecked = false;
    let initialPlayersChecked = false;

    const playersQuery = query(collection(db, 'players'), where('clubId', '==', CLUB_ID));
    const unsubPlayers = onSnapshot(
      playersQuery,
      async (snapshot) => {
        const list: Player[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<Player, 'id'>),
          id: d.id,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));

        if (list.length > 0) {
          setPlayers(list);
        }

        if (snapshot.metadata.fromCache) {
          return;
        }

        // Seed initial players into Firestore if cloud collection is completely empty
        if (!initialPlayersChecked && list.length === 0) {
          initialPlayersChecked = true;
          try {
            const actorId = getActorId();
            for (const p of INITIAL_SEED_PLAYERS) {
              const pRef = doc(db, 'players', p.id);
              const existingSnap = await getDoc(pRef);
              if (!existingSnap.exists()) {
                await setDoc(pRef, {
                  clubId: CLUB_ID,
                  name: p.name.slice(0, VALIDATION_CONSTRAINTS.PLAYER_NAME_MAX),
                  membershipCode: p.membershipCode.slice(
                    0,
                    VALIDATION_CONSTRAINTS.MEMBERSHIP_CODE_MAX
                  ),
                  membershipType: p.membershipType,
                  createdBy: actorId,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'players');
          }
        } else {
          initialPlayersChecked = true;
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'players')
    );

    const slotsQuery = query(collection(db, 'slotPricing'), where('clubId', '==', CLUB_ID));
    const unsubSlots = onSnapshot(
      slotsQuery,
      async (snapshot) => {
        const list: SlotPricing[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<SlotPricing, 'id'>),
          id: d.id as SlotId,
        }));

        if (list.length > 0) {
          const merged = DEFAULT_SLOTS.map((def) => {
            const found = list.find((item) => item.slotId === def.slotId);
            return (
              found || {
                ...def,
                clubId: CLUB_ID,
                updatedBy: getActorId(),
              }
            );
          });
          setSlotPricing(merged);
        }

        if (snapshot.metadata.fromCache) {
          return;
        }

        if (!initialSlotsChecked && list.length < DEFAULT_SLOTS.length) {
          initialSlotsChecked = true;
          try {
            const actorId = getActorId();
            const existingIds = new Set(list.map((x) => x.slotId));
            for (const s of DEFAULT_SLOTS) {
              if (!existingIds.has(s.slotId)) {
                const sRef = doc(db, 'slotPricing', s.slotId);
                const existingSnap = await getDoc(sRef);
                if (!existingSnap.exists()) {
                  await setDoc(sRef, {
                    clubId: CLUB_ID,
                    slotId: s.slotId,
                    label: s.label.slice(0, VALIDATION_CONSTRAINTS.SLOT_LABEL_MAX),
                    hours: s.hours,
                    fee: s.fee,
                    updatedBy: actorId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }
              }
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'slotPricing');
          }
        } else {
          initialSlotsChecked = true;
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'slotPricing')
    );

    const bookingsQuery = query(collection(db, 'bookings'), where('clubId', '==', CLUB_ID));
    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const list: Booking[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<Booking, 'id'>),
          id: d.id,
        }));
        list.sort((a, b) => {
          const cmpDate = a.date.localeCompare(b.date);
          if (cmpDate !== 0) return cmpDate;
          const cmpCourt = a.courtId.localeCompare(b.courtId);
          if (cmpCourt !== 0) return cmpCourt;
          return a.slotId.localeCompare(b.slotId);
        });
        setBookings(list);
        setCloudLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
    );

    const adjustmentsQuery = query(
      collection(db, 'monthlyAdjustments'),
      where('clubId', '==', CLUB_ID)
    );
    const unsubAdjustments = onSnapshot(
      adjustmentsQuery,
      (snapshot) => {
        const list: MonthlyAdjustment[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<MonthlyAdjustment, 'id'>),
          id: d.id,
        }));
        setMonthlyAdjustments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'monthlyAdjustments')
    );

    const maintenanceQuery = query(
      collection(db, 'maintenance'),
      where('clubId', '==', CLUB_ID)
    );
    const unsubMaintenance = onSnapshot(
      maintenanceQuery,
      (snapshot) => {
        const list: MaintenanceTask[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<MaintenanceTask, 'id'>),
          id: d.id,
        }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setMaintenanceTasks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'maintenance')
    );

    return () => {
      unsubPlayers();
      unsubSlots();
      unsubBookings();
      unsubAdjustments();
      unsubMaintenance();
    };
  }, []);

  // 1. Add Player (Direct Cloud Firestore Sync)
  const addPlayer = useCallback(
    async (
      name: string,
      membershipType: MembershipType,
      membershipCode?: string
    ): Promise<Player> => {
      const cleanName = name.trim().slice(0, VALIDATION_CONSTRAINTS.PLAYER_NAME_MAX);
      if (!cleanName) {
        throw new Error('Player name is required.');
      }
      const prefixMap: Record<MembershipType, string> = {
        Team: 'TM',
        Coach: 'CCH',
        Member: 'MBR',
        Guest: 'GST',
      };
      const prefix = prefixMap[membershipType] || membershipType.slice(0, 3).toUpperCase();
      const code = (
        membershipCode?.trim() ||
        `${prefix}-${Math.floor(100 + Math.random() * 900)}`
      ).slice(0, VALIDATION_CONSTRAINTS.MEMBERSHIP_CODE_MAX);

      const playerId = sanitizeId(
        `player_${cleanName.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString(36)}`
      );
      const actorId = getActorId();

      const newPlayer: Player = {
        id: playerId,
        clubId: CLUB_ID,
        name: cleanName,
        membershipCode: code,
        membershipType,
        createdBy: actorId,
      };

      try {
        await setDoc(doc(db, 'players', playerId), {
          clubId: CLUB_ID,
          name: cleanName,
          membershipCode: code,
          membershipType,
          createdBy: actorId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `players/${playerId}`);
      }

      return newPlayer;
    },
    []
  );

  // 2. Delete Player (Direct Cloud Firestore Sync)
  const deletePlayer = useCallback(async (playerId: string) => {
    try {
      await deleteDoc(doc(db, 'players', playerId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `players/${playerId}`);
    }
  }, []);

  // 3. Create Multi-Slot Bookings across Court A and/or Court B (Direct Cloud Firestore Sync)
  const createMultiSlotBookings = useCallback(
    async (params: {
      date: string;
      selections: Array<{ courtId: CourtId; slotId: SlotId }>;
      playerId: string;
      notes?: string;
    }) => {
      const { date, selections, playerId, notes = '' } = params;
      if (!VALIDATION_CONSTRAINTS.DATE_REGEX.test(date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD.');
      }
      if (selections.length === 0) {
        throw new Error('Select at least one time slot to book.');
      }

      const player = players.find((p) => p.id === playerId);
      if (!player) {
        throw new Error('Please select a valid registered player.');
      }

      // Check for clashes against existing bookings and active maintenance blocks
      for (const { courtId, slotId } of selections) {
        const existingBooking = bookings.find(
          (b) => b.date === date && b.courtId === courtId && b.slotId === slotId
        );
        if (existingBooking) {
          throw new Error(
            `Clash detected: ${courtId} slot ${slotId} on ${date} is already booked by ${existingBooking.playerName}.`
          );
        }

        const maintClash = maintenanceTasks.find(
          (m) =>
            m.date === date &&
            m.courtId === courtId &&
            m.status !== 'completed' &&
            (m.slotId === 'ALL_DAY' || m.slotId === slotId)
        );
        if (maintClash) {
          throw new Error(
            `Maintenance lock: ${courtId} slot ${slotId} on ${date} is blocked for "${maintClash.title}".`
          );
        }
      }

      const month = date.slice(0, 7);
      const cleanNotes = notes.trim().slice(0, VALIDATION_CONSTRAINTS.BOOKING_NOTES_MAX);
      const actorId = getActorId();

      for (const { courtId, slotId } of selections) {
        const pricing = slotPricing.find((s) => s.slotId === slotId);
        const standardFee = pricing ? pricing.fee : 40;
        const bookingId = makeBookingDocId(date, courtId, slotId);

        try {
          await setDoc(doc(db, 'bookings', bookingId), {
            clubId: CLUB_ID,
            date,
            month,
            courtId,
            slotId,
            playerId: player.id,
            playerName: player.name.slice(0, VALIDATION_CONSTRAINTS.PLAYER_NAME_MAX),
            status: 'active',
            fee: standardFee,
            standardFee,
            notes: cleanNotes,
            createdBy: actorId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `bookings/${bookingId}`);
        }
      }
    },
    [bookings, maintenanceTasks, players, slotPricing]
  );

  // 4. Toggle Rain Cancellation (Fee becomes MYR 0.00 when cancelled due to rain)
  const toggleRainCancellation = useCallback(
    async (bookingId: string, rainNote?: string) => {
      const target = bookings.find((b) => b.id === bookingId);
      if (!target) return;

      const isCurrentlyRainCancelled = target.status === 'rain_cancelled';
      const nextStatus = isCurrentlyRainCancelled ? 'active' : 'rain_cancelled';
      const nextFee = nextStatus === 'rain_cancelled' ? 0 : target.standardFee;
      const nextNotes =
        rainNote !== undefined
          ? rainNote.trim().slice(0, VALIDATION_CONSTRAINTS.BOOKING_NOTES_MAX)
          : nextStatus === 'rain_cancelled'
          ? 'Cancelled due to rain — fee waived to MYR 0.00'
          : target.notes;

      try {
        await updateDoc(doc(db, 'bookings', bookingId), {
          status: nextStatus,
          fee: nextFee,
          notes: nextNotes,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
      }
    },
    [bookings]
  );

  // 5. Admin Update Individual Booking Fee
  const updateBookingFee = useCallback(
    async (bookingId: string, newFee: number, notes?: string) => {
      const target = bookings.find((b) => b.id === bookingId);
      if (!target) return;
      const clampedFee = Math.max(
        0,
        Math.min(VALIDATION_CONSTRAINTS.MAX_SLOT_FEE, Number(newFee) || 0)
      );
      const effectiveFee = target.status === 'rain_cancelled' ? 0 : clampedFee;
      const nextNotes =
        notes !== undefined
          ? notes.trim().slice(0, VALIDATION_CONSTRAINTS.BOOKING_NOTES_MAX)
          : target.notes;

      try {
        await updateDoc(doc(db, 'bookings', bookingId), {
          playerId: target.playerId,
          playerName: target.playerName,
          fee: effectiveFee,
          standardFee: clampedFee,
          notes: nextNotes,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
      }
    },
    [bookings]
  );

  // 6. Delete Booking (Frees slot completely)
  const deleteBooking = useCallback(async (bookingId: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bookings/${bookingId}`);
    }
  }, []);

  // 7. Admin Update Slot Default Rental Fee
  const updateSlotStandardFee = useCallback(
    async (slotId: SlotId, newFee: number) => {
      const clampedFee = Math.max(
        0,
        Math.min(VALIDATION_CONSTRAINTS.MAX_SLOT_FEE, Number(newFee) || 0)
      );
      const target = slotPricing.find((s) => s.slotId === slotId);
      if (!target) return;
      const actorId = getActorId();

      try {
        await updateDoc(doc(db, 'slotPricing', slotId), {
          fee: clampedFee,
          label: target.label.slice(0, VALIDATION_CONSTRAINTS.SLOT_LABEL_MAX),
          updatedBy: actorId,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `slotPricing/${slotId}`);
      }
    },
    [slotPricing]
  );

  // 8. Admin Save Monthly Total Override / Payment Status for a Player
  const saveMonthlyAdjustment = useCallback(
    async (params: {
      month: string;
      playerId: string;
      playerName: string;
      overrideTotal: number;
      paymentStatus: 'unpaid' | 'paid';
      adminNote?: string;
    }) => {
      const {
        month,
        playerId,
        playerName,
        overrideTotal,
        paymentStatus,
        adminNote = '',
      } = params;
      const adjustmentId = makeMonthlyAdjustmentDocId(month, playerId);
      const safeOverride =
        overrideTotal < 0
          ? -1
          : Math.min(VALIDATION_CONSTRAINTS.MAX_MONTHLY_TOTAL, Number(overrideTotal) || 0);
      const cleanNote = adminNote.trim().slice(0, VALIDATION_CONSTRAINTS.ADMIN_NOTE_MAX);
      const cleanPlayerName = playerName
        .trim()
        .slice(0, VALIDATION_CONSTRAINTS.PLAYER_NAME_MAX);
      const actorId = getActorId();

      const existing = monthlyAdjustments.find((a) => a.id === adjustmentId);

      try {
        if (existing) {
          await updateDoc(doc(db, 'monthlyAdjustments', adjustmentId), {
            overrideTotal: safeOverride,
            paymentStatus,
            adminNote: cleanNote,
            playerName: cleanPlayerName,
            updatedBy: actorId,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'monthlyAdjustments', adjustmentId), {
            clubId: CLUB_ID,
            month,
            playerId,
            playerName: cleanPlayerName,
            overrideTotal: safeOverride,
            paymentStatus,
            adminNote: cleanNote,
            updatedBy: actorId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(
          err,
          existing ? OperationType.UPDATE : OperationType.CREATE,
          `monthlyAdjustments/${adjustmentId}`
        );
      }
    },
    [monthlyAdjustments]
  );

  // 9. Add Maintenance Task
  const addMaintenanceTask = useCallback(
    async (params: {
      date: string;
      courtId: CourtId;
      slotId: MaintenanceSlotId;
      title: string;
      category: MaintenanceCategory;
      technician: string;
      cost: number;
      status: MaintenanceStatus;
      notes: string;
    }) => {
      const cleanTitle = params.title.trim().slice(0, VALIDATION_CONSTRAINTS.MAINT_TITLE_MAX);
      if (!cleanTitle) {
        throw new Error('Maintenance title is required.');
      }
      const cleanTech = params.technician
        .trim()
        .slice(0, VALIDATION_CONSTRAINTS.MAINT_TECH_MAX);
      const cleanNotes = params.notes
        .trim()
        .slice(0, VALIDATION_CONSTRAINTS.MAINT_NOTES_MAX);
      const safeCost = Math.max(
        0,
        Math.min(VALIDATION_CONSTRAINTS.MAX_MONTHLY_TOTAL, Number(params.cost) || 0)
      );

      // Check if an active booking exists on that date/court/slot
      if (params.status !== 'completed') {
        const clashingBooking = bookings.find(
          (b) =>
            b.date === params.date &&
            b.courtId === params.courtId &&
            b.status === 'active' &&
            (params.slotId === 'ALL_DAY' || b.slotId === params.slotId)
        );
        if (clashingBooking) {
          throw new Error(
            `Cannot block ${params.courtId} (${params.slotId}) on ${params.date}: active booking exists for ${clashingBooking.playerName}. Cancel or remove the booking first.`
          );
        }
      }

      const maintId = sanitizeId(
        `maint_${params.date}_${params.courtId === 'Court A' ? 'CourtA' : 'CourtB'}_${params.slotId}_${Date.now().toString(36)}`
      );
      const actorId = getActorId();

      try {
        await setDoc(doc(db, 'maintenance', maintId), {
          clubId: CLUB_ID,
          date: params.date || getTodayDateString(),
          courtId: params.courtId,
          slotId: params.slotId,
          title: cleanTitle,
          category: params.category,
          technician: cleanTech || 'Club Maintenance Crew',
          cost: safeCost,
          status: params.status,
          notes: cleanNotes,
          createdBy: actorId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `maintenance/${maintId}`);
      }
    },
    [bookings]
  );

  // 10. Update Maintenance Status
  const updateMaintenanceStatus = useCallback(
    async (maintId: string, nextStatus: MaintenanceStatus) => {
      const target = maintenanceTasks.find((m) => m.id === maintId);
      if (!target) return;

      try {
        await updateDoc(doc(db, 'maintenance', maintId), {
          status: nextStatus,
          notes: target.notes,
          cost: target.cost,
          technician: target.technician,
          title: target.title,
          category: target.category,
          slotId: target.slotId,
          courtId: target.courtId,
          date: target.date,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `maintenance/${maintId}`);
      }
    },
    [maintenanceTasks]
  );

  // 11. Delete Maintenance Task
  const deleteMaintenanceTask = useCallback(async (maintId: string) => {
    try {
      await deleteDoc(doc(db, 'maintenance', maintId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `maintenance/${maintId}`);
    }
  }, []);

  return {
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
  };
}
