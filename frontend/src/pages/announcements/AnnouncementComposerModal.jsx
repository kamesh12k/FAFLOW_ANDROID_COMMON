import { useState, useEffect, useRef } from 'react'
import {
  CloseIcon, PaperclipIcon, PinIcon, CheckIcon, AlertTriangleIcon,
  CheckCircleIcon, UsersIcon, BuildingIcon, ClockIcon
} from '../../components/icons'
import { Spinner } from '../../components/ui'
import { announcementApi } from '../../api/announcements'
import { useToast } from '../../components/ui/Toast'
import { formatErrorMessage } from '../../utils/errorUtils'

const ANNOUNCEMENT_TYPES = [
  { id: 'CIRCULAR', label: 'Official Circular' },
  { id: 'NOTICE', label: 'General Notice' },
  { id: 'ACADEMIC', label: 'Academic Directive' },
  { id: 'ADMINISTRATIVE', label: 'Administrative Order' },
  { id: 'URGENT', label: 'Urgent Notification' },
  { id: 'EVENT', label: 'Institutional Event' },
]

const PRIORITIES = [
  { id: 'NORMAL', label: 'Normal Priority', badge: 'bg-slate-100 text-slate-700' },
  { id: 'IMPORTANT', label: 'Important', badge: 'bg-blue-50 text-blue-700' },
  { id: 'HIGH', label: 'High Priority', badge: 'bg-amber-50 text-amber-800' },
  { id: 'URGENT', label: 'Urgent Directive', badge: 'bg-rose-50 text-rose-700' },
]

export default function AnnouncementComposerModal({ user, onClose, onCreated }) {
  const { showToast } = useToast()
  const fileInputRef = useRef(null)

  const isHod = user?.role === 'admin' && Boolean(user?.department_id)
  const isInstitutionAdmin =
    user?.role === 'principal' ||
    user?.role === 'system_admin' ||
    (user?.role === 'admin' && !user?.department_id)
  const isPrincipal = isInstitutionAdmin

  // Form State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('CIRCULAR')
  const [priority, setPriority] = useState('NORMAL')

  // Audience Target State
  const [targetType, setTargetType] = useState(isHod ? 'DEPARTMENT' : 'COLLEGE')
  const [selectedDeptIds, setSelectedDeptIds] = useState(isHod && user?.department_id ? [user.department_id] : [])
  const [selectedUserIds, setSelectedUserIds] = useState([])

  // Directory Data for Audience Selector
  const [candidateData, setCandidateData] = useState({ departments: [], faculty: [] })
  const [facultyDeptFilter, setFacultyDeptFilter] = useState('all')
  const [facultySearch, setFacultySearch] = useState('')

  // Attachments State
  const [attachments, setAttachments] = useState([])
  const [uploadingFiles, setUploadingFiles] = useState([])

  // Options State
  const [requiresAck, setRequiresAck] = useState(false)
  const [allowReplies, setAllowReplies] = useState(true)
  const [allowReactions, setAllowReactions] = useState(true)
  const [allowDownload, setAllowDownload] = useState(true)
  const [isPinned, setIsPinned] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [publishSuccessResult, setPublishSuccessResult] = useState(null)

  // Fetch targetable candidate directory
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await announcementApi.getCandidates()
        setCandidateData(res.data)
        if (isHod && user?.department_id) {
          setSelectedDeptIds([user.department_id])
        }
      } catch (err) {
        showToast(formatErrorMessage(err) || 'Could not fetch audience candidates directory', 'error')
      }
    }
    fetchCandidates()
  }, [user, isHod])

  // Helper to resolve MIME type accurately (handles Windows/Android empty file.type)
  const resolveMimeType = (file) => {
    if (file.type && file.type !== 'application/octet-stream') return file.type
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'pdf') return 'application/pdf'
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'jfif') return 'image/jpeg'
    if (ext === 'png') return 'image/png'
    if (ext === 'webp') return 'image/webp'
    if (ext === 'gif') return 'image/gif'
    if (ext === 'bmp') return 'image/bmp'
    return 'application/octet-stream'
  }

  // Handle File Selection and Direct Upload
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    if (attachments.length + files.length > 5) {
      showToast('Maximum 5 attachments allowed per announcement', 'error')
      return
    }

    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        showToast(`File "${file.name}" exceeds 25 MB limit`, 'error')
        continue
      }

      const resolvedMime = resolveMimeType(file)
      const isImg = resolvedMime.startsWith('image/') || /\.(jpg|jpeg|jfif|png|webp|gif|bmp)$/i.test(file.name)
      const previewUrl = isImg ? URL.createObjectURL(file) : null

      const tempId = Math.random().toString(36).substring(7)
      setUploadingFiles((prev) => [...prev, { tempId, name: file.name, progress: 0, previewUrl, isImg }])

      try {
        const presignRes = await announcementApi.presignAttachmentUpload({
          file_name: file.name,
          file_type: resolvedMime,
          file_size: file.size,
        })

        const presign = presignRes.data

        const uploadRes = await announcementApi.uploadAttachmentStream(
          presign.upload_url,
          file,
          (percent) => {
            setUploadingFiles((prev) =>
              prev.map((f) => (f.tempId === tempId ? { ...f, progress: percent } : f))
            )
          }
        )

        setAttachments((prev) => [
          ...prev,
          {
            file_name: presign.file_name,
            file_type: presign.file_type,
            file_size: presign.file_size,
            storage_key: presign.storage_key,
            checksum_sha256: uploadRes.data.checksum_sha256,
            previewUrl,
            isImg,
          },
        ])
        showToast(`Uploaded "${file.name}"`, 'success')
      } catch (err) {
        showToast(`Failed to upload "${file.name}": ${err.response?.data?.detail || err.message}`, 'error')
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f.tempId !== tempId))
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const filteredFaculty = candidateData.faculty.filter((f) => {
    const matchesDept =
      facultyDeptFilter === 'all' || String(f.department_id) === String(facultyDeptFilter)
    const matchesSearch =
      f.name.toLowerCase().includes(facultySearch.toLowerCase()) ||
      (f.email && f.email.toLowerCase().includes(facultySearch.toLowerCase()))
    return matchesDept && matchesSearch
  })

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const toggleDeptSelection = (deptId) => {
    if (isHod) return
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    )
  }

  const handleSelectAllFaculty = () => {
    const allIds = filteredFaculty.map((f) => f.id)
    setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...allIds])))
  }

  const handleClearFaculty = () => {
    setSelectedUserIds([])
  }

  const handleRequestPublish = () => {
    if (!title.trim()) {
      showToast('Please enter an announcement title', 'error')
      return
    }
    if (!body.trim()) {
      showToast('Please write the announcement message', 'error')
      return
    }
    if (targetType === 'DEPARTMENT' && !selectedDeptIds.length) {
      showToast('Please select at least one department', 'error')
      return
    }
    if (targetType === 'USER' && !selectedUserIds.length) {
      showToast('Please select at least one faculty member', 'error')
      return
    }
    if (isScheduled && !scheduledAt) {
      showToast('Please select a schedule publication date and time', 'error')
      return
    }
    setShowConfirmModal(true)
  }

  const handleSubmit = async (publishNow = true) => {
    if (!title.trim()) {
      showToast('Please enter an announcement title', 'error')
      return
    }
    if (!body.trim()) {
      showToast('Please write the announcement message', 'error')
      return
    }

    if (targetType === 'DEPARTMENT' && !selectedDeptIds.length) {
      showToast('Please select at least one department', 'error')
      return
    }
    if (targetType === 'USER' && !selectedUserIds.length) {
      showToast('Please select at least one faculty member', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        type,
        priority,
        target_type: targetType,
        department_ids: selectedDeptIds,
        user_ids: selectedUserIds,
        is_pinned: isPinned,
        requires_acknowledgement: requiresAck,
        allow_replies: allowReplies,
        allow_reactions: allowReactions,
        allow_download: allowDownload,
        publish_now: publishNow && !isScheduled,
        scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        attachments,
      }

      const res = await announcementApi.createAnnouncement(payload)
      const createdData = res.data
      showToast(
        publishNow && !isScheduled
          ? 'Announcement published and broadcasted successfully.'
          : isScheduled
          ? 'Announcement scheduled successfully.'
          : 'Draft saved successfully.',
        'success'
      )
      setShowConfirmModal(false)
      setPublishSuccessResult(createdData)
    } catch (err) {
      showToast(formatErrorMessage(err) || 'Failed to publish announcement', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-850">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="font-bold text-base sm:text-lg text-slate-900">
              {publishSuccessResult
                ? 'Announcement Broadcast Confirmed'
                : isHod
                ? 'Draft Department Circular'
                : 'Draft Institutional Circular'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {publishSuccessResult
                ? `Reference #CIR-${publishSuccessResult.id}`
                : isHod
                ? `Issuing from ${user.department || 'Department'}`
                : 'Issuing as Institutional Administrator'}
            </p>
          </div>
          <button
            onClick={() => {
              if (publishSuccessResult && onCreated) onCreated(publishSuccessResult.id)
              onClose()
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            title="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {publishSuccessResult ? (
          <div className="p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95 duration-150 overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircleIcon className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                {publishSuccessResult.status === 'SCHEDULED' ? 'Scheduled' : 'Published & Broadcasted'}
              </span>
              <h3 className="text-xl font-bold text-slate-900">
                {publishSuccessResult.status === 'SCHEDULED' ? 'Circular Scheduled' : 'Circular Issued Successfully'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {publishSuccessResult.status === 'SCHEDULED'
                  ? 'Your notice has been recorded and will be broadcasted automatically at the scheduled time.'
                  : 'Your directive has been published to all designated faculty feeds and notification endpoints.'}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-lg mx-auto space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Directive Title</span>
                  <h4 className="font-semibold text-sm text-slate-900 leading-snug">{publishSuccessResult.title}</h4>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-mono text-slate-600 bg-white border border-slate-200">
                  #{publishSuccessResult.id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Audience</span>
                  <span className="font-semibold text-slate-800">
                    {publishSuccessResult.target_type === 'COLLEGE'
                      ? 'Entire Institution'
                      : `${publishSuccessResult.targets?.length || 1} Recipient(s)`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Classification</span>
                  <span className="font-semibold text-slate-800">
                    {publishSuccessResult.type} • {publishSuccessResult.priority}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Attachments</span>
                  <span className="font-semibold text-slate-800">
                    {publishSuccessResult.attachments?.length || 0} file(s)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Acknowledgement</span>
                  <span className="font-semibold text-slate-800">
                    {publishSuccessResult.requires_acknowledgement ? 'Mandatory' : 'Not required'}
                  </span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => {
                  if (onCreated) onCreated(publishSuccessResult.id)
                  onClose()
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
              >
                View Circular
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onCreated) onCreated()
                  onClose()
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Return to Feed
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Form Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Title & Category Grid */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Directive Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Schedule for Semester Examinations and Invigilation Duties"
                    className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Category
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-primary-500 text-slate-800"
                    >
                      {ANNOUNCEMENT_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Priority Level
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-primary-500 text-slate-800"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Audience Targeting Scope */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Audience Scope <span className="text-rose-500">*</span>
                </label>

                <div className="flex items-center gap-2 flex-wrap">
                  {isPrincipal && (
                    <button
                      type="button"
                      onClick={() => setTargetType('COLLEGE')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                        targetType === 'COLLEGE'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <BuildingIcon className="w-3.5 h-3.5" />
                      <span>Entire Institution</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setTargetType('DEPARTMENT')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      targetType === 'DEPARTMENT'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <UsersIcon className="w-3.5 h-3.5" />
                    <span>{isHod ? 'Department Only' : 'Select Departments'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('USER')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      targetType === 'USER'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Specific Faculty Members</span>
                  </button>
                </div>

                {/* Department Multi-Select (for Principal) */}
                {targetType === 'DEPARTMENT' && isPrincipal && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                      Select Target Departments:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {candidateData.departments.map((dept) => {
                        const selected = selectedDeptIds.includes(dept.id)
                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => toggleDeptSelection(dept.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                              selected
                                ? 'bg-primary-50 text-primary-800 border-primary-300 font-semibold'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {selected ? '✓ ' : ''}{dept.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* HOD Department Confined Info */}
                {targetType === 'DEPARTMENT' && isHod && (
                  <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                    Targeted to faculty in: <strong className="text-slate-800">{user.department || 'Your Department'}</strong>
                  </div>
                )}

                {/* Faculty Multi-Select Picker */}
                {targetType === 'USER' && (
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {isPrincipal && (
                          <select
                            value={facultyDeptFilter}
                            onChange={(e) => setFacultyDeptFilter(e.target.value)}
                            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
                          >
                            <option value="all">All Departments</option>
                            {candidateData.departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          value={facultySearch}
                          onChange={(e) => setFacultySearch(e.target.value)}
                          placeholder="Search faculty name..."
                          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 placeholder:text-slate-400"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={handleSelectAllFaculty}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={handleClearFaculty}
                          className="font-medium text-slate-500 hover:underline"
                        >
                          Clear
                        </button>
                        <span className="text-slate-500 font-mono text-[11px]">
                          ({selectedUserIds.length} selected)
                        </span>
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {filteredFaculty.map((fac) => {
                        const isSelected = selectedUserIds.includes(fac.id)
                        return (
                          <label
                            key={fac.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary-50 text-primary-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUserSelection(fac.id)}
                              className="rounded-sm text-primary-600 focus:ring-primary-500"
                            />
                            <span className="truncate">{fac.name}</span>
                            <span className="text-[10px] text-slate-400 truncate">
                              ({fac.department_name || 'General'})
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Directive Content <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Draft the directive text, guidelines, deadlines, and instructions..."
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl p-3.5 focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:border-primary-500 leading-relaxed font-sans text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Attachments Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Attachments (PDF, JPG, PNG • Max 25 MB each)
                  </label>
                  <span className="text-xs text-slate-400">
                    {attachments.length}/5 files
                  </span>
                </div>

                {/* Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100/60"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <PaperclipIcon className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                  <p className="text-xs font-medium text-slate-700">
                    Click to attach documents or drag and drop here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Official PDFs or images
                  </p>
                </div>

                {/* Uploading progress indicator */}
                {uploadingFiles.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {uploadingFiles.map((uf) => (
                      <div key={uf.tempId} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <PaperclipIcon className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-700 font-medium truncate">{uf.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-500 text-[11px]">{uf.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attached files list */}
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PaperclipIcon className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 truncate" title={att.file_name}>
                            {att.file_name}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            ({Math.round(att.file_size / 1024)} KB)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Remove file"
                        >
                          <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Governance & Compliance Toggles */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Governance Options
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={requiresAck}
                      onChange={(e) => setRequiresAck(e.target.checked)}
                      className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="font-semibold block text-slate-800">Require Formal Acknowledgement</span>
                      <span className="text-[11px] text-slate-500">Recipients must certify receipt and compliance</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="font-semibold block text-slate-800">Pin Notice to Top</span>
                      <span className="text-[11px] text-slate-500">Maintain priority position on recipient feed</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={allowReplies}
                      onChange={(e) => setAllowReplies(e.target.checked)}
                      className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="font-semibold block text-slate-800">Allow Threaded Replies</span>
                      <span className="text-[11px] text-slate-500">Enables faculty questions and clarifications</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={allowReactions}
                      onChange={(e) => setAllowReactions(e.target.checked)}
                      className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="font-semibold block text-slate-800">Enable Quick Reactions</span>
                      <span className="text-[11px] text-slate-500">Permit feedback reactions on notice</span>
                    </div>
                  </label>
                </div>

                {/* Schedule Option */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span>Schedule publication for a future timestamp</span>
                  </label>

                  {isScheduled && (
                    <div className="mt-2 pl-6">
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Notice will remain in draft status until the selected date and time.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                Discard
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRequestPublish}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Spinner size="xs" className="border-white border-t-transparent" />}
                  <span>{isScheduled ? 'Schedule Directive...' : 'Publish Directive...'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Publish Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isScheduled ? 'Confirm Scheduled Publication' : 'Confirm Broadcast'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review audience and settings before issuing this directive.
              </p>
            </div>

            {/* Overview matrix */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Title</span>
                <p className="font-semibold text-slate-900 line-clamp-1">{title}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Category</span>
                  <p className="font-medium text-slate-800">{type} • {priority}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Target</span>
                  <p className="font-medium text-slate-800">
                    {targetType === 'COLLEGE' && 'Entire Institution'}
                    {targetType === 'DEPARTMENT' && `${selectedDeptIds.length} Department(s)`}
                    {targetType === 'USER' && `${selectedUserIds.length} Selected Faculty`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Attachments</span>
                  <p className="font-medium text-slate-800">{attachments.length} attached</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Acknowledgement</span>
                  <p className="font-medium text-slate-800">{requiresAck ? 'Required' : 'Standard'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Back to Edit
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowConfirmModal(false)
                  handleSubmit(true)
                }}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && <Spinner size="xs" className="border-white border-t-transparent" />}
                <span>{isScheduled ? 'Confirm & Schedule' : 'Confirm & Publish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
