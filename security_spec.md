# EYE-CU Firestore Security Specification

## 1. Data Invariants
1. **Admin-Only Writes**: Unauthenticated users and non-admin signed-in users can read the public `/campus_places` directory, but can never create, modify, or delete any document in `/campus_places` or `/admins`.
2. **Email Verification Enforcement**: Every admin check requires `request.auth.token.email_verified == true`.
3. **Strict Schema & No Shadow Fields**: Every write to `/campus_places/{placeId}` must satisfy `keys().hasAll(...)` and `keys().hasOnly(...)` with strict bounds on all strings, numbers, booleans, and server timestamps (`request.time`).
4. **Immortal & Identity-Locked Fields**: `id`, `createdAt`, and `updatedBy == request.auth.uid` are enforced; `id` and `createdAt` cannot be modified during updates.
5. **PII Isolation**: `/campus_places` contains zero PII. Admin email addresses in `/admins/{userId}` are readable only by the matching user (`request.auth.uid == userId`) or the bootstrapped primary admin.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Anonymous client `POST` to `/campus_places/block-x` -> `PERMISSION_DENIED`.
2. **Non-Admin Authenticated Create**: Signed-in verified user not in `/admins` and not bootstrap admin writes `/campus_places/block-x` -> `PERMISSION_DENIED`.
3. **Unverified Email Spoof**: Signed-in user with `email == 'akowonjonanayaw@gmail.com'` and `email_verified == false` writes `/campus_places/block-x` -> `PERMISSION_DENIED`.
4. **Self-Privilege Escalation**: Non-admin user tries to create `/admins/{ownUid}` with `role: 'admin'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Admin creates `/campus_places/block-x` with extra field `isVerified: true` -> `PERMISSION_DENIED`.
6. **ID Mismatch**: Admin writes `/campus_places/block-x` with `data.id: 'other-id'` -> `PERMISSION_DENIED`.
7. **Invalid Path ID Poisoning**: Admin writes `/campus_places/bad$id/..` -> `PERMISSION_DENIED`.
8. **Coordinate Out-of-Bounds**: Admin writes `latitude: 200` or `longitude: "0.08"` -> `PERMISSION_DENIED`.
9. **Resource Exhaustion String**: Admin writes `note` > 240 chars or `name` > 100 chars -> `PERMISSION_DENIED`.
10. **Forged Timestamp on Create/Update**: Admin sends client-forged `createdAt` != `request.time` -> `PERMISSION_DENIED`.
11. **Immortal Field Mutation**: Admin changes `createdAt` or `id` on update -> `PERMISSION_DENIED`.
12. **PII Cross-Read**: Signed-in non-admin user tries to read `/admins/{otherUid}` or `list` `/admins` -> `PERMISSION_DENIED`.
13. **Indoor Step Array & Payload Abuse**: Admin sends `indoorSteps` with > 15 items, invalid `directionIcon`, or oversized `landmarkImageUrl` (> 40,000 chars) -> `PERMISSION_DENIED`.

