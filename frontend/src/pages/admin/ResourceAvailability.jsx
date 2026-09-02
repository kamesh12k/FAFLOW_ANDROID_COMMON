import { useEffect, useState } from 'react'
import { roomsApi } from '../../api/services'
import { Spinner, EmptyState } from '../../components/ui'

export default function ResourceAvailability() {
  const [dayOrder, setDayOrder] = useState(1)
  const [period, setPeriod] = useState(1)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    roomsApi.availabilityDashboard(dayOrder, period).then(r => setRooms(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [dayOrder, period])

  const available = rooms.filter(r => r.is_available)
  const occupied = rooms.filter(r => !r.is_available)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Resource Availability</h1>
        <p className="text-sm text-gray-500 mt-0.5">Check room/lab availability for a given Day Order and period</p>
      </div>

      <div className="card p-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Day Order</label>
          <select className="input" value={dayOrder} onChange={e => setDayOrder(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>Day Order {d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Period</label>
          <select className="input" value={period} onChange={e => setPeriod(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rooms.length === 0 ? <EmptyState message="No rooms configured yet." /> : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-green-50 border-b border-green-100">
              <p className="text-sm font-semibold text-green-700">Available ({available.length})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {available.map(r => (
                <div key={r.room_id} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{r.room_number}</span>
                  <span className="text-xs text-gray-400 capitalize">{r.room_type}</span>
                </div>
              ))}
              {available.length === 0 && <p className="px-5 py-6 text-sm text-gray-400 text-center">No rooms available.</p>}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-red-50 border-b border-red-100">
              <p className="text-sm font-semibold text-red-700">Occupied ({occupied.length})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {occupied.map(r => (
                <div key={r.room_id} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{r.room_number}</span>
                  <span className="text-xs text-gray-400 capitalize">{r.room_type}</span>
                </div>
              ))}
              {occupied.length === 0 && <p className="px-5 py-6 text-sm text-gray-400 text-center">No rooms occupied.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
