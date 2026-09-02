import React from 'react'
import { Modal } from '../../../components/ui'
import { DAY_FULL, PERIOD_TIMES } from './TimetableConstants'

export default function ConflictDialog({ conflictDetail, onClose, teachers = [], classes = [], subjects = [], rooms = [] }) {
  if (!conflictDetail) return null

  const conflictRequested = conflictDetail?.requested || {}
  const requestedTeacherName = teachers.find(t => t.id === Number(conflictRequested?.teacher_id))?.name || (conflictRequested?.teacher_id ? `Teacher #${conflictRequested.teacher_id}` : '—')
  const requestedClassName = classes.find(c => c.id === Number(conflictRequested?.class_id)) ? `${classes.find(c => c.id === Number(conflictRequested?.class_id)).name}-${classes.find(c => c.id === Number(conflictRequested?.class_id)).section}` : (conflictRequested?.class_id ? `Class #${conflictRequested.class_id}` : '—')
  const requestedSubjectName = subjects.find(s => s.id === Number(conflictRequested?.subject_id))?.name || (conflictRequested?.subject_id ? `Subject #${conflictRequested.subject_id}` : 'No subject')
  const requestedRoomName = rooms.find(r => r.id === Number(conflictRequested?.room_id))?.room_number || (conflictRequested?.room_id ? `Room #${conflictRequested.room_id}` : 'No room')

  return (
    <Modal open={!!conflictDetail} onClose={onClose} title={conflictDetail?.title || 'Schedule Conflict'}>
      <div className="tt-conflict-dialog">
        <div className="conflict-reason">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <strong>Conflict detected</strong>
            <p>{conflictDetail?.reason || 'The selected slot conflicts with an existing assignment.'}</p>
          </div>
        </div>

        <div className="conflict-time">
          {DAY_FULL[conflictRequested?.day_order] || 'Selected day'} · Period {conflictRequested?.period_number || '—'}
          {conflictRequested?.period_number && ` (${PERIOD_TIMES[conflictRequested.period_number]})`}
        </div>

        <div className="conflict-comparison">
          <section>
            <h4>Entry you tried to add</h4>
            <p><span>Teacher</span>{requestedTeacherName}</p>
            <p><span>Class</span>{requestedClassName}</p>
            <p><span>Subject</span>{requestedSubjectName}</p>
            <p><span>Room</span>{requestedRoomName}</p>
          </section>

          <section className="conflict-existing">
            <h4>Existing entry causing the conflict</h4>
            {conflictDetail?.existing ? (
              <>
                <p><span>Teacher</span>{conflictDetail.existing.teacher_name || (conflictDetail.existing.teacher_id ? `Teacher #${conflictDetail.existing.teacher_id}` : '—')}</p>
                <p><span>Class</span>{conflictDetail.existing.class_name || (conflictDetail.existing.class_id ? `Class #${conflictDetail.existing.class_id}` : '—')}</p>
                <p><span>Subject</span>{conflictDetail.existing.subject_name || 'Assigned session'}</p>
                <p><span>Room</span>{conflictDetail.existing.room_name || 'No room selected'}</p>
              </>
            ) : (
              <p style={{ fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>
                Another booking already exists for this Day Order &amp; Period. Please check the timetable grid for details.
              </p>
            )}
          </section>
        </div>

        <div className="conflict-resolution">
          <strong>How to fix it</strong>
          <p>{conflictDetail?.resolution || 'Choose a different teacher, class, room, day order, or period.'}</p>
        </div>

        <button type="button" className="tt-btn tt-btn--primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
          I understand — adjust timetable
        </button>
      </div>
    </Modal>
  )
}
