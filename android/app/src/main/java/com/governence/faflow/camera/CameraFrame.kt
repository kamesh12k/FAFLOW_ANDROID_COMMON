package com.governence.faflow.camera

import android.graphics.Bitmap
import android.graphics.ImageFormat
import android.graphics.Matrix
import androidx.camera.core.ImageProxy
import java.nio.ByteBuffer

/**
 * Decoupled camera frame container required for future InsightFace processing.
 * Isolates CameraX from downstream vision and AI modules.
 */
data class CameraFrame(
    val width: Int,
    val height: Int,
    val rotationDegrees: Int,
    val timestamp: Long = System.currentTimeMillis(),
    val imageFormat: Int = ImageFormat.YUV_420_888,
    val lensFacing: CameraLens = CameraLens.FRONT,
    val nv21Bytes: ByteArray? = null,
    val bitmap: Bitmap? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as CameraFrame

        if (width != other.width) return false
        if (height != other.height) return false
        if (rotationDegrees != other.rotationDegrees) return false
        if (timestamp != other.timestamp) return false
        if (imageFormat != other.imageFormat) return false
        if (lensFacing != other.lensFacing) return false
        if (nv21Bytes != null) {
            if (other.nv21Bytes == null) return false
            if (!nv21Bytes.contentEquals(other.nv21Bytes)) return false
        } else if (other.nv21Bytes != null) return false

        return true
    }

    override fun hashCode(): Int {
        var result = width
        result = 31 * result + height
        result = 31 * result + rotationDegrees
        result = 31 * result + timestamp.hashCode()
        result = 31 * result + imageFormat
        result = 31 * result + lensFacing.hashCode()
        result = 31 * result + (nv21Bytes?.contentHashCode() ?: 0)
        return result
    }

    companion object {
        /**
         * Safely extracts a CameraFrame from an ImageProxy without leaking the proxy reference.
         */
        fun fromImageProxy(
            imageProxy: ImageProxy,
            lensFacing: CameraLens = CameraLens.FRONT,
            extractBitmap: Boolean = false
        ): CameraFrame {
            val rotation = imageProxy.imageInfo.rotationDegrees
            val width = imageProxy.width
            val height = imageProxy.height
            val timestamp = imageProxy.imageInfo.timestamp

            var bitmap: Bitmap? = null
            if (extractBitmap) {
                try {
                    val rawBitmap = imageProxy.toBitmap()
                    if (rotation != 0) {
                        val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
                        bitmap = Bitmap.createBitmap(rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, matrix, true)
                    } else {
                        bitmap = rawBitmap
                    }
                } catch (_: Exception) {
                    // Fallback to byte buffers
                }
            }

            val yuvBytes = yuv420ToNv21(imageProxy)

            return CameraFrame(
                width = width,
                height = height,
                rotationDegrees = rotation,
                timestamp = timestamp,
                imageFormat = imageProxy.format,
                lensFacing = lensFacing,
                nv21Bytes = yuvBytes,
                bitmap = bitmap
            )
        }

        /**
         * Converts YUV_420_888 ImageProxy planes into standard contiguous NV21 byte array.
         */
        private fun yuv420ToNv21(image: ImageProxy): ByteArray? {
            val planes = image.planes
            if (planes.size < 3) return null

            val yBuffer = planes[0].buffer
            val uBuffer = planes[1].buffer
            val vBuffer = planes[2].buffer

            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()

            val nv21 = ByteArray(ySize + uSize + vSize)

            yBuffer.get(nv21, 0, ySize)

            val vRowStride = planes[2].rowStride
            val vPixelStride = planes[2].pixelStride
            val uRowStride = planes[1].rowStride
            val uPixelStride = planes[1].pixelStride

            var offset = ySize
            val uvWidth = image.width / 2
            val uvHeight = image.height / 2

            for (row in 0 until uvHeight) {
                for (col in 0 until uvWidth) {
                    val vIndex = row * vRowStride + col * vPixelStride
                    val uIndex = row * uRowStride + col * uPixelStride
                    if (vIndex < vBuffer.limit() && uIndex < uBuffer.limit()) {
                        nv21[offset++] = vBuffer.get(vIndex)
                        nv21[offset++] = uBuffer.get(uIndex)
                    }
                }
            }

            return nv21
        }
    }
}
