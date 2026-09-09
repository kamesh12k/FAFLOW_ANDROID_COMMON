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
         * Handles both RGBA_8888 and YUV_420_888 output formats with full rotation and front-camera mirroring.
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
                var rawBitmap: Bitmap? = null

                // 1. Attempt native CameraX toBitmap() (works on YUV_420_888 and JPEG)
                try {
                    rawBitmap = imageProxy.toBitmap()
                } catch (_: Throwable) {
                    // toBitmap() unsupported or failed on this format (e.g. RGBA_8888)
                }

                // 2. Fallback: If format is RGBA_8888 (single plane), extract direct from buffer
                if (rawBitmap == null && imageProxy.planes.isNotEmpty()) {
                    try {
                        val plane = imageProxy.planes[0]
                        val buffer = plane.buffer
                        buffer.rewind()
                        val pixelStride = plane.pixelStride
                        val rowStride = plane.rowStride
                        if (pixelStride > 0 && rowStride > 0) {
                            val rowPadding = rowStride - pixelStride * width
                            val strideWidth = width + (if (pixelStride > 0) rowPadding / pixelStride else 0)
                            val bmp = Bitmap.createBitmap(strideWidth, height, Bitmap.Config.ARGB_8888)
                            bmp.copyPixelsFromBuffer(buffer)
                            rawBitmap = if (strideWidth != width) {
                                Bitmap.createBitmap(bmp, 0, 0, width, height)
                            } else {
                                bmp
                            }
                        }
                    } catch (_: Throwable) {}
                }

                // 3. Fallback: Decode via NV21 if 3 YUV planes exist
                if (rawBitmap == null) {
                    val nv21 = yuv420ToNv21(imageProxy)
                    if (nv21 != null) {
                        try {
                            val yuvImage = android.graphics.YuvImage(
                                nv21,
                                android.graphics.ImageFormat.NV21,
                                width,
                                height,
                                null
                            )
                            val out = java.io.ByteArrayOutputStream()
                            yuvImage.compressToJpeg(android.graphics.Rect(0, 0, width, height), 95, out)
                            val jpegBytes = out.toByteArray()
                            rawBitmap = android.graphics.BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
                        } catch (_: Throwable) {}
                    }
                }

                // 4. Apply rotation & front camera horizontal mirroring
                if (rawBitmap != null) {
                    val matrix = Matrix()
                    if (rotation != 0) {
                        matrix.postRotate(rotation.toFloat())
                    }
                    if (lensFacing == CameraLens.FRONT) {
                        // Mirror horizontally so the camera orientation matches the mirror preview
                        matrix.postScale(-1f, 1f)
                    }
                    bitmap = if (!matrix.isIdentity) {
                        Bitmap.createBitmap(rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, matrix, true)
                    } else {
                        rawBitmap
                    }
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
