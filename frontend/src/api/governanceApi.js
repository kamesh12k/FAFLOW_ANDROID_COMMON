/**
 * Governance Rules & Period Config API Client
 * Wraps all /system/governance/* endpoints.
 */
import api from './client'

// ─── Business Rules ───────────────────────────────────────────────────────

export const governanceApi = {
  /** List all business rules, optionally filtered */
  listRules: (params = {}) =>
    api.get('/system/governance/rules', { params }),

  /** Get a single rule by key */
  getRule: (key) =>
    api.get(`/system/governance/rules/${encodeURIComponent(key)}`),

  /** Update a rule value with a mandatory reason */
  updateRule: (key, value, reason) =>
    api.put(`/system/governance/rules/${encodeURIComponent(key)}`, { value: String(value), reason }),

  /** Reset a rule to its factory default */
  resetRule: (key, reason = 'Reset to factory default') =>
    api.post(`/system/governance/rules/reset/${encodeURIComponent(key)}`, { reason }),

  /** Preview / validate a proposed rule change without committing */
  validateRule: (key, value) =>
    api.post('/system/governance/rules/validate', { key, value: String(value) }),

  // ─── History & Rollback ───────────────────────────────────────────────

  /** Complete change history, optionally filtered by key */
  getHistory: (params = {}) =>
    api.get('/system/governance/history', { params }),

  /** History for a single rule */
  getRuleHistory: (key, limit = 20) =>
    api.get(`/system/governance/rules/${encodeURIComponent(key)}/history`, { params: { limit } }),

  /** Roll back to a previous history snapshot */
  rollback: (historyId, reason = 'Rollback to previous version') =>
    api.post(`/system/governance/rollback/${historyId}`, { reason }),

  // ─── Period Schedule ─────────────────────────────────────────────────

  /** Get all period configs (admin, includes disabled) */
  getPeriods: () =>
    api.get('/system/governance/periods'),

  /** Bulk-update the period schedule */
  updatePeriods: (periods) =>
    api.put('/system/governance/periods', { periods }),

  // ─── Public Config (no auth) ──────────────────────────────────────────

  /** Lightweight public config for Android / Web runtime sync */
  getPublicConfig: () =>
    api.get('/system/governance/public-config'),
}

export default governanceApi
