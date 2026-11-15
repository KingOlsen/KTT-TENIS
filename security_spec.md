# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched in `firestore.rules` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: All mutations (`create`, `update`, `delete`) require an authenticated user with `request.auth != null && request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates its path ID using `isValidId(id)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Relational Club Scope (`clubId`)**: Every document in `/players`, `/bookings`, `/slotPricing`, `/monthlyAdjustments`, and `/maintenance` must have `clubId == 'court_club_main'`, and `allow list` rules explicitly enforce `existing().clubId == 'court_club_main'`.
5. **Relational Player Existence**: Creating a `/bookings/{bookingId}` or `/monthlyAdjustments/{adjustmentId}` record requires `exists(/databases/$(database)/documents/players/$(incoming().playerId))` to prevent orphaned bookings or billing adjustments.
6. **Rain Cancellation Fee Invariant**: In `/bookings/{bookingId}`, when `status == 'rain_cancelled'`, `fee` MUST be `0`. When `status == 'active'`, `fee` must be `>= 0 && <= 10000`.
7. **Temporal Integrity**: `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`. `updatedAt` must equal `request.time` on both `create` and `update`.
8. **Terminal State Locking**: In `/maintenance/{maintenanceId}`, once `existing().status == 'completed'`, non-admin users cannot mutate the record further.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on Booking Create**: Adding `isFreeForever: true` to `/bookings/2026-10-31_CourtA_0800-1000` -> `PERMISSION_DENIED` via `.keys().hasOnly(...)`.
2. **Identity Spoofing on Booking Create**: Setting `createdBy: "victim_uid_999"` when `request.auth.uid == "attacker_uid_1"` -> `PERMISSION_DENIED`.
3. **Unverified Email Admin Spoof**: Authenticating with `email: "sultanhaseng@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
4. **Orphaned Booking Create**: Creating a booking referencing `playerId: "non_existent_player_99"` where `/players/non_existent_player_99` does not exist -> `PERMISSION_DENIED`.
5. **Rain Cancellation Non-Zero Fee Bypass**: Updating a booking to `status: "rain_cancelled"` while keeping `fee: 50` -> `PERMISSION_DENIED`.
6. **Negative Rental Fee Injection**: Admin or user updating `fee: -250` on `/bookings/{id}` or `/slotPricing/{id}` -> `PERMISSION_DENIED`.
7. **Invalid Time Slot Enum Injection**: Creating a booking with `slotId: "0000-0600"` outside the 7 allowed slots -> `PERMISSION_DENIED`.
8. **Invalid Court Enum Injection**: Creating a booking with `courtId: "Court C"` -> `PERMISSION_DENIED`.
9. **Path ID Poisoning**: Creating a player document with a 300-character ID or special characters `player$@#/` -> `PERMISSION_DENIED`.
10. **Immortal Field Mutation**: Attempting to alter `createdAt` or `createdBy` during a booking update -> `PERMISSION_DENIED`.
11. **Terminal State Re-opening by Non-Admin**: Updating a `/maintenance/{id}` document whose `existing().status == 'completed'` as a standard user -> `PERMISSION_DENIED`.
12. **Unscoped List Query Scraping**: Listing `/bookings` without filtering by `clubId == 'court_club_main'` -> `PERMISSION_DENIED`.
