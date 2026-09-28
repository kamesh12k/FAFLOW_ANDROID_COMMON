import { useState } from 'react'
import {
  Button,
  Input,
  Textarea,
  Select,
  MultiSelect,
  DatePicker,
  TimePicker,
  Card,
  StatCard,
  StatusBadge,
  RoleBadge,
  DayTypeBadge,
  Chip,
  CreditChip,
  Tabs,
  Modal,
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  AlertBanner,
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  PageHeader,
  Table
} from '../../components/ui'
import { FaflowColors, FaflowRoleColors, FaflowStatusColors } from '../../tokens/designTokens'

export default function ComponentPreview() {
  const [activeTab, setActiveTab] = useState('buttons')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [multiSelected, setMultiSelected] = useState(['cs', 'ec'])
  const [textInputVal, setTextInputVal] = useState('Prof. Alan Turing')
  const [chips, setChips] = useState(['Biometrics', 'CameraX', 'Geofence', 'PostgreSQL'])

  const tabs = [
    { id: 'buttons', label: 'Buttons & Badges' },
    { id: 'forms', label: 'Inputs & Form Controls' },
    { id: 'cards', label: 'Cards & Elevation' },
    { id: 'table', label: 'Tables & Lists' },
    { id: 'dialogs', label: 'Modals & Feedback' },
    { id: 'tokens', label: 'Design Tokens & Palettes' },
  ]

  const sampleTableData = [
    { id: 1, name: 'Dr. Jane Smith', dept: 'Computer Science', role: 'teacher', status: 'approved', lastSeen: '09:15 AM' },
    { id: 2, name: 'Prof. Robert Miller', dept: 'Electronics', role: 'hod', status: 'pending', lastSeen: '09:22 AM' },
    { id: 3, name: 'Dr. Sarah Connor', dept: 'Mechanical', role: 'principal', status: 'approved', lastSeen: '08:45 AM' },
    { id: 4, name: 'Arthur Pendelton', dept: 'Administration', role: 'manager', status: 'rejected', lastSeen: '10:05 AM' },
    { id: 5, name: 'Elena Rostova', dept: 'Quality Assurance', role: 'governance', status: 'info', lastSeen: '08:30 AM' },
  ]

  const tableColumns = [
    { key: 'name', label: 'Faculty Member', sortable: true },
    { key: 'dept', label: 'Department', sortable: true },
    { 
      key: 'role', 
      label: 'Role', 
      render: (role) => <RoleBadge role={role} /> 
    },
    { 
      key: 'status', 
      label: 'Verification Status', 
      render: (status) => <StatusBadge status={status} /> 
    },
    { key: 'lastSeen', label: 'Timestamp' }
  ]

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <PageHeader
          title="FAFLOW Design System Component Gallery"
          description="Live demonstration of authoritative institutional tokens, WCAG 2.2 AA compliant contrast, and light-professional UI components."
          actions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                WCAG 2.2 AA Certified
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 bg-primary-50 text-primary-800 rounded-lg border border-primary-200">
                Tokens v2.1.0
              </span>
            </div>
          }
        />
        <div className="mt-6">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* 1. BUTTONS & BADGES */}
      {activeTab === 'buttons' && (
        <div className="space-y-6">
          <Card title="Button Hierarchy & Variants (48px Touch Target Ready)">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Variants</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Primary Navy</Button>
                  <Button variant="secondary">Secondary Neutral</Button>
                  <Button variant="outline">Outlined Control</Button>
                  <Button variant="ghost">Ghost Button</Button>
                  <Button variant="destructive">Destructive / Danger</Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sizes</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small Action (32px)</Button>
                  <Button size="md">Medium Action (42px)</Button>
                  <Button size="lg">Large Touch Target (48px)</Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">States</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button loading>Processing</Button>
                  <Button disabled>Disabled Action</Button>
                  <Button variant="secondary" disabled>Disabled Secondary</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Status & Role Badges (Single-Sourced Tokens)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Role Badges</p>
                <div className="flex flex-wrap gap-2">
                  <RoleBadge role="teacher" />
                  <RoleBadge role="hod" />
                  <RoleBadge role="principal" />
                  <RoleBadge role="governance" />
                  <RoleBadge role="manager" />
                  <RoleBadge role="staff" />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Status Badges</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status="approved" />
                  <StatusBadge status="pending" />
                  <StatusBadge status="rejected" />
                  <StatusBadge status="approved_with_exception" />
                  <StatusBadge status="info" />
                  <StatusBadge status="cancelled" />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Day Type Badges</p>
                <div className="flex flex-wrap gap-2">
                  <DayTypeBadge dayType="working" />
                  <DayTypeBadge dayType="holiday" />
                  <DayTypeBadge dayType="college_leave" />
                  <DayTypeBadge dayType="government_holiday" />
                  <DayTypeBadge dayType="exam_day" />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Chips & Indicators</p>
                <div className="flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <Chip key={c} label={c} onRemove={() => setChips(chips.filter((x) => x !== c))} />
                  ))}
                  <CreditChip value={4} />
                  <CreditChip value={-2} />
                  <CreditChip value={0} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 2. FORMS & INPUTS */}
      {activeTab === 'forms' && (
        <Card title="Form Controls with Accessible Borders (>= 3:1 Contrast)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            <Input
              label="Full Legal Name"
              value={textInputVal}
              onChange={(e) => setTextInputVal(e.target.value)}
              helperText="Institution payroll name for biometric binding"
            />

            <Input
              label="Email Address (Error State Example)"
              defaultValue="invalid-email@"
              error="Please enter a valid institution email (.edu or .ac.in)"
            />

            <Select
              label="Assigned Department"
              options={[
                { value: 'cs', label: 'Computer Science & Engineering' },
                { value: 'ec', label: 'Electronics & Communication' },
                { value: 'me', label: 'Mechanical Engineering' },
              ]}
              helperText="Determines HOD approval routing"
            />

            <MultiSelect
              label="Assigned Roles / Access Tags"
              options={[
                { value: 'cs', label: 'CS Department Faculty' },
                { value: 'ec', label: 'Exam Invigilator' },
                { value: 'me', label: 'Lab Supervisor' },
                { value: 'ad', label: 'Academic Council' },
              ]}
              selected={multiSelected}
              onChange={setMultiSelected}
            />

            <DatePicker
              label="Attendance Effective Date"
              defaultValue="2026-09-28"
            />

            <TimePicker
              label="Biometric Verification Window"
              defaultValue="09:00"
            />

            <div className="md:col-span-2">
              <Textarea
                label="Leave Reason or Special Justification"
                placeholder="Enter operational justification for substitution or leave exception..."
              />
            </div>
          </div>
        </Card>
      )}

      {/* 3. CARDS & ELEVATION */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Faculty Today" value="142" sub="98.2% Present" accent="indigo" />
            <StatCard label="Verified Biometrics" value="138" sub="4 Pending" accent="green" />
            <StatCard label="Substitution Alerts" value="3" sub="2 Accepted" accent="yellow" />
            <StatCard label="Geofence Breaches" value="0" sub="All In Zone" accent="blue" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Standard Institutional Card">
              <p className="text-sm text-slate-600 leading-relaxed">
                Cards feature single-sourced elevation tokens (`shadow-card` and `shadow-card-hover`), hairline borders (`#E6E8EC`), and 14px rounded corners. White background with slate-50/40 header separation.
              </p>
            </Card>

            <Card title="Interactive Card with Actions" headerAction={<Button size="sm">Action</Button>}>
              <p className="text-sm text-slate-600 leading-relaxed">
                Headers neatly host action buttons or status indicators without cluttering the card content area.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* 4. TABLES & LISTS */}
      {activeTab === 'table' && (
        <Card title="Institutional Data Grid (Search, Sort, Pagination)">
          <Table
            columns={tableColumns}
            data={sampleTableData}
            searchPlaceholder="Search faculty or role..."
          />
        </Card>
      )}

      {/* 5. DIALOGS & FEEDBACK */}
      {activeTab === 'dialogs' && (
        <div className="space-y-6">
          <Card title="Modals, Toasts & Banners">
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => setIsModalOpen(true)}>Open Modal Dialog</Button>
              <Button variant="destructive" onClick={() => setIsConfirmOpen(true)}>Open Confirm Dialog</Button>
            </div>
          </Card>

          <AlertBanner type="info" title="Academic Schedule Active">
            Semester 5 final examinations are scheduled starting next Monday. All attendance logs are audited under strict Governance mode.
          </AlertBanner>

          <AlertBanner type="success" title="Biometric Model Synchronized">
            ArcFace ONNX embedding matrix updated to version 2.4. Local cache verified.
          </AlertBanner>

          <AlertBanner type="warning" title="Geofence Accuracy Warning">
            Device reports GPS precision within 25m. Minimum settling window has been increased to 160ms.
          </AlertBanner>

          <ErrorAlert message="Backend rate limit reached for batch verification. Automatic retry scheduled." />

          <Card title="Skeleton Loaders (Shimmer Effect)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonCard lines={4} />
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-10 w-40" />
              </div>
            </div>
          </Card>

          <Card title="Empty State Pattern">
            <EmptyState
              title="No Pending Substitutions"
              message="All classes have active assigned faculty. No emergency cover required at this time."
              action={<Button variant="outline" size="sm">Refresh Schedule</Button>}
            />
          </Card>

          {/* Modal */}
          <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Faculty Verification Record">
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Detailed biometric telemetry capture log for Dr. Jane Smith. Verification matched against primary embedding at 09:15:02 AM.
              </p>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Close</Button>
                <Button onClick={() => setIsModalOpen(false)}>Acknowledge</Button>
              </div>
            </div>
          </Modal>

          {/* Confirm Dialog */}
          <ConfirmDialog
            open={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            onConfirm={() => setIsConfirmOpen(false)}
            title="Revoke Biometric Template?"
            message="Are you sure you want to revoke this biometric template? The faculty member will be required to re-enroll in person with an administrator."
            confirmText="Revoke Template"
            confirmVariant="destructive"
          />
        </div>
      )}

      {/* 6. TOKENS & PALETTES */}
      {activeTab === 'tokens' && (
        <div className="space-y-6">
          <Card title="Brand Palettes (design/tokens/faflow_design_tokens.json v2.1.0)">
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Primary Navy (Core Brand)</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FaflowColors.navy).map(([shade, hex]) => (
                    <div key={shade} className="w-20 text-center">
                      <div className="h-12 rounded-xl shadow-xs border border-slate-200/50" style={{ backgroundColor: hex }} />
                      <p className="text-[10px] font-bold text-slate-700 mt-1">{shade}</p>
                      <p className="text-[9px] font-mono text-slate-500">{hex}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Secondary Teal (Institutional Modern)</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FaflowColors.teal).map(([shade, hex]) => (
                    <div key={shade} className="w-20 text-center">
                      <div className="h-12 rounded-xl shadow-xs border border-slate-200/50" style={{ backgroundColor: hex }} />
                      <p className="text-[10px] font-bold text-slate-700 mt-1">{shade}</p>
                      <p className="text-[9px] font-mono text-slate-500">{hex}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tertiary Violet (Academic Focus)</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FaflowColors.violet).map(([shade, hex]) => (
                    <div key={shade} className="w-20 text-center">
                      <div className="h-12 rounded-xl shadow-xs border border-slate-200/50" style={{ backgroundColor: hex }} />
                      <p className="text-[10px] font-bold text-slate-700 mt-1">{shade}</p>
                      <p className="text-[9px] font-mono text-slate-500">{hex}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Accent Gold (Honor & Awards)</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FaflowColors.gold).map(([shade, hex]) => (
                    <div key={shade} className="w-20 text-center">
                      <div className="h-12 rounded-xl shadow-xs border border-slate-200/50" style={{ backgroundColor: hex }} />
                      <p className="text-[10px] font-bold text-slate-700 mt-1">{shade}</p>
                      <p className="text-[9px] font-mono text-slate-500">{hex}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
