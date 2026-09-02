# Milestone 18 — Security & Boundary Validation Report

### 1. Security & Operational Surface Boundaries

FAFLOW maintains three strictly enforced operational surfaces:
1. **FAFLOW Web Application**: Primary interface for Teachers, HODs, Institution Admins, and Platform Governance.
2. **FAFLOW Android Application**: Operational client exclusively for **Teacher** and **HOD** staff workflows.
3. **Governance Control Panel**: Platform-wide control plane accessible strictly to **System Admin** via Web.

---

### 2. Verified Security Rules
- **No Governance Exposure on Mobile**: Mobile navigation completely removes any administrative, database, server, or geofence mutation canvas routes.
- **Server Policy Authoritative Gating**: Biometric face enrollment and template update permissions are checked against the server policy endpoint (`GET /system/institutions/{id}/policy`) before launching capture flows.
- **Tenant Department Isolation**: Secondary admins (HODs) cannot access or modify records outside their assigned department.
- **Hardware-Backed Cryptography**: All authentication tokens and user credentials are encrypted using AndroidX Security (`MasterKey` + `EncryptedSharedPreferences`).
- **No Biometric Vector Leakage**: Raw facial images and embeddings are processed locally and never transmitted across the network during standard attendance verification.
