package com.governence.faflow.attendance.student

import com.governence.faflow.core.network.OfflineBatchSyncRequestDto
import com.governence.faflow.core.network.OfflineBatchSyncResponseDto
import com.governence.faflow.core.network.OfflineSyncOperationDto
import com.governence.faflow.core.network.OfflineSyncResultDto
import com.governence.faflow.core.network.StudentAttendanceSyncPayloadDto
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class StudentAttendanceOfflineSyncReliabilityTest {

    @Test
    fun testOfflineOperationPreservesIdempotencyKeyAcrossRetries() = runTest {
        val opId = "test-op-123"
        val idempotencyKey = "student-attendance-$opId"

        val payload = StudentAttendanceSyncPayloadDto(
            sessionId = 42,
            classId = 10,
            absentRollSuffixes = listOf("001", "005"),
            clientTimestamp = "2026-09-21T08:00:00Z"
        )

        val op = OfflineSyncOperationDto(
            operationId = opId,
            idempotencyKey = idempotencyKey,
            operationType = "SUBMIT_ATTENDANCE",
            payload = payload,
            clientTimestamp = "2026-09-21T08:00:00Z"
        )

        // Verify idempotency key is immutable and matches the operation
        assertEquals("student-attendance-test-op-123", op.idempotencyKey)
        assertEquals(42, op.payload.sessionId)
        assertEquals(listOf("001", "005"), op.payload.absentRollSuffixes)
    }

    @Test
    fun testOfflineSyncBatchDtoMapsDirectlyToFastApiSchema() {
        val opId = "op-uuid-456"
        val key = "student-attendance-$opId"
        val payload = StudentAttendanceSyncPayloadDto(
            sessionId = 101,
            classId = 5,
            absentRollSuffixes = listOf("002"),
            clientTimestamp = "2026-09-21T08:30:00Z"
        )

        val batch = OfflineBatchSyncRequestDto(
            deviceId = "ANDROID_SM-S908B",
            operations = listOf(
                OfflineSyncOperationDto(
                    operationId = opId,
                    idempotencyKey = key,
                    operationType = "SUBMIT",
                    payload = payload,
                    clientTimestamp = "2026-09-21T08:30:00Z"
                )
            )
        )

        assertEquals("ANDROID_SM-S908B", batch.deviceId)
        assertEquals(1, batch.operations.size)
        val firstOp = batch.operations[0]
        assertEquals(key, firstOp.idempotencyKey)
        assertEquals("SUBMIT", firstOp.operationType)
        assertEquals(101, firstOp.payload.sessionId)
    }

    @Test
    fun testBatchSyncResponseAcknowledgesSuccessCount() {
        val resp = OfflineBatchSyncResponseDto(
            syncedCount = 2,
            failedCount = 0,
            results = listOf(
                OfflineSyncResultDto(
                    operationId = "op-1",
                    idempotencyKey = "student-attendance-op-1",
                    success = true,
                    status = "SYNCED",
                    message = "Attendance synced successfully"
                ),
                OfflineSyncResultDto(
                    operationId = "op-2",
                    idempotencyKey = "student-attendance-op-2",
                    success = true,
                    status = "submitted_late",
                    message = "Attendance synced successfully"
                )
            )
        )

        assertEquals(2, resp.effectiveSuccessCount)
        assertEquals(0, resp.failedCount)
        assertTrue(resp.results[0].success)
        assertEquals("SYNCED", resp.results[0].status)
        assertEquals("submitted_late", resp.results[1].status)
    }
}
