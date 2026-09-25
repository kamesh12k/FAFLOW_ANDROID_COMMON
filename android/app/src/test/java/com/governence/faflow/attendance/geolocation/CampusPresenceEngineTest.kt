package com.governence.faflow.attendance.geolocation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CampusPresenceEngineTest {

    private lateinit var engine: CampusPresenceEngine
    private lateinit var sampleCircleGeofence: CampusGeofence
    private lateinit var samplePolygonGeofence: CampusGeofence

    @Before
    fun setUp() {
        engine = CampusPresenceEngine(
            maxAccuracyThresholdMeters = 30.0f,
            maxStaleLocationAgeMs = 60_000L,
            boundarySafetyMarginMeters = 5.0
        )

        sampleCircleGeofence = CampusGeofence(
            id = "GEOFENCE-MAIN",
            name = "Main Campus",
            type = GeofenceType.CIRCLE,
            centerLatitude = 11.016844,
            centerLongitude = 76.955833,
            radiusMeters = 200.0,
            toleranceMeters = 15.0,
            isActive = true
        )

        samplePolygonGeofence = CampusGeofence(
            id = "GEOFENCE-POLY",
            name = "Science Block Quad",
            type = GeofenceType.POLYGON,
            centerLatitude = 11.0200,
            centerLongitude = 76.9600,
            radiusMeters = 150.0,
            polygonVertices = listOf(
                GeoPoint(11.0190, 76.9590),
                GeoPoint(11.0210, 76.9590),
                GeoPoint(11.0210, 76.9610),
                GeoPoint(11.0190, 76.9610)
            ),
            toleranceMeters = 10.0,
            isActive = true
        )
    }

    @Test
    fun `evaluatePresence returns DENIED when location permission is not granted`() {
        val result = engine.evaluatePresence(
            location = null,
            activeGeofences = listOf(sampleCircleGeofence),
            hasPermission = false
        )
        assertEquals(CampusPresenceState.DENIED, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("permission", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence returns DENIED when location services are disabled`() {
        val result = engine.evaluatePresence(
            location = null,
            activeGeofences = listOf(sampleCircleGeofence),
            hasPermission = true,
            isLocationServiceEnabled = false
        )
        assertEquals(CampusPresenceState.DENIED, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("disabled", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence returns SEARCHING when location is null`() {
        val result = engine.evaluatePresence(
            location = null,
            activeGeofences = listOf(sampleCircleGeofence),
            hasPermission = true,
            isLocationServiceEnabled = true
        )
        assertEquals(CampusPresenceState.SEARCHING, result.state)
        assertFalse(result.isAuthorized)
    }

    @Test
    fun `evaluatePresence returns SUSPICIOUS when mock location provider is detected`() {
        val mockLoc = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 5.0f,
            isMock = true,
            timestamp = System.currentTimeMillis()
        )
        val result = engine.evaluatePresence(
            location = mockLoc,
            activeGeofences = listOf(sampleCircleGeofence)
        )
        assertEquals(CampusPresenceState.SUSPICIOUS, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("mock", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence returns UNCERTAIN when location is stale`() {
        val staleLoc = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 5.0f,
            timestamp = System.currentTimeMillis() - 75_000L // 75 seconds ago
        )
        val result = engine.evaluatePresence(
            location = staleLoc,
            activeGeofences = listOf(sampleCircleGeofence)
        )
        assertEquals(CampusPresenceState.UNCERTAIN, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("stale", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence returns UNCERTAIN when horizontal accuracy is poor`() {
        val inaccurateLoc = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 65.0f, // threshold is 30.0f
            timestamp = System.currentTimeMillis()
        )
        val result = engine.evaluatePresence(
            location = inaccurateLoc,
            activeGeofences = listOf(sampleCircleGeofence)
        )
        assertEquals(CampusPresenceState.UNCERTAIN, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("accuracy", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence returns DENIED when no active geofences exist in system`() {
        val loc = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 5.0f,
            timestamp = System.currentTimeMillis()
        )
        val result = engine.evaluatePresence(
            location = loc,
            activeGeofences = emptyList()
        )
        assertEquals(CampusPresenceState.DENIED, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("No active campus geofences", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence returns CONFIDENTLY_INSIDE for accurate center position`() {
        val insideLoc = StaffLiveLocation(
            latitude = 11.016844,
            longitude = 76.955833,
            accuracyMeters = 6.0f,
            timestamp = System.currentTimeMillis()
        )
        val result = engine.evaluatePresence(
            location = insideLoc,
            activeGeofences = listOf(sampleCircleGeofence)
        )
        assertEquals(CampusPresenceState.CONFIDENTLY_INSIDE, result.state)
        assertTrue(result.isAuthorized)
        assertNotNull(result.activeGeofence)
        assertEquals("Main Campus", result.activeGeofence?.name)
    }

    @Test
    fun `evaluatePresence returns UNCERTAIN when point is near boundary and accuracy circle crosses outside`() {
        // Point is ~205 meters from center in a 200m + 15m tolerance circle.
        // It is nominally inside (dist 205m < 215m), but distanceToBoundary is only 10m.
        // With accuracy of 18m, 18m > (10m + 5m margin), so uncertainty circle crosses outside campus.
        val nearBoundaryLoc = StaffLiveLocation(
            latitude = 11.01869, // ~205m North of 11.016844
            longitude = 76.955833,
            accuracyMeters = 18.0f,
            timestamp = System.currentTimeMillis()
        )
        val result = engine.evaluatePresence(
            location = nearBoundaryLoc,
            activeGeofences = listOf(sampleCircleGeofence)
        )
        assertEquals(CampusPresenceState.UNCERTAIN, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("uncertainty", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence returns CONFIDENTLY_OUTSIDE when position is far from campus`() {
        val farLoc = StaffLiveLocation(
            latitude = 11.0500, // Several km away
            longitude = 76.9900,
            accuracyMeters = 5.0f,
            timestamp = System.currentTimeMillis()
        )
        val result = engine.evaluatePresence(
            location = farLoc,
            activeGeofences = listOf(sampleCircleGeofence)
        )
        assertEquals(CampusPresenceState.CONFIDENTLY_OUTSIDE, result.state)
        assertFalse(result.isAuthorized)
        assertTrue(result.reason.contains("outside", ignoreCase = true))
    }

    @Test
    fun `evaluatePresence validates polygon geofence correctly`() {
        // Point inside polygon: (11.0200, 76.9600)
        val insidePolyLoc = StaffLiveLocation(
            latitude = 11.0200,
            longitude = 76.9600,
            accuracyMeters = 5.0f,
            timestamp = System.currentTimeMillis()
        )
        val result = engine.evaluatePresence(
            location = insidePolyLoc,
            activeGeofences = listOf(samplePolygonGeofence)
        )
        assertEquals(CampusPresenceState.CONFIDENTLY_INSIDE, result.state)
        assertTrue(result.isAuthorized)
        assertEquals("Science Block Quad", result.activeGeofence?.name)
    }
}
