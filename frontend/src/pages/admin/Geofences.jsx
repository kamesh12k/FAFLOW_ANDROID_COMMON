import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { geofencesApi } from '../../api/services'
import { getApiErrorMessage } from '../../api/client'
import { Spinner, ErrorAlert, Modal } from '../../components/ui'
import CampusMapEditor, {
  calculateHaversineDistance,
  isPointInPolygon,
  calculatePolygonArea,
  calculatePolygonPerimeter,
} from '../../components/geofence/CampusMapEditor'

export default function AdminGeofences() {
  const { isSystemAdmin, isAdmin, isSuperAdmin, isPrincipal, isGovernance } = useAuth()
  const canManageGeofences = isSystemAdmin || isSuperAdmin || (isAdmin && !isPrincipal && !isGovernance)

  const mapEditorRef = useRef(null)

  // Geofences Database State
  const [geofences, setGeofences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Active / Selected Geofence
  const [activeGeofence, setActiveGeofence] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Editor Form Fields
  const [boundaryType, setBoundaryType] = useState('circle') // 'circle' | 'polygon'
  const [center, setCenter] = useState({ lat: 11.016844, lng: 76.955833 })
  const [radiusMeters, setRadiusMeters] = useState(200)
  const [polygonVertices, setPolygonVertices] = useState([])
  const [name, setName] = useState('Main Campus Perimeter')
  const [description, setDescription] = useState('Primary institutional boundary for faculty attendance validation')
  const [toleranceMeters, setToleranceMeters] = useState(25)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Search & Geocoding State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchPlace, setSearchPlace] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const searchTimeoutRef = useRef(null)

  // Polygon History Stack (Undo / Redo)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  // "Use My Location" State
  const [locatingUser, setLocatingUser] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [userAccuracy, setUserAccuracy] = useState(null)

  // Test Location Playground State (Authoritative Backend Verification)
  const [isTestMode, setIsTestMode] = useState(false)
  const [testLocation, setTestLocation] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [testingLocation, setTestingLocation] = useState(false)

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [geofenceToDelete, setGeofenceToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch Geofences from Database
  const loadGeofences = async (preserveSelectedId = null) => {
    setLoading(true)
    setError('')
    try {
      const res = await geofencesApi.list()
      const data = res.data || []
      setGeofences(data)

      if (data.length > 0) {
        if (preserveSelectedId) {
          const matched = data.find((g) => g.id === preserveSelectedId)
          if (matched) selectGeofenceForView(matched)
          else selectGeofenceForView(data[0])
        } else if (!activeGeofence) {
          selectGeofenceForView(data[0])
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to retrieve campus geofence configurations.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGeofences()
  }, [])

  // Select a Geofence for Inspection & Map Focusing
  const selectGeofenceForView = (geo) => {
    setActiveGeofence(geo)
    setIsEditing(false)
    setIsDirty(false)
    setIsTestMode(false)
    setTestLocation(null)
    setTestResult(null)
    setUndoStack([])
    setRedoStack([])

    setName(geo.name || '')
    setDescription(geo.description || '')
    setBoundaryType(geo.type || 'circle')
    setToleranceMeters(geo.tolerance_meters || 25)
    setIsActive(geo.is_active !== undefined ? geo.is_active : true)

    if (geo.type === 'circle') {
      const targetCenter = {
        lat: Number(geo.center_latitude) || 11.016844,
        lng: Number(geo.center_longitude) || 76.955833,
      }
      setCenter(targetCenter)
      setRadiusMeters(Number(geo.radius_meters) || 200)
      if (mapEditorRef.current) {
        mapEditorRef.current.flyTo(targetCenter.lat, targetCenter.lng, 16)
      }
    } else if (geo.type === 'polygon' && geo.polygon_vertices) {
      const vertices = geo.polygon_vertices.map((v) => ({
        lat: Number(v.latitude || v.lat),
        lng: Number(v.longitude || v.lng),
      }))
      setPolygonVertices(vertices)
      if (vertices.length > 0) {
        setCenter({ lat: vertices[0].lat, lng: vertices[0].lng })
        if (mapEditorRef.current) {
          mapEditorRef.current.flyTo(vertices[0].lat, vertices[0].lng, 16)
        }
      }
    }
  }

  // Start Creation of New Geofence
  const startNewGeofence = () => {
    setActiveGeofence(null)
    setIsEditing(true)
    setIsDirty(true)
    setIsTestMode(false)
    setTestLocation(null)
    setTestResult(null)
    setIsSidebarOpen(true)
    setUndoStack([])
    setRedoStack([])

    setName('Main Campus Perimeter')
    setDescription('Authoritative institutional attendance zone')
    setBoundaryType('circle')

    // Center around current user location or current map center
    const defaultCenter = userLocation || center || { lat: 11.016844, lng: 76.955833 }
    setCenter(defaultCenter)
    setRadiusMeters(200)
    setPolygonVertices([
      { lat: defaultCenter.lat + 0.001, lng: defaultCenter.lng - 0.001 },
      { lat: defaultCenter.lat + 0.001, lng: defaultCenter.lng + 0.001 },
      { lat: defaultCenter.lat - 0.001, lng: defaultCenter.lng + 0.001 },
      { lat: defaultCenter.lat - 0.001, lng: defaultCenter.lng - 0.001 },
    ])
    setToleranceMeters(25)
    setIsActive(true)

    if (mapEditorRef.current) {
      mapEditorRef.current.flyTo(defaultCenter.lat, defaultCenter.lng, 16)
    }
  }

  // Polygon History Functions (Undo / Redo with deep copy)
  const pushPolygonUpdate = useCallback(
    (newVerts) => {
      setUndoStack((prev) => [...prev.slice(-25), polygonVertices])
      setRedoStack([])
      setPolygonVertices(newVerts)
      setIsDirty(true)
    },
    [polygonVertices]
  )

  const handleUndoPolygon = useCallback(() => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack((prev) => [...prev, polygonVertices])
    setUndoStack((prev) => prev.slice(0, -1))
    setPolygonVertices(previous)
    setIsDirty(true)
  }, [undoStack, polygonVertices])

  const handleRedoPolygon = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((prev) => [...prev, polygonVertices])
    setRedoStack((prev) => prev.slice(0, -1))
    setPolygonVertices(next)
    setIsDirty(true)
  }, [redoStack, polygonVertices])

  // Keyboard Shortcuts (Ctrl+Z / Ctrl+Y / Cmd+Z / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isEditing || boundaryType !== 'polygon') return
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          handleRedoPolygon()
        } else {
          e.preventDefault()
          handleUndoPolygon()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedoPolygon()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, boundaryType, handleUndoPolygon, handleRedoPolygon])

  // Location Search & Geocoding (Debounced OpenStreetMap Nominatim + Lat/Lng parser)
  const handleSearchQueryChange = (val) => {
    setSearchQuery(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!val.trim()) {
      setSearchResults([])
      setSearchDropdownOpen(false)
      return
    }

    // Check if user directly entered coordinates: "11.0168, 76.9558"
    const coordMatch = val.match(/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/)
    if (coordMatch) {
      const parts = val.split(',').map((p) => parseFloat(p.trim()))
      setSearchResults([
        {
          display_name: `Exact Coordinates: ${parts[0].toFixed(6)}, ${parts[1].toFixed(6)}`,
          lat: parts[0].toString(),
          lon: parts[1].toString(),
          isCoordinate: true,
        },
      ])
      setSearchDropdownOpen(true)
      return
    }

    // Debounce geocoding request to respect OSM Nominatim rate limit
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=in,us`
        )
        const results = await res.json()
        setSearchResults(results || [])
        setSearchDropdownOpen(true)
      } catch (err) {
        // Geocoding network error
      } finally {
        setSearching(false)
      }
    }, 450)
  }

  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const place = { lat, lng, displayName: result.display_name }
    setSearchPlace(place)
    setSearchDropdownOpen(false)
    setSearchQuery(result.display_name.split(',')[0])

    if (mapEditorRef.current) {
      mapEditorRef.current.flyTo(lat, lng, 17)
    }
  }

  const handleSelectSearchAsCenter = (place) => {
    if (!isEditing) {
      startNewGeofence()
    }
    setCenter({ lat: place.lat, lng: place.lng })
    setName(place.displayName.split(',')[0].trim() || 'Campus Perimeter')
    setIsDirty(true)
    setSearchPlace(null)
    if (mapEditorRef.current) {
      mapEditorRef.current.flyTo(place.lat, place.lng, 17)
    }
  }

  // "Use My Location" (HTML5 Geolocation API with Secure Context Check)
  const handleUseMyLocation = () => {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    if (!window.isSecureContext && !isLocalhost) {
      setError(
        `Browser Geolocation is restricted to secure origins (HTTPS or localhost). You are currently connected via ${window.location.origin}. Please open FAFLOW via http://localhost:${window.location.port || 5173}/ or HTTPS to use device GPS, or search your campus landmark above.`
      )
      return
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please search for an address or click directly on the interactive map.')
      return
    }

    setLocatingUser(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy = pos.coords.accuracy

        setUserLocation({ lat, lng })
        setUserAccuracy(accuracy)
        setLocatingUser(false)

        if (isEditing) {
          setCenter({ lat, lng })
          setIsDirty(true)
        }

        if (mapEditorRef.current) {
          mapEditorRef.current.flyTo(lat, lng, 17)
        }

        setSuccessMsg(`Acquired high-accuracy GPS position (accuracy: ±${Math.round(accuracy)}m).`)
      },
      (err) => {
        setLocatingUser(false)
        if (err.message && (err.message.includes('Only secure origins') || err.message.includes('secure origin'))) {
          setError(
            'Device GPS requires a secure origin (HTTPS or localhost). To use "Current Location", access this portal at http://localhost:5173/ or use HTTPS.'
          )
        } else if (err.code === 1) {
          setError('Location access was denied. Please allow location permissions in your browser or search your campus.')
        } else if (err.code === 2) {
          setError('GPS position unavailable. Please check your network or device GPS signal.')
        } else if (err.code === 3) {
          setError('Location request timed out. Please try again or click the map directly.')
        } else {
          setError(`Failed to retrieve current location: ${err.message}`)
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    )
  }

  // Handle Map Click Events
  const handleMapClick = useCallback(
    async (coords) => {
      if (isTestMode) {
        // Authoritative Backend Test Location Verification
        setTestLocation(coords)
        setTestingLocation(true)
        try {
          const res = await geofencesApi.testLocation({
            latitude: coords.lat,
            longitude: coords.lng,
            accuracy_meters: userAccuracy || 5.0,
          })
          setTestResult(res.data)
        } catch (err) {
          // Fallback to local geometric estimation if network fails
          if (boundaryType === 'circle') {
            const dist = calculateHaversineDistance(center.lat, center.lng, coords.lat, coords.lng)
            const isInside = dist <= radiusMeters + toleranceMeters
            setTestResult({
              is_inside: isInside,
              status: isInside ? 'VERIFIED' : 'OUT_OF_BOUNDS',
              message: isInside ? 'Within verified perimeter' : 'Outside verified perimeter',
              nearest_geofence_name: name,
              distance_to_boundary_meters: Math.max(0, dist - radiusMeters),
              distance_to_center_meters: dist,
            })
          } else {
            const isInside = isPointInPolygon(coords, polygonVertices)
            setTestResult({
              is_inside: isInside,
              status: isInside ? 'VERIFIED' : 'OUT_OF_BOUNDS',
              message: isInside ? 'Within verified perimeter' : 'Outside verified perimeter',
              nearest_geofence_name: name,
              distance_to_boundary_meters: 0,
              distance_to_center_meters: 0,
            })
          }
        } finally {
          setTestingLocation(false)
        }
      } else if (isEditing && boundaryType === 'polygon') {
        // Add vertex to polygon with undo history
        pushPolygonUpdate([...polygonVertices, coords])
      } else if (isEditing && boundaryType === 'circle') {
        // Place circle center
        setCenter(coords)
        setIsDirty(true)
      }
    },
    [isTestMode, isEditing, boundaryType, center, radiusMeters, toleranceMeters, polygonVertices, name, userAccuracy, pushPolygonUpdate]
  )

  // Save Geofence to Backend & PostgreSQL
  const handleSaveGeofence = async () => {
    if (!name.trim()) {
      setError('Geofence name is required.')
      return
    }

    if (boundaryType === 'polygon' && polygonVertices.length < 3) {
      setError('Polygon geofences require at least 3 boundary vertices.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        type: boundaryType,
        tolerance_meters: Number(toleranceMeters) || 25,
        is_active: isActive,
      }

      if (boundaryType === 'circle') {
        payload.center_latitude = Number(center.lat)
        payload.center_longitude = Number(center.lng)
        payload.radius_meters = Number(radiusMeters)
        payload.polygon_vertices = null
      } else {
        payload.center_latitude = Number(polygonVertices[0].lat)
        payload.center_longitude = Number(polygonVertices[0].lng)
        payload.radius_meters = null
        payload.polygon_vertices = polygonVertices.map((v) => ({
          latitude: Number(v.lat),
          longitude: Number(v.lng),
        }))
      }

      let savedId = null
      if (activeGeofence?.id) {
        const res = await geofencesApi.update(activeGeofence.id, payload)
        savedId = activeGeofence.id
        setSuccessMsg(`Geofence "${payload.name}" updated successfully.`)
        if (res.data) setActiveGeofence(res.data)
      } else {
        const res = await geofencesApi.create(payload)
        savedId = res.data?.id
        setSuccessMsg(`New campus perimeter "${payload.name}" created and active.`)
        if (res.data) setActiveGeofence(res.data)
      }

      setIsEditing(false)
      setIsDirty(false)
      loadGeofences(savedId)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to persist geofence configuration.'))
    } finally {
      setSaving(false)
    }
  }

  // Toggle Active Status
  const handleToggleActive = async (geo) => {
    try {
      const updatedState = !geo.is_active
      await geofencesApi.toggle(geo.id, updatedState)
      setSuccessMsg(`Geofence "${geo.name}" is now ${updatedState ? 'Active' : 'Disabled'}.`)
      loadGeofences(geo.id)
      if (activeGeofence?.id === geo.id) {
        setIsActive(updatedState)
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to toggle geofence active status.'))
    }
  }

  // Delete Geofence
  const handleDeleteGeofence = async () => {
    if (!geofenceToDelete) return
    setDeleting(true)
    setError('')
    try {
      await geofencesApi.delete(geofenceToDelete.id)
      setSuccessMsg(`Geofence "${geofenceToDelete.name}" deleted.`)
      setDeleteModalOpen(false)
      setGeofenceToDelete(null)
      if (activeGeofence?.id === geofenceToDelete.id) {
        setActiveGeofence(null)
        setIsEditing(false)
        setIsDirty(false)
      }
      loadGeofences()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete campus geofence.'))
    } finally {
      setDeleting(false)
    }
  }

  // Geometric Derived Metrics
  const calculatedCircleAreaSqMeters = Math.round(Math.PI * radiusMeters * radiusMeters)
  const calculatedCircleAreaHectares = (calculatedCircleAreaSqMeters / 10000).toFixed(2)
  const calculatedCirclePerimeter = Math.round(2 * Math.PI * radiusMeters)

  const calculatedPolyAreaSqMeters = Math.round(calculatePolygonArea(polygonVertices))
  const calculatedPolyAreaHectares = (calculatedPolyAreaSqMeters / 10000).toFixed(2)
  const calculatedPolyPerimeter = Math.round(calculatePolygonPerimeter(polygonVertices))

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-lg font-bold">
            🗺️
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Campus Geolocation & Perimeter Management</h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                {geofences.filter((g) => g.is_active).length} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative GPS and polygon boundaries for verified mobile faculty attendance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unsaved Changes Indicator */}
          {isDirty && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}

          {/* Test Location Mode Button */}
          <button
            type="button"
            onClick={() => {
              setIsTestMode(!isTestMode)
              setTestLocation(null)
              setTestResult(null)
              if (!isTestMode) {
                setIsEditing(false)
                setIsSidebarOpen(true)
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isTestMode
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>⚡</span>
            <span>{isTestMode ? 'Exit Test Mode' : 'Test Location'}</span>
          </button>

          {/* Add Campus Geofence Button */}
          {canManageGeofences && (
            <button
              onClick={startNewGeofence}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <span>+</span>
              <span>Add Perimeter</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Notifications */}
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Insecure Origin Geolocation Notice (If accessed via HTTP LAN IP) */}
      {!window.isSecureContext &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <span className="text-amber-500 font-bold mt-0.5">ℹ️</span>
            <div>
              <span className="font-bold">Device GPS Restricted on LAN IP: </span>
              Modern browsers require HTTPS or <code>localhost</code> to read hardware GPS coordinates. Open FAFLOW at{' '}
              <a
                href={`http://localhost:${window.location.port || 5173}/admin/geofences`}
                className="underline font-semibold text-amber-900"
              >
                http://localhost:{window.location.port || 5173}
              </a>{' '}
              or HTTPS to enable instant "Locate Me", or position perimeters by searching or clicking directly on the map.
            </div>
          </div>
        )}

      {/* Spacious Google-Maps Workspace Container */}
      <div className="relative w-full h-[calc(100vh-210px)] min-h-[620px] rounded-2xl overflow-hidden border border-slate-200/80 shadow-md">
        {/* Full-Bleed Campus Map Canvas */}
        <CampusMapEditor
          ref={mapEditorRef}
          boundaryType={boundaryType}
          center={center}
          radiusMeters={radiusMeters}
          polygonVertices={polygonVertices}
          allGeofences={geofences}
          selectedGeofenceId={activeGeofence?.id}
          isDrawingMode={isEditing}
          onCenterChange={(coords) => {
            setCenter(coords)
            setIsDirty(true)
          }}
          onRadiusChange={(r) => {
            setRadiusMeters(r)
            setIsDirty(true)
          }}
          onPolygonChange={pushPolygonUpdate}
          onMapClick={handleMapClick}
          testLocation={testLocation}
          testResult={testResult}
          userLocation={userLocation}
          userAccuracy={userAccuracy}
          onLocateMeRequest={handleUseMyLocation}
          isLocatingUser={locatingUser}
          searchPlace={searchPlace}
          onSelectSearchAsCenter={handleSelectSearchAsCenter}
          onClearSearchPlace={() => setSearchPlace(null)}
          className="w-full h-full"
        />

        {/* Top-Left: Google-Maps-Style Floating Search Island */}
        <div className="absolute top-4 left-4 z-[1000] w-full max-w-sm sm:max-w-md">
          <div className="relative">
            <div className="flex items-center bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/80 px-3.5 py-2">
              <span className="text-slate-400 text-sm mr-2.5">🔍</span>
              <input
                type="text"
                placeholder="Search campus, city, landmark, or lat/lng..."
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setSearchDropdownOpen(true)
                }}
                className="w-full text-xs font-medium text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
              />
              {searching && <Spinner size="sm" className="mr-2" />}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                    setSearchDropdownOpen(false)
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchDropdownOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 max-h-60 overflow-y-auto p-1.5 space-y-1 z-50">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors flex items-start gap-2.5"
                  >
                    <span className="text-slate-400 mt-0.5 text-xs">📍</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {res.display_name.split(',')[0]}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{res.display_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Floating Sidebar Toggle Button (When Collapsed) */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-20 left-4 z-[1000] px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 text-xs font-semibold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 transition-all"
          >
            <span>📋</span>
            <span>Perimeter Manager</span>
          </button>
        )}

        {/* Floating Sidebar / Inspector Drawer (Google Maps Style - Responsive Desktop / Mobile) */}
        {isSidebarOpen && (
          <div className="absolute md:top-4 md:left-4 md:bottom-4 bottom-0 left-0 right-0 z-[1000] md:w-96 max-h-[75vh] md:max-h-none bg-white/95 backdrop-blur-md rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden transition-all">
            {/* Mobile Drag Indicator */}
            <div
              className="md:hidden flex justify-center pt-2 pb-1 bg-slate-50/60 cursor-pointer"
              onClick={() => setIsSidebarOpen(false)}
            >
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Drawer Top Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {isTestMode
                    ? '⚡ Test Location'
                    : isEditing
                    ? activeGeofence
                      ? 'Edit Perimeter'
                      : 'Create Perimeter'
                    : 'Perimeter Details'}
                </span>
                {isEditing && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    Draft
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      setIsDirty(false)
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  title="Collapse Drawer"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* MODE 1: TEST LOCATION PLAYGROUND */}
              {isTestMode ? (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-xs">
                      <span>⚡</span>
                      <span>Authoritative Location Test</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      Click anywhere on the map to test whether coordinates are recognized inside the campus by the backend geospatial engine.
                    </p>
                  </div>

                  {testingLocation && (
                    <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
                      <Spinner size="sm" />
                      <span>Verifying coordinates against database...</span>
                    </div>
                  )}

                  {testResult && !testingLocation && (
                    <div
                      className={`p-4 rounded-xl border space-y-2.5 ${
                        testResult.is_inside || testResult.isInside
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-rose-50 border-rose-300 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">
                          {testResult.is_inside || testResult.isInside
                            ? '✓ INSIDE CAMPUS'
                            : '✕ OUTSIDE CAMPUS'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-white/80">
                          {testResult.status || 'VERIFIED'}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div>
                          Nearest Perimeter:{' '}
                          <strong>{testResult.nearest_geofence_name || name}</strong>
                        </div>
                        {testResult.distance_to_boundary_meters !== undefined && (
                          <div>
                            Distance to Edge:{' '}
                            <strong>{Math.round(testResult.distance_to_boundary_meters)} meters</strong>
                          </div>
                        )}
                        {testLocation && (
                          <div className="font-mono text-[10px] text-slate-500">
                            Lat: {testLocation.lat.toFixed(6)}, Lng: {testLocation.lng.toFixed(6)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTestMode(false)
                        setTestLocation(null)
                        setTestResult(null)
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                    >
                      Exit Test Mode
                    </button>
                  </div>
                </div>
              ) : isEditing ? (
                /* MODE 2: GEOFENCE EDITOR FORM */
                <div className="space-y-4">
                  {/* User GPS Precision Card & Guidance */}
                  {userLocation && (
                    <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                          <span className="font-semibold text-slate-800 text-[11px]">
                            GPS Accuracy: <strong className="text-indigo-700">±{Math.round(userAccuracy || 5)} m</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCenter(userLocation)
                            setIsDirty(true)
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-bold underline text-[10px]"
                        >
                          Center Here
                        </button>
                      </div>
                      {userAccuracy && userAccuracy > 50 && (
                        <p className="text-[10px] text-amber-700 font-medium">
                          ⚠️ Location accuracy is currently ±{Math.round(userAccuracy)} m. For best precision, step outdoors or calibrate device GPS.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Boundary Type Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Perimeter Geometry
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBoundaryType('circle')
                          setIsDirty(true)
                        }}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                          boundaryType === 'circle'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        ⭕ Circle (Radial)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBoundaryType('polygon')
                          setIsDirty(true)
                        }}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                          boundaryType === 'polygon'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        ⬡ Polygon (Vertices)
                      </button>
                    </div>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Perimeter Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        setIsDirty(true)
                      }}
                      placeholder="e.g. Main Campus Perimeter"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  {/* Description Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value)
                        setIsDirty(true)
                      }}
                      placeholder="e.g. Primary academic blocks and labs"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Circle Mode Details */}
                  {boundaryType === 'circle' ? (
                    <div className="space-y-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      {/* Radius Slider + Numeric Input */}
                      <div>
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                          <span>Radius</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="20"
                              max="3000"
                              value={radiusMeters}
                              onChange={(e) => {
                                setRadiusMeters(Math.max(10, Number(e.target.value)))
                                setIsDirty(true)
                              }}
                              className="w-16 px-2 py-1 text-right font-bold text-indigo-600 bg-white rounded-lg border border-slate-200 text-xs"
                            />
                            <span className="text-slate-500 font-bold">m</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="30"
                          max="1500"
                          step="10"
                          value={radiusMeters}
                          onChange={(e) => {
                            setRadiusMeters(Number(e.target.value))
                            setIsDirty(true)
                          }}
                          className="w-full accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                          <span>30m</span>
                          <span>750m</span>
                          <span>1500m</span>
                        </div>

                        {/* Radius Presets */}
                        <div className="flex items-center gap-1.5 pt-2">
                          <span className="text-[10px] font-semibold text-slate-400">Presets:</span>
                          {[50, 100, 200, 500, 1000].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setRadiusMeters(preset)
                                setIsDirty(true)
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                radiusMeters === preset
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {preset}m
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Coordinates */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Center Lat</span>
                          <span className="font-mono font-bold text-slate-800">{center.lat.toFixed(6)}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Center Lng</span>
                          <span className="font-mono font-bold text-slate-800">{center.lng.toFixed(6)}</span>
                        </div>
                      </div>

                      {/* Live Geometry HUD */}
                      <div className="pt-2 border-t border-slate-200 text-[11px] space-y-1 text-slate-600">
                        <div className="flex justify-between">
                          <span>Area:</span>
                          <strong className="text-slate-900">
                            {calculatedCircleAreaSqMeters.toLocaleString()} m² ({calculatedCircleAreaHectares} ha)
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Perimeter:</span>
                          <strong className="text-slate-900">{calculatedCirclePerimeter.toLocaleString()} m</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Polygon Mode Details */
                    <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Vertices ({polygonVertices.length})
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleUndoPolygon}
                            disabled={undoStack.length === 0}
                            title="Undo vertex edit (Ctrl+Z)"
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40 flex items-center gap-1"
                          >
                            <span>↩</span>
                            <span>Undo</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRedoPolygon}
                            disabled={redoStack.length === 0}
                            title="Redo vertex edit (Ctrl+Y)"
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40 flex items-center gap-1"
                          >
                            <span>↪</span>
                            <span>Redo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              pushPolygonUpdate([])
                            }}
                            disabled={polygonVertices.length === 0}
                            className="px-2 py-0.5 rounded text-[11px] text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-40"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        💡 Click anywhere on map to append vertices. Drag handles or click midpoints to reshape.
                      </p>

                      <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[10px]">
                        {polygonVertices.map((v, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-200"
                          >
                            <span>
                              #{idx + 1}: {v.lat.toFixed(6)}, {v.lng.toFixed(6)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                pushPolygonUpdate(polygonVertices.filter((_, i) => i !== idx))
                              }}
                              className="text-rose-500 hover:text-rose-700 font-bold ml-1.5"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {polygonVertices.length >= 3 && (
                        <div className="pt-2 border-t border-slate-200 text-[11px] space-y-1 text-slate-600">
                          <div className="flex justify-between">
                            <span>Area:</span>
                            <strong className="text-slate-900">
                              {calculatedPolyAreaSqMeters.toLocaleString()} m² ({calculatedPolyAreaHectares} ha)
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Perimeter:</span>
                            <strong className="text-slate-900">{calculatedPolyPerimeter.toLocaleString()} m</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* GPS Tolerance Setting */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">GPS Tolerance</label>
                      <div className="text-[10px] text-slate-400">Atmospheric satellite drift buffer</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={toleranceMeters}
                        onChange={(e) => {
                          setToleranceMeters(Number(e.target.value))
                          setIsDirty(true)
                        }}
                        className="w-16 px-2 py-1 text-xs text-right font-bold text-slate-800 bg-white rounded-lg border border-slate-200"
                      />
                      <span className="text-slate-500 font-bold">m</span>
                    </div>
                  </div>

                  {/* Submit Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false)
                        setIsDirty(false)
                      }}
                      className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGeofence}
                      disabled={saving}
                      className="flex-1 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : activeGeofence ? 'Update Boundary' : 'Save & Deploy'}
                    </button>
                  </div>
                </div>
              ) : (
                /* MODE 3: INSPECTION & ALL CAMPUS GEOFENCES LIST */
                <div className="space-y-4">
                  {/* Selected Geofence Card */}
                  {activeGeofence ? (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900">{activeGeofence.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            activeGeofence.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {activeGeofence.is_active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600">
                        {activeGeofence.description || 'Institutional attendance boundary perimeter'}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Perimeter Type</span>
                          <span className="font-bold text-indigo-600 uppercase">{activeGeofence.type}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Tolerance</span>
                          <span className="font-bold text-slate-800">±{activeGeofence.tolerance_meters || 25}m</span>
                        </div>
                      </div>

                      {activeGeofence.type === 'circle' ? (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 font-mono text-[10px] text-slate-700">
                          <div>Radius: <strong>{activeGeofence.radius_meters} m</strong></div>
                          <div>
                            Center: {activeGeofence.center_latitude?.toFixed(6)}, {activeGeofence.center_longitude?.toFixed(6)}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 text-[10px] text-slate-700">
                          <div>
                            Polygon Vertices: <strong>{activeGeofence.polygon_vertices?.length || 0} boundary points</strong>
                          </div>
                        </div>
                      )}

                      {canManageGeofences && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors"
                          >
                            Edit Boundary
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(activeGeofence)}
                            className={`px-3 py-1.5 rounded-lg font-semibold text-xs border ${
                              activeGeofence.is_active
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {activeGeofence.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-400">
                      Select a perimeter below or create a new campus geofence.
                    </div>
                  )}

                  {/* Configured Institutional Geofences List */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-wider text-[10px] px-1">
                      <span>Configured Perimeters</span>
                      <span>({geofences.length})</span>
                    </div>

                    {loading ? (
                      <div className="flex justify-center py-6">
                        <Spinner size="sm" />
                      </div>
                    ) : geofences.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                        <p className="text-[11px] text-slate-500">No campus perimeters configured yet.</p>
                        {canManageGeofences && (
                          <button
                            onClick={startNewGeofence}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm"
                          >
                            Add Perimeter
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {geofences.map((geo) => {
                          const isSelected = activeGeofence?.id === geo.id
                          return (
                            <div
                              key={geo.id}
                              onClick={() => selectGeofenceForView(geo)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-indigo-50/70 border-indigo-500 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-bold text-xs text-slate-900 truncate">{geo.name}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="capitalize font-semibold text-indigo-600">{geo.type}</span>
                                  <span>•</span>
                                  <span>{geo.type === 'circle' ? `${geo.radius_meters}m` : `${geo.polygon_vertices?.length || 0} pts`}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    geo.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`}
                                />
                                {canManageGeofences && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setGeofenceToDelete(geo)
                                      setDeleteModalOpen(true)
                                    }}
                                    className="text-slate-400 hover:text-rose-600 font-bold px-1"
                                    title="Delete perimeter"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && geofenceToDelete && (
        <Modal title="Delete Campus Geofence" onClose={() => setDeleteModalOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete the campus geofence{' '}
              <strong className="text-slate-900">{geofenceToDelete.name}</strong>?
              Faculty members checking in against this boundary will no longer be validated against this perimeter.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGeofence}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
