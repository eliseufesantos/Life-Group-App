---
name: Object storage ACL serving
description: The object-storage template serves private objects without auth/ACL by default — must be enabled
---

Rule: The object-storage skill template's private serving route (`GET /storage/objects/*`) ships with the auth and ACL checks only as commented-out examples and streams objects unconditionally. When copying the template you MUST:
1. Add the app's auth middleware to the route.
2. Call `objectStorageService.canAccessObjectEntity({ userId, objectFile, requestedPermission: READ })` and return 403 on deny.
3. Set an ACL policy at entity-create time via `trySetObjectEntityAclPolicy(objectPath, { owner, visibility })` — objects with no ACL policy are denied for everyone once the check is enabled (visibility "public" + authed route = all logged-in users can view).

**Why:** An architect review flagged this as a severe broken-access-control vulnerability: uploaded private files were readable by unauthenticated users who knew the URL.

**How to apply:** Any time object storage serving is added to a server, wire auth + ACL immediately and set the ACL policy in the endpoint that records the uploaded object.
