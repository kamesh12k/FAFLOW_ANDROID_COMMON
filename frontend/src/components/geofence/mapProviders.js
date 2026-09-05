/**
 * Map Providers and Multi-Layer Configurations
 * 
 * Provides production-grade, legally compliant tile layers with high-resolution global & India coverage:
 * - MAP: High-contrast, clean vector streets (CartoDB Voyager / OSM)
 * - SATELLITE: Crystal clear aerial imagery (Esri ArcGIS World Imagery - true high-res satellite photos)
 * - HYBRID: Esri World Imagery + Esri World Boundaries & Places + World Transportation overlays
 * - TERRAIN: Esri World Topo Map with topographic contours and relief
 */

export const MAP_MODES = {
  MAP: 'map',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
}

export const MAP_PROVIDERS = {
  [MAP_MODES.MAP]: {
    id: MAP_MODES.MAP,
    label: 'Standard Map',
    shortLabel: 'Map',
    icon: '🗺️',
    description: 'Clean street layout, campus roads, and institutional landmarks',
    thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/14/7508/11696',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        options: {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2026',
        },
      },
    ],
  },
  [MAP_MODES.SATELLITE]: {
    id: MAP_MODES.SATELLITE,
    label: 'Satellite Imagery',
    shortLabel: 'Satellite',
    icon: '🛰️',
    description: 'Real high-resolution aerial satellite photography of campus buildings, boundaries, and sports grounds',
    thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7508/11696',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        options: {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        },
      },
    ],
  },
  [MAP_MODES.HYBRID]: {
    id: MAP_MODES.HYBRID,
    label: 'Hybrid Satellite',
    shortLabel: 'Hybrid',
    icon: '🌍',
    description: 'Aerial satellite photography overlaid with road names, highways, and place labels',
    thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/7508/11696',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        options: {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and GIS User Community',
        },
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        options: {
          maxZoom: 19,
          opacity: 0.95,
          zIndex: 400,
        },
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        options: {
          maxZoom: 19,
          opacity: 0.85,
          zIndex: 401,
        },
      },
    ],
  },
  [MAP_MODES.TERRAIN]: {
    id: MAP_MODES.TERRAIN,
    label: 'Terrain / Topo',
    shortLabel: 'Terrain',
    icon: '⛰️',
    description: 'Topographical elevations, contour lines, water bodies, and elevation relief',
    thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/14/7508/11696',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        options: {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, METI, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, and GIS User Community',
        },
      },
    ],
  },
}
