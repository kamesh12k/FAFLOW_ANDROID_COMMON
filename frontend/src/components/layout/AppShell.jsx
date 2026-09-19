import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import MobileDrawer from './MobileDrawer'
import PolicyConsentModal from '../onboarding/PolicyConsentModal'
import GuidedTour from '../onboarding/GuidedTour'
import HelpGuideModal from '../onboarding/HelpGuideModal'

export default function AppShell() {
  const { user, updateUser } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const mainRef = useRef(null)
  const { pathname, search } = useLocation()

  // Reset scroll position on route/navigation change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      mainRef.current.scrollTop = 0
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, search])

  // Lock body scroll when mobile drawer is open to prevent background scrolling
  useEffect(() => {
    if (drawerOpen) {
      document.body.classList.add('drawer-open')
    } else {
      document.body.classList.remove('drawer-open')
    }
    return () => {
      document.body.classList.remove('drawer-open')
    }
  }, [drawerOpen])

  // Global listeners for Help and Replay Tour
  useEffect(() => {
    const handleOpenHelp = () => setHelpOpen(true)
    const handleStartTour = () => setTourOpen(true)
    window.addEventListener('faflow:open-help', handleOpenHelp)
    window.addEventListener('faflow:start-tour', handleStartTour)
    return () => {
      window.removeEventListener('faflow:open-help', handleOpenHelp)
      window.removeEventListener('faflow:start-tour', handleStartTour)
    }
  }, [])

  // Auto-launch guided tour if policy is accepted but onboarding is not completed
  const needsPolicyConsent = user && !user.policy_version_accepted
  const needsOnboardingTour = user && user.policy_version_accepted && !user.onboarding_completed

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-surface">
      <Sidebar onOpenHelp={() => setHelpOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar onOpenHelp={() => setHelpOpen(true)} />
        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-20 lg:pb-8">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav onMoreClick={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpenHelp={() => setHelpOpen(true)} />

      {/* Policy Consent Modal */}
      <PolicyConsentModal
        isOpen={needsPolicyConsent}
        user={user}
        onConsentAccepted={(updatedUser) => {
          updateUser(updatedUser)
        }}
      />

      {/* Guided Tour Walkthrough */}
      <GuidedTour
        isOpen={tourOpen || (!needsPolicyConsent && needsOnboardingTour)}
        user={user}
        onComplete={() => {
          setTourOpen(false)
          if (user) {
            updateUser({ ...user, onboarding_completed: true })
          }
        }}
      />

      {/* Help & Guide Modal */}
      <HelpGuideModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        user={user}
        onReplayTour={() => {
          setTourOpen(true)
        }}
      />
    </div>
  )
}
