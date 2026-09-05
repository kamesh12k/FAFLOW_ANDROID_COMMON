import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_MODES, MAP_PROVIDERS } from './mapProviders'

// Fix standard Leaflet icon paths in Vite bundle
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom SVG Icons
export const createMarkerIcon = (color = '#4F46E5', pulse = true, label = '') => {
  return L.divIcon({
    className: 'custom-map-center-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: grab;">
        ${pulse ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${color}; opacity: 0.25; animation: mapPulse 2s infinite ease-in-out;"></div>` : ''}
        <div style="width: 28px; height: 28px; border-radius: 50%; background: ${color}; border: 3px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">
          ${label || '<div style="width: 8px; height: 8px; border-radius: 50%; background: white;"></div>'}
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Draggable Radial Resize Handle (Edge of circle)
const createResizeHandleIcon = (radiusMeters = null) => {
  return L.divIcon({
    className: 'custom-resize-handle-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: ew-resize;" title="Drag boundary to resize radius">
        <div style="width: 22px; height: 22px; border-radius: 7px; background: #4F46E5; border: 2.5px solid white; box-shadow: 0 3px 12px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold; transform: rotate(45deg);">
          <div style="transform: rotate(-45deg); font-size: 10px; line-height: 1;">↔</div>
        </div>
        ${
          radiusMeters
            ? `<div style="position: absolute; bottom: 26px; white-space: nowrap; background: rgba(15, 23, 42, 0.9); color: white; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 700; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 8px rgba(0,0,0,0.3); pointer-events: none;">${radiusMeters}m</div>`
            : ''
        }
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

// Draggable Polygon Vertex Handle
const createPolygonVertexIcon = (index) => {
  return L.divIcon({
    className: 'custom-poly-vertex-pin',
    html: `
      <div style="width: 20px; height: 20px; border-radius: 50%; background: #059669; border: 2.5px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: 800; cursor: move;" title="Vertex ${index + 1} (Drag to adjust, Click to delete)">
        ${index + 1}
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

// Polygon Midpoint Handle for inserting vertices
const createMidpointIcon = () => {
  return L.divIcon({
    className: 'custom-poly-midpoint-pin',
    html: `
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #10B981; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold; line-height: 1; cursor: pointer;" title="Click to insert a new vertex here">+</div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// Google-Maps-Style Search Result Place Marker (Red Pin)
const createSearchPinIcon = () => {
  return L.divIcon({
    className: 'custom-search-place-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));">
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 14.2 40.8 14.8 41.4C15.4 42 16.6 42 17.2 41.4C17.8 40.8 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="#EA4335"/>
          <circle cx="16" cy="16" r="6.5" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  })
}

// Test Location Marker
const createTestPointIcon = (isInside) => {
  const color = isInside ? '#059669' : '#DC2626'
  return L.divIcon({
    className: 'custom-test-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background: ${color}; opacity: 0.25; animation: mapPulse 1.8s infinite ease-in-out;"></div>
        <div style="width: 26px; height: 26px; border-radius: 50%; background: ${color}; border: 3px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
          ${isInside ? '✓' : '✕'}
        </div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

// User Current Location Pulse Marker (Google Blue Dot)
const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'custom-user-location-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: #3B82F6; opacity: 0.35; animation: mapPulse 1.5s infinite ease-in-out;"></div>
        <div style="width: 18px; height: 18px; border-radius: 50%; background: #2563EB; border: 3px solid white; box-shadow: 0 2px 10px rgba(37,99,235,0.7);"></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

// Haversine Distance in meters
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Point-in-Polygon Ray Casting
export function isPointInPolygon(point, polygonVertices) {
  if (!polygonVertices || polygonVertices.length < 3) return false
  const [x, y] = [point.lat, point.lng]
  let inside = false
  for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
    const xi = polygonVertices[i].lat,
      yi = polygonVertices[i].lng
    const xj = polygonVertices[j].lat,
      yj = polygonVertices[j].lng
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Calculate approximate polygon area in square meters using Shoelace formula
export function calculatePolygonArea(vertices) {
  if (!vertices || vertices.length < 3) return 0
  const R = 6371000
  let total = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    const p1 = vertices[i]
    const p2 = vertices[j]
    const lat1 = (p1.lat * Math.PI) / 180
    const lat2 = (p2.lat * Math.PI) / 180
    const lon1 = (p1.lng * Math.PI) / 180
    const lon2 = (p2.lng * Math.PI) / 180
    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs((total * R * R) / 4)
}

// Calculate polygon perimeter in meters
export function calculatePolygonPerimeter(vertices) {
  if (!vertices || vertices.length < 2) return 0
  let total = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    total += calculateHaversineDistance(vertices[i].lat, vertices[i].lng, vertices[j].lat, vertices[j].lng)
  }
  return total
}

// Compute point at given distance and bearing from center
function computeOffsetPoint(center, distanceMeters, bearingDegrees = 90) {
  const R = 6371000
  const brng = (bearingDegrees * Math.PI) / 180
  const lat1 = (center.lat * Math.PI) / 180
  const lon1 = (center.lng * Math.PI) / 180

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceMeters / R) +
      Math.cos(lat1) * Math.sin(distanceMeters / R) * Math.cos(brng)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceMeters / R) * Math.cos(lat1),
      Math.cos(distanceMeters / R) - Math.sin(lat1) * Math.sin(lat2)
    )

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  }
}

const CampusMapEditor = forwardRef(function CampusMapEditor(
  {
    boundaryType = 'circle', // 'circle' | 'polygon'
    center = { lat: 11.016844, lng: 76.955833 },
    radiusMeters = 200,
    polygonVertices = [],
    allGeofences = [],
    selectedGeofenceId = null,
    isDrawingMode = false,
    onCenterChange,
    onRadiusChange,
    onPolygonChange,
    onMapClick,
    testLocation = null,
    testResult = null,
    userLocation = null,
    userAccuracy = null,
    onLocateMeRequest,
    isLocatingUser = false,
    searchPlace = null,
    onSelectSearchAsCenter,
    onClearSearchPlace,
    className = '',
  },
  ref
) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const currentTileLayersRef = useRef([])

  // State
  const [activeMapMode, setActiveMapMode] = useState(MAP_MODES.MAP)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [layersMenuOpen, setLayersMenuOpen] = useState(false)
  const [showOtherGeofences, setShowOtherGeofences] = useState(true)

  // Leaflet Layer References
  const centerMarkerRef = useRef(null)
  const resizeHandleMarkerRef = useRef(null)
  const circleLayerRef = useRef(null)
  const polygonLayerRef = useRef(null)
  const polygonVertexMarkersRef = useRef([])
  const polygonMidpointMarkersRef = useRef([])
  const existingGeofencesLayersRef = useRef([])
  const testMarkerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const userAccuracyCircleRef = useRef(null)
  const searchMarkerRef = useRef(null)

  // Imperative Expose
  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 16) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.0 })
      }
    },
    fitBounds: (bounds) => {
      if (mapInstanceRef.current && bounds) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 })
      }
    },
    fitToAllGeofences: () => {
      handleFitAllGeofences()
    },
    setMapMode: (mode) => {
      applyMapMode(mode)
    },
    invalidateSize: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    },
  }))

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstanceRef.current) return

    const initialCenter =
      boundaryType === 'polygon' && polygonVertices.length > 0
        ? [polygonVertices[0].lat, polygonVertices[0].lng]
        : [center.lat, center.lng]

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 16,
      zoomControl: false,
      attributionControl: true,
    })

    // Custom attribution positioning at bottom-right
    map.attributionControl.setPosition('bottomright')

    // Add metric scale bar (Google Maps style)
    L.control
      .scale({
        imperial: false,
        metric: true,
        position: 'bottomright',
      })
      .addTo(map)

    mapInstanceRef.current = map

    // Apply initial tile layers
    applyMapMode(MAP_MODES.MAP)

    // Fullscreen change listener
    const handleFsChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
      setIsFullscreen(isFs)
      setTimeout(() => map.invalidateSize(), 200)
    }
    document.addEventListener('fullscreenchange', handleFsChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // 2. Map Mode Tile Switching (MAP, SATELLITE, HYBRID, TERRAIN)
  const applyMapMode = useCallback((mode) => {
    const map = mapInstanceRef.current
    if (!map) return

    const providerConfig = MAP_PROVIDERS[mode] || MAP_PROVIDERS[MAP_MODES.MAP]

    // Remove existing tile layers
    currentTileLayersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer)
      } catch (e) {
        // layer might already be removed
      }
    })
    currentTileLayersRef.current = []

    // Add new provider layers
    providerConfig.layers.forEach((layerDef) => {
      const tileLayer = L.tileLayer(layerDef.url, layerDef.options)
      tileLayer.addTo(map)
      currentTileLayersRef.current.push(tileLayer)
    })

    setActiveMapMode(mode)
  }, [])

  // 3. Map Click Handler
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng
      if (onMapClick) {
        onMapClick({ lat, lng })
      }
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [onMapClick])

  // 4. Circle Geofence Rendering (Center Marker + Radial Resize Handle + Circle)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (boundaryType === 'circle') {
      const centerCoords = [center.lat, center.lng]

      // A. Center Draggable Marker
      if (!centerMarkerRef.current) {
        const marker = L.marker(centerCoords, {
          icon: createMarkerIcon('#4F46E5', true),
          draggable: isDrawingMode,
          zIndexOffset: 1000,
        }).addTo(map)

        marker.on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng()
          if (onCenterChange) onCenterChange({ lat, lng })
        })

        centerMarkerRef.current = marker
      } else {
        centerMarkerRef.current.setLatLng(centerCoords)
        if (centerMarkerRef.current.dragging) {
          if (isDrawingMode) centerMarkerRef.current.dragging.enable()
          else centerMarkerRef.current.dragging.disable()
        }
      }

      // B. Circle Boundary
      if (!circleLayerRef.current) {
        const circle = L.circle(centerCoords, {
          radius: radiusMeters,
          color: '#4F46E5',
          fillColor: '#6366F1',
          fillOpacity: 0.16,
          weight: 2.5,
          dashArray: isDrawingMode ? '6, 6' : undefined,
        }).addTo(map)
        circleLayerRef.current = circle
      } else {
        circleLayerRef.current.setLatLng(centerCoords)
        circleLayerRef.current.setRadius(radiusMeters)
        circleLayerRef.current.setStyle({
          dashArray: isDrawingMode ? '6, 6' : undefined,
        })
      }

      // C. Radial Resize Handle (placed at radius distance east of center)
      if (isDrawingMode) {
        const handlePos = computeOffsetPoint(center, radiusMeters, 90)

        if (!resizeHandleMarkerRef.current) {
          const handleMarker = L.marker([handlePos.lat, handlePos.lng], {
            icon: createResizeHandleIcon(radiusMeters),
            draggable: true,
            zIndexOffset: 1001,
          }).addTo(map)

          // On dragging the handle, dynamically update radius in real time
          handleMarker.on('drag', (e) => {
            const currentPos = e.target.getLatLng()
            const dist = calculateHaversineDistance(center.lat, center.lng, currentPos.lat, currentPos.lng)
            const clampedRadius = Math.max(10, Math.min(5000, Math.round(dist)))
            if (circleLayerRef.current) {
              circleLayerRef.current.setRadius(clampedRadius)
            }
            handleMarker.setIcon(createResizeHandleIcon(clampedRadius))
          })

          handleMarker.on('dragend', (e) => {
            const currentPos = e.target.getLatLng()
            const dist = calculateHaversineDistance(center.lat, center.lng, currentPos.lat, currentPos.lng)
            const clampedRadius = Math.max(10, Math.min(5000, Math.round(dist)))
            if (onRadiusChange) onRadiusChange(clampedRadius)
            handleMarker.setIcon(createResizeHandleIcon(clampedRadius))
          })

          resizeHandleMarkerRef.current = handleMarker
        } else {
          resizeHandleMarkerRef.current.setLatLng([handlePos.lat, handlePos.lng])
          resizeHandleMarkerRef.current.setIcon(createResizeHandleIcon(radiusMeters))
        }
      } else {
        if (resizeHandleMarkerRef.current) {
          resizeHandleMarkerRef.current.remove()
          resizeHandleMarkerRef.current = null
        }
      }
    } else {
      // Clean up circle layers if in polygon mode
      if (centerMarkerRef.current) {
        centerMarkerRef.current.remove()
        centerMarkerRef.current = null
      }
      if (circleLayerRef.current) {
        circleLayerRef.current.remove()
        circleLayerRef.current = null
      }
      if (resizeHandleMarkerRef.current) {
        resizeHandleMarkerRef.current.remove()
        resizeHandleMarkerRef.current = null
      }
    }
  }, [boundaryType, center.lat, center.lng, radiusMeters, isDrawingMode, onCenterChange, onRadiusChange])

  // 5. Polygon Geofence Rendering (Vertices, Midpoints, Polygon Surface)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clean up old markers
    polygonVertexMarkersRef.current.forEach((m) => m.remove())
    polygonVertexMarkersRef.current = []
    polygonMidpointMarkersRef.current.forEach((m) => m.remove())
    polygonMidpointMarkersRef.current = []

    if (boundaryType === 'polygon' && polygonVertices.length > 0) {
      const latLngs = polygonVertices.map((v) => [v.lat, v.lng])

      // A. Polygon Surface Layer
      if (!polygonLayerRef.current) {
        const poly = L.polygon(latLngs, {
          color: '#059669',
          fillColor: '#10B981',
          fillOpacity: 0.18,
          weight: 2.5,
          dashArray: isDrawingMode ? '6, 6' : undefined,
        }).addTo(map)
        polygonLayerRef.current = poly
      } else {
        polygonLayerRef.current.setLatLngs(latLngs)
        polygonLayerRef.current.setStyle({
          dashArray: isDrawingMode ? '6, 6' : undefined,
        })
      }

      // B. Draggable Vertex Markers (when in editor mode)
      if (isDrawingMode) {
        polygonVertices.forEach((vertex, index) => {
          const vertexMarker = L.marker([vertex.lat, vertex.lng], {
            icon: createPolygonVertexIcon(index),
            draggable: true,
            zIndexOffset: 1100 + index,
          }).addTo(map)

          // Vertex drag
          vertexMarker.on('drag', (e) => {
            const { lat, lng } = e.target.getLatLng()
            const updated = [...polygonVertices]
            updated[index] = { lat, lng }
            if (polygonLayerRef.current) {
              polygonLayerRef.current.setLatLngs(updated.map((v) => [v.lat, v.lng]))
            }
          })

          vertexMarker.on('dragend', (e) => {
            const { lat, lng } = e.target.getLatLng()
            const updated = [...polygonVertices]
            updated[index] = { lat, lng }
            if (onPolygonChange) onPolygonChange(updated)
          })

          // Click vertex to delete if at least 3 vertices exist
          vertexMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            if (polygonVertices.length > 3) {
              const updated = polygonVertices.filter((_, idx) => idx !== index)
              if (onPolygonChange) onPolygonChange(updated)
            }
          })

          polygonVertexMarkersRef.current.push(vertexMarker)

          // Midpoint insertion marker between this and next vertex
          if (polygonVertices.length >= 2) {
            const nextVertex = polygonVertices[(index + 1) % polygonVertices.length]
            const midLat = (vertex.lat + nextVertex.lat) / 2
            const midLng = (vertex.lng + nextVertex.lng) / 2

            const midMarker = L.marker([midLat, midLng], {
              icon: createMidpointIcon(),
              zIndexOffset: 1050,
            }).addTo(map)

            midMarker.on('click', (e) => {
              L.DomEvent.stopPropagation(e)
              const updated = [...polygonVertices]
              updated.splice(index + 1, 0, { lat: midLat, lng: midLng })
              if (onPolygonChange) onPolygonChange(updated)
            })

            polygonMidpointMarkersRef.current.push(midMarker)
          }
        })
      }
    } else {
      if (polygonLayerRef.current) {
        polygonLayerRef.current.remove()
        polygonLayerRef.current = null
      }
    }
  }, [boundaryType, polygonVertices, isDrawingMode, onPolygonChange])

  // 6. Other Existing Geofences Visualization
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    existingGeofencesLayersRef.current.forEach((layer) => layer.remove())
    existingGeofencesLayersRef.current = []

    if (!showOtherGeofences) return

    allGeofences.forEach((geo) => {
      // Don't duplicate active editing geofence
      if (geo.id === selectedGeofenceId && selectedGeofenceId !== null && isDrawingMode) return

      const isCurrentSelected = geo.id === selectedGeofenceId
      const strokeColor = isCurrentSelected
        ? '#4F46E5'
        : geo.is_active
        ? '#059669'
        : '#9CA3AF'
      const fillColor = isCurrentSelected
        ? '#6366F1'
        : geo.is_active
        ? '#10B981'
        : '#CBD5E1'

      if (geo.type === 'circle' && geo.center_latitude && geo.center_longitude) {
        const circle = L.circle([geo.center_latitude, geo.center_longitude], {
          radius: geo.radius_meters || 200,
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity: isCurrentSelected ? 0.18 : 0.08,
          weight: isCurrentSelected ? 2.5 : 1.5,
          dashArray: geo.is_active ? undefined : '5, 5',
        }).addTo(map)

        circle.bindTooltip(
          `<strong>${geo.name}</strong><br/>${geo.radius_meters}m • ${geo.is_active ? 'Active' : 'Disabled'}`,
          { direction: 'top', className: 'custom-map-tooltip' }
        )

        existingGeofencesLayersRef.current.push(circle)
      } else if (geo.type === 'polygon' && geo.polygon_vertices && geo.polygon_vertices.length >= 3) {
        const latLngs = geo.polygon_vertices.map((v) => [v.latitude || v.lat, v.longitude || v.lng])
        const poly = L.polygon(latLngs, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity: isCurrentSelected ? 0.18 : 0.08,
          weight: isCurrentSelected ? 2.5 : 1.5,
          dashArray: geo.is_active ? undefined : '5, 5',
        }).addTo(map)

        poly.bindTooltip(
          `<strong>${geo.name}</strong><br/>Polygon • ${geo.is_active ? 'Active' : 'Disabled'}`,
          { direction: 'top', className: 'custom-map-tooltip' }
        )

        existingGeofencesLayersRef.current.push(poly)
      }
    })
  }, [allGeofences, selectedGeofenceId, isDrawingMode, showOtherGeofences])

  // 7. Authoritative Test Location Pin
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (testLocation && testResult) {
      const isInside = testResult.is_inside !== undefined ? testResult.is_inside : testResult.isInside
      const coords = [testLocation.lat, testLocation.lng]

      if (!testMarkerRef.current) {
        const marker = L.marker(coords, {
          icon: createTestPointIcon(isInside),
          zIndexOffset: 2000,
        }).addTo(map)

        marker.bindPopup(
          `
          <div style="font-family: inherit; font-size: 12px; padding: 2px 4px; min-width: 170px;">
            <div style="font-weight: 800; color: ${isInside ? '#059669' : '#DC2626'}; margin-bottom: 4px; font-size: 13px;">
              ${isInside ? '✓ INSIDE CAMPUS' : '✕ OUTSIDE CAMPUS'}
            </div>
            <div style="color: #4B5563; font-size: 11px; margin-bottom: 2px;">
              Nearest: <strong>${testResult.nearest_geofence_name || 'Campus Perimeter'}</strong>
            </div>
            ${
              testResult.distance_to_boundary_meters !== undefined
                ? `<div style="color: #6B7280; font-size: 11px;">Distance to edge: <strong>${Math.round(testResult.distance_to_boundary_meters)}m</strong></div>`
                : ''
            }
          </div>
        `,
          { autoClose: false, closeOnClick: false }
        )
        marker.openPopup()
        testMarkerRef.current = marker
      } else {
        testMarkerRef.current.setLatLng(coords)
        testMarkerRef.current.setIcon(createTestPointIcon(isInside))
        testMarkerRef.current.setPopupContent(`
          <div style="font-family: inherit; font-size: 12px; padding: 2px 4px; min-width: 170px;">
            <div style="font-weight: 800; color: ${isInside ? '#059669' : '#DC2626'}; margin-bottom: 4px; font-size: 13px;">
              ${isInside ? '✓ INSIDE CAMPUS' : '✕ OUTSIDE CAMPUS'}
            </div>
            <div style="color: #4B5563; font-size: 11px; margin-bottom: 2px;">
              Nearest: <strong>${testResult.nearest_geofence_name || 'Campus Perimeter'}</strong>
            </div>
            ${
              testResult.distance_to_boundary_meters !== undefined
                ? `<div style="color: #6B7280; font-size: 11px;">Distance to edge: <strong>${Math.round(testResult.distance_to_boundary_meters)}m</strong></div>`
                : ''
            }
          </div>
        `)
        testMarkerRef.current.openPopup()
      }
    } else {
      if (testMarkerRef.current) {
        testMarkerRef.current.remove()
        testMarkerRef.current = null
      }
    }
  }, [testLocation, testResult])

  // 8. Search Place Marker (Google Red Place Pin with Action Card)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (searchPlace && searchPlace.lat && searchPlace.lng) {
      const coords = [searchPlace.lat, searchPlace.lng]

      if (!searchMarkerRef.current) {
        const marker = L.marker(coords, {
          icon: createSearchPinIcon(),
          zIndexOffset: 1600,
        }).addTo(map)

        const title = searchPlace.display_name?.split(',')[0] || 'Selected Location'
        const subtitle = searchPlace.display_name || `${searchPlace.lat.toFixed(6)}, ${searchPlace.lng.toFixed(6)}`

        marker.bindPopup(
          `
          <div style="font-family: inherit; font-size: 12px; padding: 4px; min-width: 180px;">
            <div style="font-weight: 700; color: #0F172A; font-size: 13px; margin-bottom: 2px;">
              📍 ${title}
            </div>
            <div style="color: #64748B; font-size: 10px; margin-bottom: 6px; line-height: 1.3;">
              ${subtitle}
            </div>
            <div style="display: flex; gap: 4px;">
              <button id="btn-use-search-loc" style="width: 100%; background: #4F46E5; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-weight: 600; font-size: 11px; cursor: pointer;">
                Create Perimeter Here
              </button>
            </div>
          </div>
          `,
          { autoClose: false, closeOnClick: false }
        )

        marker.on('popupopen', () => {
          const btn = document.getElementById('btn-use-search-loc')
          if (btn) {
            btn.onclick = () => {
              if (onSelectSearchAsCenter) {
                onSelectSearchAsCenter({ lat: searchPlace.lat, lng: searchPlace.lng })
              }
            }
          }
        })

        marker.openPopup()
        searchMarkerRef.current = marker
      } else {
        searchMarkerRef.current.setLatLng(coords)
        searchMarkerRef.current.openPopup()
      }
    } else {
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove()
        searchMarkerRef.current = null
      }
    }
  }, [searchPlace, onSelectSearchAsCenter])

  // 9. User Current GPS Location Marker & Accuracy Ring
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (userLocation) {
      const coords = [userLocation.lat, userLocation.lng]

      if (!userMarkerRef.current) {
        const marker = L.marker(coords, {
          icon: createUserLocationIcon(),
          zIndexOffset: 1500,
        }).addTo(map)

        marker.bindTooltip(
          `<b>Your GPS Position</b><br/>${userAccuracy ? `±${Math.round(userAccuracy)}m accuracy` : ''}`,
          { direction: 'top' }
        )
        userMarkerRef.current = marker
      } else {
        userMarkerRef.current.setLatLng(coords)
      }

      if (userAccuracy) {
        if (!userAccuracyCircleRef.current) {
          const circle = L.circle(coords, {
            radius: userAccuracy,
            color: '#3B82F6',
            fillColor: '#60A5FA',
            fillOpacity: 0.12,
            weight: 1,
            dashArray: '4, 4',
          }).addTo(map)
          userAccuracyCircleRef.current = circle
        } else {
          userAccuracyCircleRef.current.setLatLng(coords)
          userAccuracyCircleRef.current.setRadius(userAccuracy)
        }
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.remove()
        userAccuracyCircleRef.current = null
      }
    }
  }, [userLocation, userAccuracy])

  // Zoom Controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn()
  }
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut()
  }

  // Fullscreen Toggle
  const handleToggleFullscreen = () => {
    const container = mapContainerRef.current?.parentElement
    if (!container) return

    if (!isFullscreen) {
      if (container.requestFullscreen) container.requestFullscreen()
      else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen()
      else if (container.msRequestFullscreen) container.msRequestFullscreen()
    } else {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
      else if (document.msExitFullscreen) document.msExitFullscreen()
    }
  }

  // Fit All Geofences
  const handleFitAllGeofences = () => {
    const map = mapInstanceRef.current
    if (!map) return

    const bounds = L.latLngBounds()
    let count = 0

    if (boundaryType === 'circle' && center.lat && center.lng) {
      bounds.extend([center.lat, center.lng])
      count++
    } else if (boundaryType === 'polygon' && polygonVertices.length > 0) {
      polygonVertices.forEach((v) => bounds.extend([v.lat, v.lng]))
      count++
    }

    allGeofences.forEach((geo) => {
      if (geo.type === 'circle' && geo.center_latitude && geo.center_longitude) {
        bounds.extend([geo.center_latitude, geo.center_longitude])
        count++
      } else if (geo.type === 'polygon' && geo.polygon_vertices) {
        geo.polygon_vertices.forEach((v) => bounds.extend([v.latitude || v.lat, v.longitude || v.lng]))
        count++
      }
    })

    if (count > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 })
    } else {
      map.flyTo([center.lat, center.lng], 16)
    }
  }

  // Google Maps Thumbnail Switcher Logic
  const alternateMode = activeMapMode === MAP_MODES.MAP ? MAP_MODES.SATELLITE : MAP_MODES.MAP

  return (
    <div
      className={`relative w-full h-full min-h-[520px] overflow-hidden bg-slate-900 group ${className}`}
      style={{ zIndex: 0 }}
    >
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[520px]" style={{ zIndex: 1 }} />

      {/* ========================================================================= */}
      {/* GOOGLE MAPS STYLE BOTTOM-LEFT "LAYERS" CONTROL WIDGET                       */}
      {/* ========================================================================= */}
      <div className="absolute bottom-7 left-4 z-[1000] flex flex-col items-start gap-2">
        {/* Expanded Flyout Menu */}
        {layersMenuOpen && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 p-3 mb-1 w-64 text-slate-800 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-900">Map Type</span>
              <button
                type="button"
                onClick={() => setLayersMenuOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
              >
                ✕
              </button>
            </div>

            {/* 4 Mode Cards Grid */}
            <div className="grid grid-cols-2 gap-2">
              {Object.values(MAP_PROVIDERS).map((prov) => {
                const isActive = activeMapMode === prov.id
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      applyMapMode(prov.id)
                      setLayersMenuOpen(false)
                    }}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <span className="text-lg mb-1">{prov.icon}</span>
                    <span className="text-[11px] leading-tight">{prov.shortLabel}</span>
                  </button>
                )
              })}
            </div>

            {/* Map Overlays / Options */}
            <div className="border-t border-slate-100 pt-2 space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer select-none">
                <span>Campus Perimeters</span>
                <input
                  type="checkbox"
                  checked={showOtherGeofences}
                  onChange={(e) => setShowOtherGeofences(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
              </label>
            </div>
          </div>
        )}

        {/* Thumbnail Preview Button (Google Maps Style) */}
        <div className="relative group/layers">
          <button
            type="button"
            onClick={() => setLayersMenuOpen(!layersMenuOpen)}
            title="Switch map mode or view layers"
            className="w-16 h-16 rounded-2xl bg-white shadow-xl border-2 border-white overflow-hidden transition-transform duration-150 hover:scale-105 active:scale-95 flex flex-col justify-end p-1 relative"
          >
            {/* Background Thumbnail Image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  activeMapMode === MAP_MODES.MAP
                    ? `url('${MAP_PROVIDERS[MAP_MODES.SATELLITE].thumbnail}')`
                    : `url('${MAP_PROVIDERS[MAP_MODES.MAP].thumbnail}')`,
              }}
            />
            {/* Gradient Overlay for Text Legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <span className="relative z-10 text-[10px] font-bold text-white uppercase tracking-wider text-center drop-shadow-sm">
              {activeMapMode === MAP_MODES.MAP ? 'Satellite' : 'Map'}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM-RIGHT ACTION STACK (Locate Me, Fit Bounds, Zoom, Fullscreen)         */}
      {/* ========================================================================= */}
      <div className="absolute bottom-7 right-4 z-[1000] flex flex-col gap-2">
        {/* Locate Me (GPS Crosshair) */}
        {onLocateMeRequest && (
          <button
            type="button"
            onClick={onLocateMeRequest}
            disabled={isLocatingUser}
            title="Locate my position (GPS)"
            className={`w-10 h-10 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all ${
              isLocatingUser ? 'animate-spin text-indigo-600' : ''
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" strokeWidth="2" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 2v3m0 14v3M2 12h3m14 0h3"
              />
            </svg>
          </button>
        )}

        {/* Fit to All Geofences (Compass / Bounds) */}
        <button
          type="button"
          onClick={handleFitAllGeofences}
          title="Fit all campus perimeters in view"
          className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>

        {/* Zoom In & Out Stack */}
        <div className="flex flex-col bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom in"
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-50 border-b border-slate-100 font-bold text-lg transition-all"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom out"
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-50 font-bold text-lg transition-all"
          >
            −
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isFullscreen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6"
              />
            )}
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes mapPulse {
          0% { transform: scale(0.85); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0.15; }
          100% { transform: scale(0.85); opacity: 0.8; }
        }
        .custom-map-tooltip {
          background: rgba(15, 23, 42, 0.9) !important;
          color: white !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 8px !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25) !important;
          border: 1px solid #E2E8F0 !important;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
        .leaflet-control-scale {
          margin-bottom: 2px !important;
          margin-right: 6px !important;
        }
        .leaflet-control-scale-line {
          background: rgba(255, 255, 255, 0.85) !important;
          border-color: #475569 !important;
          color: #1E293B !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          border-radius: 4px !important;
          padding: 1px 4px !important;
          backdrop-filter: blur(4px);
        }
      `}</style>
    </div>
  )
})

export default CampusMapEditor
