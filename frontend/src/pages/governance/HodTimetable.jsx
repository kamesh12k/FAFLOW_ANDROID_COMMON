import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import {
  teachersApi,
  timetableApi,
  subjectsApi,
  classesApi,
  roomsApi,
  departmentsApi,
} from '../../api/services';

const DAY_ORDERS = [1, 2, 3, 4, 5, 6];
const PERIODS = [1, 2, 3, 4, 5];
const TOTAL_SLOTS = DAY_ORDERS.length * PERIODS.length;

const PERIOD_TIMES = {
  1: '8:00–9:00',
  2: '9:00–10:00',
  3: '10:15–11:15',
  4: '11:15–12:15',
  5: '1:00–2:00',
};

const PALETTE = [
  { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#22C55E' },
  { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', dot: '#F97316' },
  { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF', dot: '#A855F7' },
  { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3', dot: '#F43F5E' },
  { bg: '#ECFEFF', text: '#164E63', border: '#A5F3FC', dot: '#06B6D4' },
  { bg: '#FEFCE8', text: '#854D0E', border: '#FEF08A', dot: '#EAB308' },
  { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE', dot: '#6366F1' },
  { bg: '#FDF2F8', text: '#9D174D', border: '#FBCFE8', dot: '#EC4899' },
  { bg: '#F0FDFA', text: '#134E4A', border: '#99F6E4', dot: '#14B8A6' },
  { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', dot: '#D97706' },
  { bg: '#F0FDF4', text: '#14532D', border: '#86EFAC', dot: '#16A34A' },
];

const colourCache = {};
let colourIdx = 0;
function tColour(tid) {
  if (!tid) return { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB', dot: '#D1D5DB' };
  if (!colourCache[tid]) colourCache[tid] = PALETTE[colourIdx++ % PALETTE.length];
  return colourCache[tid];
}

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function shortName(n) {
  if (!n) return '';
  return n.length > 15 ? n.slice(0, 14) + '…' : n;
}

const CSS = `
  @keyframes ht-spin { to { transform: rotate(360deg); } }
  @keyframes ht-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes ht-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .ht-cell:hover { transform: scale(1.02); z-index: 2; }
  .ht-cell:active { transform: scale(0.98); }
  .ht-cc:hover { border-color: #6366F1 !important; transform: translateY(-1px); }
  .ht-tc:hover { border-color: #6366F1 !important; background: #EEF2FF !important; transform: translateY(-1px); }
  .ht-sc:hover { border-color: #6366F1 !important; background: #EEF2FF !important; }
  .ht-sb::-webkit-scrollbar { width: 6px; height: 6px; }
  .ht-sb::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
`;

function Spin({ size = 20, color = '#6366F1' }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        border: `${color}30 2.5px solid`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'ht-spin 0.7s linear infinite',
      }}
    />
  );
}

function SrchBox({ value, onChange, placeholder, autoFocus, style }) {
  const ref = useRef();
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);
  return (
    <div style={{ position: 'relative', ...style }}>
      <svg
        style={{
          position: 'absolute',
          left: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#94A3B8',
          pointerEvents: 'none',
        }}
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          paddingLeft: 34,
          paddingRight: value ? 32 : 12,
          paddingTop: 9,
          paddingBottom: 9,
          border: '1.5px solid #E2E8F0',
          borderRadius: 10,
          fontSize: 13,
          outline: 'none',
          background: '#fff',
          fontFamily: 'inherit',
          color: '#1E293B',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
        onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#E2E8F0',
            border: 'none',
            borderRadius: '50%',
            width: 18,
            height: 18,
            cursor: 'pointer',
            fontSize: 11,
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function Avtr({ name, tid, size = 40 }) {
  const c = tColour(tid);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: c.bg,
        border: `2px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.34,
        fontWeight: 800,
        color: c.text,
      }}
    >
      {initials(name)}
    </div>
  );
}

export default function HodTimetable() {
  const navigate = useNavigate();
  const { user, isSystemAdmin } = useAuth();
  const { toast } = useToast();

  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [masterReady, setMasterReady] = useState(false);
  const [masterError, setMasterError] = useState(false);

  const [selClsId, setSelClsId] = useState(null);
  const [clsSearch, setClsSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [classSlots, setClassSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('subject');
  const [selSubj, setSelSubj] = useState(null);
  const [selTeacher, setSelTeacher] = useState(null);
  const [selRoom, setSelRoom] = useState(null);
  const [subjSearch, setSubjSearch] = useState('');
  const [tchrSearch, setTchrSearch] = useState('');

  const undoStack = useRef([]);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    Promise.all([
      classesApi.list(),
      teachersApi.list(true),
      subjectsApi.list(false, true),
      roomsApi.list(),
      departmentsApi.list(true),
    ])
      .then(([c, t, s, r, d]) => {
        setClasses(c.data ?? []);
        setTeachers((t.data ?? []).filter((x) => x.is_active !== false));
        setSubjects(s.data ?? []);
        setRooms(r.data ?? []);
        setDepartments(d.data ?? []);
        setMasterReady(true);
      })
      .catch(() => setMasterError(true));
  }, []);

  const loadSlots = useCallback(
    async (cid) => {
      setSlotsLoading(true);
      try {
        const r = await timetableApi.getByClass(cid);
        setClassSlots(r.data ?? []);
      } catch {
        toast.error('Failed to load timetable.');
      } finally {
        setSlotsLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (selClsId) {
      setClassSlots([]);
      loadSlots(selClsId);
    } else {
      setClassSlots([]);
    }
  }, [selClsId, loadSlots]);

  const selCls = useMemo(() => classes.find((c) => c.id === selClsId) ?? null, [classes, selClsId]);
  const deptOf = useCallback((did) => departments.find((d) => d.id === did)?.name ?? '', [departments]);
  const getTeach = useCallback((tid) => teachers.find((t) => t.id === tid) ?? null, [teachers]);
  const getSubj = useCallback((sid) => subjects.find((s) => s.id === sid) ?? null, [subjects]);
  const slotAt = useCallback(
    (day, per) => classSlots.find((s) => s.day_order === day && s.period_number === per) ?? null,
    [classSlots]
  );
  const filled = classSlots.length;
  const pct = Math.round((filled / TOTAL_SLOTS) * 100);

  const suggestedSubjects = useMemo(() => {
    const all = subjects.filter((s) => !s.is_archived);
    if (!selCls) return all;
    const primary = all.filter((s) => s.department_id === selCls.department_id && s.semester === selCls.semester);
    const secondary = all.filter(
      (s) => s.department_id === selCls.department_id && s.semester !== selCls.semester && !primary.find((p) => p.id === s.id)
    );
    const rest = all.filter((s) => !primary.find((p) => p.id === s.id) && !secondary.find((p) => p.id === s.id));
    return [...primary, ...secondary, ...rest];
  }, [subjects, selCls]);

  const displaySubjects = useMemo(() => {
    if (!subjSearch) return suggestedSubjects.slice(0, 40);
    const q = subjSearch.toLowerCase();
    return suggestedSubjects
      .filter((s) => s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q))
      .slice(0, 40);
  }, [suggestedSubjects, subjSearch]);

  const isBusy = useCallback(
    (tid, day, per) => classSlots.some((s) => s.teacher_id === tid && s.day_order === day && s.period_number === per),
    [classSlots]
  );

  const suggestedTeachers = useMemo(() => {
    if (!sheet) return [];
    const { day, period } = sheet;
    const subId = selSubj?.id;
    return teachers
      .map((t) => {
        let score = 0;
        const reasons = [];
        if (subId && classSlots.some((s) => s.teacher_id === t.id && s.subject_id === subId)) {
          score += 40;
          reasons.push('Teaches this subject');
        }
        if (classSlots.some((s) => s.teacher_id === t.id)) {
          score += 20;
          reasons.push('Teaches this class');
        }
        if (selCls && t.department_id === selCls.department_id) {
          score += 10;
          reasons.push('Same dept');
        }
        const busy = isBusy(t.id, day, period);
        if (!busy) score += 5;
        return { teacher: t, score, reasons, busy, available: !busy };
      })
      .filter((x) => {
        if (!tchrSearch) return true;
        const q = tchrSearch.toLowerCase();
        return x.teacher.name?.toLowerCase().includes(q) || deptOf(x.teacher.department_id).toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.available && !b.available) return -1;
        if (!a.available && b.available) return 1;
        return b.score - a.score;
      })
      .slice(0, 24);
  }, [sheet, selSubj, teachers, classSlots, selCls, isBusy, tchrSearch, deptOf]);

  const conflictInfo = useMemo(() => {
    if (!sheet || !selTeacher) return null;
    const { day, period, existing } = sheet;
    const conflict = classSlots.find(
      (s) => s.teacher_id === selTeacher.id && s.day_order === day && s.period_number === period && s.id !== existing?.id
    );
    if (!conflict) return null;
    const cls = classes.find((c) => c.id === conflict.class_id);
    const subj = getSubj(conflict.subject_id);
    return {
      className: cls ? `${cls.name}-${cls.section}` : `Class #${conflict.class_id}`,
      subjectName: subj?.name ?? 'General duty',
      day,
      period,
    };
  }, [sheet, selTeacher, classSlots, classes, getSubj]);

  const tchrSchedule = useMemo(() => {
    if (!sheet || !selTeacher) return [];
    return PERIODS.map((p) => {
      const slot = classSlots.find((s) => s.teacher_id === selTeacher.id && s.day_order === sheet.day && s.period_number === p);
      return {
        period: p,
        busy: !!slot,
        code: slot ? getSubj(slot.subject_id)?.code : null,
        isTarget: p === sheet.period,
      };
    });
  }, [sheet, selTeacher, classSlots, getSubj]);

  const groupedClasses = useMemo(() => {
    const vis = classes.filter((c) => {
      if (!isSystemAdmin && user?.department_id && c.department_id !== user.department_id) return false;
      if (deptFilter && String(c.department_id) !== deptFilter) return false;
      if (clsSearch) {
        const q = clsSearch.toLowerCase();
        return c.name?.toLowerCase().includes(q) || (c.section || '').toLowerCase().includes(q);
      }
      return true;
    });
    const g = {};
    vis.forEach((c) => {
      const k = deptOf(c.department_id) || 'Other';
      if (!g[k]) g[k] = [];
      g[k].push(c);
    });
    return g;
  }, [classes, isSystemAdmin, user, deptFilter, clsSearch, deptOf]);

  const openSheet = (day, period) => {
    if (!selClsId || slotsLoading) return;
    const ex = slotAt(day, period);
    setSheet({ day, period, existing: ex ?? null });
    setStep('subject');
    setSelSubj(ex ? getSubj(ex.subject_id) : null);
    setSelTeacher(ex ? getTeach(ex.teacher_id) : null);
    setSelRoom(ex?.room_id ? rooms.find((r) => r.id === ex.room_id) ?? null : null);
    setSubjSearch('');
    setTchrSearch('');
  };

  const closeSheet = () => {
    setSheet(null);
    setSelSubj(null);
    setSelTeacher(null);
    setSelRoom(null);
    setStep('subject');
  };

  const handleSave = async () => {
    if (!selTeacher || !selClsId || !sheet || conflictInfo) return;
    setSaving(true);
    try {
      const { day, period, existing } = sheet;
      if (existing) {
        await timetableApi.deleteSlot(existing.id);
        undoStack.current.push({ action: 'remove', slot: existing });
      }
      const res = await timetableApi.createSlot({
        teacher_id: selTeacher.id,
        subject_id: selSubj?.id ?? null,
        class_id: selClsId,
        room_id: selRoom?.id ?? null,
        day_order: day,
        period_number: period,
      });
      const ns = res.data;
      undoStack.current.push({ action: 'add', slot: ns });
      setClassSlots((prev) => [...prev.filter((s) => !(s.day_order === day && s.period_number === period)), ns]);
      const lbl = `DO${day} P${period} — ${selSubj?.code ?? 'Duty'} / ${selTeacher.name}`;
      setLastSaved(lbl);
      toast.success(`Saved: ${lbl}`);
      closeSheet();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === 'object' ? d?.reason ?? 'Conflict' : d ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!sheet?.existing) return;
    setSaving(true);
    try {
      await timetableApi.deleteSlot(sheet.existing.id);
      undoStack.current.push({ action: 'remove', slot: sheet.existing });
      setClassSlots((prev) => prev.filter((s) => s.id !== sheet.existing.id));
      setLastSaved(null);
      toast.success('Slot removed');
      closeSheet();
    } catch {
      toast.error('Failed to remove slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    const last = undoStack.current.pop();
    if (!last) {
      toast.error('Nothing to undo');
      return;
    }
    setSaving(true);
    try {
      if (last.action === 'add') {
        await timetableApi.deleteSlot(last.slot.id);
        setClassSlots((prev) => prev.filter((s) => s.id !== last.slot.id));
        toast.success('Undone — slot removed');
      } else {
        const res = await timetableApi.createSlot({
          teacher_id: last.slot.teacher_id,
          subject_id: last.slot.subject_id,
          class_id: last.slot.class_id,
          room_id: last.slot.room_id,
          day_order: last.slot.day_order,
          period_number: last.slot.period_number,
        });
        setClassSlots((prev) => [...prev, res.data]);
        toast.success('Undone — slot restored');
      }
      setLastSaved(null);
    } catch {
      toast.error('Undo failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!masterReady && !masterError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <style>{CSS}</style>
        <Spin size={36} />
        <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, margin: 0 }}>Loading timetable data…</p>
      </div>
    );
  }

  if (masterError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 14, padding: 32 }}>
        <style>{CSS}</style>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ fontWeight: 700, color: '#111827', fontSize: 15, margin: 0 }}>Could not load data</p>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>Check your connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', background: '#6366F1', color: '#fff', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <style>{CSS}</style>

      {/* ── Top Bar / Header ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#0F172A',
          borderBottom: '1px solid #1E293B',
          padding: '0 20px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate('/governance')}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
          title="Back to Dashboard"
        >
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
              HOD Timetable
            </span>
            {selCls && (
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                {selCls.name}-{selCls.section} · Sem {selCls.semester}
              </span>
            )}
          </div>
        </div>
        {undoStack.current.length > 0 && (
          <button
            onClick={handleUndo}
            disabled={saving}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94A3B8',
              fontWeight: 700,
              fontSize: 12,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            ↩ Undo
          </button>
        )}
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          {saving ? (
            <>
              <Spin size={12} color="#94A3B8" />
              <span>Saving…</span>
            </>
          ) : lastSaved ? (
            <>
              <span style={{ color: '#22C55E' }}>✓</span>
              <span>Saved</span>
            </>
          ) : (
            <span>All changes saved</span>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px 100px' }}>
        {/* ── Class Selection Cards ── */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <SrchBox
              value={clsSearch}
              onChange={setClsSearch}
              placeholder="Search class (e.g. II CS A)..."
              style={{ flex: '1 1 200px', minWidth: 140 }}
            />
            {(isSystemAdmin || departments.length > 1) && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{
                  flex: '0 0 auto',
                  padding: '9px 28px 9px 10px',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: 10,
                  fontSize: 13,
                  background: '#fff',
                  outline: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  color: '#374151',
                }}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {Object.keys(groupedClasses).length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: '28px 0', fontSize: 14 }}>No classes found</div>
          ) : (
            Object.entries(groupedClasses).map(([dept, deptCls]) => (
              <div key={dept} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  {dept}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {deptCls.map((c) => {
                    const isAct = selClsId === c.id;
                    const complete = isAct && filled >= TOTAL_SLOTS;
                    return (
                      <button
                        key={c.id}
                        className="ht-cc"
                        onClick={() => setSelClsId(isAct ? null : c.id)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: `2px solid ${isAct ? '#6366F1' : '#E2E8F0'}`,
                          background: isAct ? '#6366F1' : '#fff',
                          color: isAct ? '#fff' : '#1E293B',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          boxShadow: isAct ? '0 4px 12px rgba(99,102,241,0.25)' : '0 1px 3px rgba(0,0,0,0.04)',
                          transition: 'all 0.15s',
                          textAlign: 'left',
                          minWidth: 120,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span>
                            {c.name}-{c.section}
                          </span>
                          {complete && <span style={{ color: '#86EFAC' }}>✓</span>}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, opacity: isAct ? 0.85 : 0.65 }}>
                          Sem {c.semester}
                          {isAct ? ` · ${filled}/${TOTAL_SLOTS}` : ''}
                        </div>
                        {isAct && (
                          <div
                            style={{
                              height: 3,
                              background: 'rgba(255,255,255,0.3)',
                              borderRadius: 4,
                              marginTop: 6,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: complete ? '#86EFAC' : 'rgba(255,255,255,0.9)',
                                borderRadius: 4,
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        {/* ── Empty State ── */}
        {!selClsId && (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94A3B8' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📅</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#334155', marginBottom: 8 }}>Select a class to begin</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
              Choose any class section above to see its timetable grid and assign subjects with suggested teachers.
            </div>
          </div>
        )}

        {/* ── Timetable Grid ── */}
        {selClsId && (
          <section style={{ animation: 'ht-in 0.2s ease' }}>
            <div
              style={{
                background: '#1E293B',
                borderRadius: '14px 14px 0 0',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 900, color: '#F8FAFC', fontSize: 16 }}>
                  {selCls?.name}-{selCls?.section}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: 600 }}>
                  Semester {selCls?.semester}
                  {selCls?.department_id ? ` · ${deptOf(selCls.department_id)}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {slotsLoading ? (
                  <Spin size={18} color="#94A3B8" />
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: pct === 100 ? '#22C55E' : '#F8FAFC',
                        lineHeight: 1,
                      }}
                    >
                      {pct}%
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginTop: 3 }}>
                      {filled}/{TOTAL_SLOTS} slots filled
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ height: 3, background: '#334155' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: pct === 100 ? '#22C55E' : '#6366F1',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div
              style={{
                background: '#fff',
                borderRadius: '0 0 14px 14px',
                border: '1.5px solid #E2E8F0',
                borderTop: 'none',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              {slotsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 56, gap: 14 }}>
                  <Spin size={24} />
                  <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>Loading schedule…</span>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            width: 64,
                            padding: '10px 12px',
                            textAlign: 'left',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#64748B',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            background: '#F8FAFC',
                            borderBottom: '1.5px solid #E2E8F0',
                          }}
                        >
                          Day
                        </th>
                        {PERIODS.map((p) => (
                          <th
                            key={p}
                            style={{
                              padding: '10px 6px',
                              textAlign: 'center',
                              background: '#F8FAFC',
                              borderBottom: '1.5px solid #E2E8F0',
                              borderLeft: '1px solid #E2E8F0',
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 900, color: '#1E293B' }}>P{p}</div>
                            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginTop: 1 }}>
                              {PERIOD_TIMES[p]}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAY_ORDERS.map((day, di) => (
                        <tr key={day} style={{ borderBottom: di < DAY_ORDERS.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                          <td style={{ padding: '8px 12px', background: '#FAFAFA', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>DO {day}</div>
                          </td>
                          {PERIODS.map((period) => {
                            const slot = slotAt(day, period);
                            const tc = slot ? getTeach(slot.teacher_id) : null;
                            const sj = slot ? getSubj(slot.subject_id) : null;
                            const col = slot ? tColour(slot.teacher_id) : null;
                            return (
                              <td key={period} style={{ padding: 4, borderLeft: '1px solid #E2E8F0', verticalAlign: 'middle' }}>
                                <button
                                  className="ht-cell"
                                  onClick={() => openSheet(day, period)}
                                  title={slot ? `${tc?.name ?? '?'} — ${sj?.name ?? 'Duty'}` : `DO${day} P${period} — tap to assign`}
                                  style={{
                                    width: '100%',
                                    minHeight: 74,
                                    borderRadius: 10,
                                    border: `1.5px solid ${slot ? col.border : '#E2E8F0'}`,
                                    background: slot ? col.bg : '#FAFAFA',
                                    cursor: 'pointer',
                                    padding: '6px 8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: slot ? 'flex-start' : 'center',
                                    justifyContent: slot ? 'flex-start' : 'center',
                                    transition: 'transform 0.12s, box-shadow 0.12s',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: slot ? `0 1px 4px ${col.border}60` : 'none',
                                  }}
                                >
                                  {slot ? (
                                    <>
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          height: 3,
                                          background: col.dot,
                                          borderRadius: '10px 10px 0 0',
                                        }}
                                      />
                                      <div style={{ marginTop: 5, width: '100%', textAlign: 'left' }}>
                                        {sj && (
                                          <div
                                            style={{
                                              fontSize: 11,
                                              fontWeight: 900,
                                              color: col.text,
                                              lineHeight: 1.2,
                                              marginBottom: 2,
                                            }}
                                          >
                                            {sj.code || sj.name?.slice(0, 6)}
                                          </div>
                                        )}
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', lineHeight: 1.2 }}>
                                          {shortName(tc?.name ?? '?')}
                                        </div>
                                        {slot.room_id && (
                                          <div style={{ fontSize: 9, color: '#64748B', marginTop: 2, fontWeight: 600 }}>
                                            {rooms.find((r) => r.id === slot.room_id)?.room_number ?? ''}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: 20, color: '#CBD5E1' }}>+</span>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {classSlots.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...new Set(classSlots.map((s) => s.teacher_id))].map((tid) => {
                  const col = tColour(tid);
                  const t = getTeach(tid);
                  return (
                    <span
                      key={tid}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: col.bg,
                        border: `1.5px solid ${col.border}`,
                        fontSize: 11,
                        fontWeight: 700,
                        color: col.text,
                      }}
                    >
                      <span
                        style={{ width: 6, height: 6, borderRadius: '50%', background: col.dot, display: 'inline-block' }}
                      />
                      {t?.name ?? `Teacher #${tid}`}
                    </span>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Contextual Sheet ── */}
      {sheet && (
        <>
          <div
            onClick={closeSheet}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 60,
            }}
          />
          <div
            className="ht-sb"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
              zIndex: 61,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'ht-up 0.24s cubic-bezier(.32,.72,0,1)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: '#CBD5E1',
                borderRadius: 4,
                margin: '12px auto 0',
                flexShrink: 0,
              }}
            />

            {/* Sheet header */}
            <div
              style={{
                padding: '12px 20px 14px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#0F172A' }}>
                  Day Order {sheet.day} · Period {sheet.period}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 1 }}>
                  {selCls?.name}-{selCls?.section} · {PERIOD_TIMES[sheet.period]}
                  {sheet.existing ? ' · Editing existing slot' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {sheet.existing && (
                  <button
                    onClick={handleRemove}
                    disabled={saving}
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1.5px solid #FECDD3',
                      background: '#FFF1F2',
                      color: '#BE123C',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.5 : 1,
                    }}
                  >
                    🗑 Remove
                  </button>
                )}
                <button
                  onClick={closeSheet}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: '#F1F5F9',
                    cursor: 'pointer',
                    fontSize: 18,
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Step Tabs */}
            <div
              style={{
                display: 'flex',
                padding: '0 20px',
                borderBottom: '1px solid #F1F5F9',
                flexShrink: 0,
              }}
            >
              {[
                { id: 'subject', label: '1 · Subject' },
                { id: 'teacher', label: '2 · Teacher' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStep(tab.id)}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    border: 'none',
                    background: 'transparent',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    color: step === tab.id ? '#6366F1' : '#94A3B8',
                    borderBottom: `2px solid ${step === tab.id ? '#6366F1' : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                  {tab.id === 'subject' && selSubj && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#22C55E' }}>✓</span>
                  )}
                  {tab.id === 'teacher' && selTeacher && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#22C55E' }}>✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Sheet Scroll Body */}
            <div className="ht-sb" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px 32px' }}>
              {/* Step 1: Subject Selection */}
              {step === 'subject' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 8,
                      }}
                    >
                      Subject
                      {selCls && (
                        <span style={{ fontWeight: 500, textTransform: 'none', marginLeft: 6, color: '#94A3B8' }}>
                          — Suggested for Sem {selCls.semester}
                        </span>
                      )}
                    </div>
                    <SrchBox
                      value={subjSearch}
                      onChange={setSubjSearch}
                      placeholder="Search subject name or code…"
                      autoFocus
                      style={{ marginBottom: 10 }}
                    />
                    <button
                      className="ht-sc"
                      onClick={() => {
                        setSelSubj(null);
                        setStep('teacher');
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 14px',
                        borderRadius: 10,
                        marginBottom: 10,
                        border: `1.5px solid ${!selSubj ? '#6366F1' : '#E2E8F0'}`,
                        background: !selSubj ? '#EEF2FF' : '#FAFAFA',
                        color: !selSubj ? '#6366F1' : '#64748B',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      General Duty / No Specific Subject
                    </button>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {displaySubjects.map((s) => {
                        const isFirst = suggestedSubjects.slice(0, 10).includes(s);
                        const isSel = selSubj?.id === s.id;
                        return (
                          <button
                            key={s.id}
                            className="ht-sc"
                            onClick={() => {
                              setSelSubj(s);
                              setStep('teacher');
                            }}
                            style={{
                              padding: '9px 13px',
                              borderRadius: 10,
                              border: `1.5px solid ${isSel ? '#6366F1' : '#E2E8F0'}`,
                              background: isSel ? '#6366F1' : '#fff',
                              color: isSel ? '#fff' : '#1E293B',
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{s.name}</span>
                              {isFirst && !isSel && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: '2px 5px',
                                    background: '#DCFCE7',
                                    color: '#166534',
                                    borderRadius: 4,
                                  }}
                                >
                                  MATCH
                                </span>
                              )}
                            </div>
                            {s.code && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: isSel ? 'rgba(255,255,255,0.75)' : '#94A3B8',
                                  marginTop: 2,
                                  fontWeight: 600,
                                }}
                              >
                                {s.code}
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {displaySubjects.length === 0 && (
                        <div style={{ fontSize: 13, color: '#94A3B8', padding: '16px 0' }}>No subjects match.</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setStep('teacher')}
                    style={{
                      width: '100%',
                      padding: '13px 0',
                      borderRadius: 12,
                      border: 'none',
                      background: '#F1F5F9',
                      color: '#475569',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {selSubj ? `Continue with ${selSubj.code || selSubj.name} →` : 'Skip to Teacher →'}
                  </button>
                </div>
              )}

              {/* Step 2: Teacher Selection */}
              {step === 'teacher' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {selSubj ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: '#EEF2FF',
                        border: '1.5px solid #C7D2FE',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#4338CA' }}>{selSubj.name}</div>
                        {selSubj.code && (
                          <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 600 }}>{selSubj.code}</div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelSubj(null);
                          setStep('subject');
                        }}
                        style={{
                          fontSize: 11,
                          color: '#6366F1',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                      General Duty.{' '}
                      <button
                        onClick={() => setStep('subject')}
                        style={{
                          color: '#6366F1',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        Pick subject
                      </button>
                    </div>
                  )}

                  <SrchBox
                    value={tchrSearch}
                    onChange={setTchrSearch}
                    placeholder="Search teacher by name or department…"
                    autoFocus
                  />

                  {conflictInfo && (
                    <div
                      style={{
                        background: '#FFF1F2',
                        border: '1.5px solid #FECDD3',
                        borderRadius: 12,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#BE123C', marginBottom: 4 }}>
                        ⚠ Teacher Conflict
                      </div>
                      <div style={{ fontSize: 12, color: '#9F1239', lineHeight: 1.6 }}>
                        <strong>{selTeacher?.name}</strong> is already assigned:
                        <br />
                        {conflictInfo.className} · {conflictInfo.subjectName}
                        <br />
                        Day Order {conflictInfo.day} · Period {conflictInfo.period}
                      </div>
                    </div>
                  )}

                  {selTeacher && !conflictInfo && tchrSchedule.length > 0 && (
                    <div
                      style={{
                        background: '#F8FAFC',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: 12,
                        padding: '12px 14px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 10,
                        }}
                      >
                        {selTeacher.name} — Day Order {sheet.day} Schedule
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {tchrSchedule.map(({ period, busy, code, isTarget }) => (
                          <div
                            key={period}
                            style={{
                              flex: 1,
                              borderRadius: 8,
                              padding: '7px 4px',
                              textAlign: 'center',
                              background: isTarget ? (busy ? '#FFF1F2' : '#F0FDF4') : busy ? '#FEF2F2' : '#F0FDF4',
                              border: `1.5px solid ${
                                isTarget ? (busy ? '#FECDD3' : '#86EFAC') : busy ? '#FECDD3' : '#86EFAC'
                              }`,
                              boxShadow: isTarget ? '0 0 0 2px #6366F120' : 'none',
                            }}
                          >
                            <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', marginBottom: 3 }}>P{period}</div>
                            <div style={{ fontSize: 14 }}>{busy ? '🔴' : '🟢'}</div>
                            <div
                              style={{
                                fontSize: 8,
                                fontWeight: 700,
                                color: busy ? '#9F1239' : '#166534',
                                marginTop: 2,
                              }}
                            >
                              {busy ? code || 'Busy' : 'Free'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 8,
                      }}
                    >
                      {selSubj ? 'Recommended teachers' : 'All teachers'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {suggestedTeachers.length === 0 && (
                        <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
                          No teachers match.
                        </div>
                      )}
                      {suggestedTeachers.map(({ teacher, reasons, busy, available }) => {
                        const isSel = selTeacher?.id === teacher.id;
                        return (
                          <button
                            key={teacher.id}
                            className="ht-tc"
                            onClick={() => setSelTeacher(teacher)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 14px',
                              borderRadius: 12,
                              textAlign: 'left',
                              border: `1.5px solid ${isSel ? '#6366F1' : busy ? '#FECDD3' : '#E2E8F0'}`,
                              background: isSel ? '#EEF2FF' : busy ? '#FFF5F5' : '#fff',
                              cursor: 'pointer',
                              transition: 'all 0.12s',
                              boxShadow: isSel ? '0 0 0 3px #6366F118' : 'none',
                            }}
                          >
                            <Avtr name={teacher.name} tid={teacher.id} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{teacher.name}</div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, fontWeight: 600 }}>
                                {deptOf(teacher.department_id) || 'Dept not set'}
                              </div>
                              {reasons.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                  {reasons.slice(0, 2).map((r) => (
                                    <span
                                      key={r}
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        background: '#F0FDF4',
                                        color: '#166534',
                                        borderRadius: 4,
                                        border: '1px solid #BBF7D0',
                                      }}
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                              {isSel && <span style={{ fontSize: 18, color: '#6366F1' }}>✓</span>}
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '3px 7px',
                                  borderRadius: 6,
                                  background: available ? '#F0FDF4' : '#FFF1F2',
                                  color: available ? '#166534' : '#BE123C',
                                  border: `1px solid ${available ? '#BBF7D0' : '#FECDD3'}`,
                                }}
                              >
                                {available ? 'Free' : 'Busy'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Room selector (collapsed details) */}
                  <details style={{ borderRadius: 10, border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
                    <summary
                      style={{
                        padding: '10px 14px',
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#64748B',
                        cursor: 'pointer',
                        background: '#FAFAFA',
                        listStyle: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Room{selRoom ? ` — ${selRoom.room_number}` : ' (optional)'}</span>
                      <span style={{ fontSize: 10 }}>▼</span>
                    </summary>
                    <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button
                        onClick={() => setSelRoom(null)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          border: `1.5px solid ${!selRoom ? '#6366F1' : '#E2E8F0'}`,
                          background: !selRoom ? '#EEF2FF' : '#fff',
                          color: !selRoom ? '#6366F1' : '#64748B',
                          cursor: 'pointer',
                        }}
                      >
                        No room
                      </button>
                      {rooms.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelRoom(r)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            border: `1.5px solid ${selRoom?.id === r.id ? '#6366F1' : '#E2E8F0'}`,
                            background: selRoom?.id === r.id ? '#EEF2FF' : '#fff',
                            color: selRoom?.id === r.id ? '#6366F1' : '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          {r.room_number}
                          {r.room_type === 'lab' && (
                            <span style={{ marginLeft: 4, fontSize: 9, color: '#6366F1', fontWeight: 800 }}>LAB</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </details>

                  {/* Save button */}
                  <button
                    onClick={handleSave}
                    disabled={!selTeacher || saving || !!conflictInfo}
                    style={{
                      width: '100%',
                      padding: '14px 0',
                      borderRadius: 12,
                      border: 'none',
                      background: selTeacher && !conflictInfo ? '#4F46E5' : '#E2E8F0',
                      color: selTeacher && !conflictInfo ? '#fff' : '#94A3B8',
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: selTeacher && !conflictInfo ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: selTeacher && !conflictInfo ? '0 4px 16px rgba(79,70,229,0.3)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {saving ? (
                      <>
                        <Spin size={16} color="#fff" /> Saving…
                      </>
                    ) : conflictInfo ? (
                      'Resolve conflict to save'
                    ) : selTeacher ? (
                      `Save — ${selSubj?.code ?? 'Duty'} / ${selTeacher.name}`
                    ) : (
                      'Select a teacher to save'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
