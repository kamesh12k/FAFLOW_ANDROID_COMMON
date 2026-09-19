# Milestone 16: Unified RBAC Matrix (Including Governance Control Plane)

---

## 1. Role Hierarchy

```
SYSTEM_ADMIN  ← Highest authority
      │
  GOVERNANCE   ← Cross-institutional oversight
      │
  PRINCIPAL    ← Institution-wide view
      │
     HOD       ← Department scope
      │
  MANAGER      ← Campus operations
      │
  TEACHER / FACULTY / LAB_STAFF / NON_TEACHING_STAFF
```

---

## 2. Governance Control Plane Permission Matrix

| Action | SYSTEM_ADMIN | GOVERNANCE | PRINCIPAL | HOD | MANAGER | TEACHER |
|---|---|---|---|---|---|---|
| Create Institution | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| View Institutions | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Assign Plan | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Enable/Disable Feature | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Lock/Unlock Feature | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Read Biometric Policy | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Update Biometric Policy | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| View Audit Logs | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |

---

## 3. Geofence Permission Matrix (Updated Milestone 16)

| Action | SYSTEM_ADMIN | ADMIN | GOVERNANCE | PRINCIPAL | HOD | MANAGER | TEACHER |
|---|---|---|---|---|---|---|---|
| `GET /geofences/active` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /geofences/` | ✅ | ✅ | ✅ | ✅ (read) | ❌ | ❌ | ❌ |
| `POST /geofences/` | ✅ | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |
| `PUT /geofences/{id}` | ✅ | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |
| `PATCH /geofences/{id}/toggle` | ✅ | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |
| `DELETE /geofences/{id}` | ✅ | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** | ❌ **403** |

> **Before Milestone 16**: `admin` role could create/update/delete geofences.  
> **After Milestone 16**: Geofence mutations are `system_admin` exclusive.
