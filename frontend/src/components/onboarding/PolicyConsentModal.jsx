import { useState, useEffect } from 'react'
import { policyApi } from '../../api/services'
import { Spinner, ErrorAlert } from '../ui'

export default function PolicyConsentModal({ isOpen, user, onConsentAccepted }) {
  const [policyData, setPolicyData] = useState(null)
  const [activeTab, setActiveTab] = useState('privacy')
  const [hasAgreed, setHasAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError('')
    policyApi.getCurrent()
      .then(res => {
        setPolicyData(res.data)
        if (res.data?.sections?.length > 0) {
          setActiveTab(res.data.sections[0].id)
        }
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Unable to load institutional policies. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const handleAccept = async () => {
    if (!hasAgreed || !policyData) return
    setSubmitting(true)
    setError('')
    try {
      const { data } = await policyApi.acceptPolicy(policyData.version)
      if (onConsentAccepted) {
        onConsentAccepted(data.user)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record policy consent. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeSection = policyData?.sections?.find(s => s.id === activeTab) || policyData?.sections?.[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center font-black">
              🛡️
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Institutional Privacy & Policies</span>
                {policyData?.version && (
                  <span className="text-[10px] uppercase font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    {policyData.version}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Please review and acknowledge the institutional data policies before proceeding.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <ErrorAlert message={error} />

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Spinner size="lg" />
              <span className="text-xs font-semibold">Loading institutional policies...</span>
            </div>
          ) : (
            <>
              {/* Section Tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                {policyData?.sections?.map(section => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveTab(section.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeTab === section.id
                        ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>

              {/* Active Section Content Card */}
              {activeSection && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    {activeSection.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {activeSection.content}
                  </p>
                </div>
              )}

              {/* Summary of User Rights & Responsibilities */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>ℹ️ Key Institutional Commitment</span>
                </div>
                <p className="text-[11px] leading-normal text-blue-800/90 dark:text-blue-300">
                  Your attendance, substitution, and leave data are processed strictly for institutional administration. Location queries occur only during active attendance marking within verified campus geofences.
                </p>
              </div>

              {/* Explicit Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-slate-900 cursor-pointer transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={hasAgreed}
                    onChange={(e) => setHasAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      I have read, understood, and agree to the institutional policies and terms of use.
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Your explicit consent with policy version {policyData?.version || 'v1.0.0'} and timestamp will be securely recorded in your account audit history.
                    </p>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-medium">
            Effective Date: {policyData?.effective_date || '2026-09-01'}
          </div>
          <button
            type="button"
            disabled={!hasAgreed || submitting || loading}
            onClick={handleAccept}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 shadow-sm ${
              hasAgreed && !submitting && !loading
                ? 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <Spinner size="xs" color="white" />
                <span>Recording Consent...</span>
              </>
            ) : (
              <span>Accept & Continue →</span>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
