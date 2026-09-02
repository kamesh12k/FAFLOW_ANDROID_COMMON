package com.governence.faflow.face.scrfd

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import com.governence.faflow.camera.CameraFrame
import com.governence.faflow.face.model.ScrfdModelMetadata
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Metadata capturing scale and padding applied during letterboxing.
 */
data class LetterboxInfo(
    val scale: Float,
    val padX: Float,
    val padY: Float,
    val originalWidth: Int,
    val originalHeight: Int,
    val rotationApplied: Int
)

/**
 * Deterministic image preprocessor converting raw frames to SCRFD normalized float tensors.
 */
object ScrfdPreprocessor {

    /**
     * Converts a CameraFrame or Bitmap into an SCRFD input float buffer with letterboxing.
     */
    fun preprocess(
        bitmap: Bitmap,
        targetWidth: Int = ScrfdModelMetadata.INPUT_WIDTH,
        targetHeight: Int = ScrfdModelMetadata.INPUT_HEIGHT,
        rotationDegrees: Int = 0
    ): Pair<FloatBuffer, LetterboxInfo> {
        // 1. Apply Sensor Rotation if required
        val rotatedBitmap = if (rotationDegrees != 0) {
            val matrix = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } else {
            bitmap
        }

        val origW = rotatedBitmap.width
        val origH = rotatedBitmap.height

        // 2. Compute Letterbox Scale & Padding
        val scale = minOf(targetWidth.toFloat() / origW, targetHeight.toFloat() / origH)
        val newW = (origW * scale).toInt()
        val newH = (origH * scale).toInt()
        val padX = (targetWidth - newW) / 2f
        val padY = (targetHeight - newH) / 2f

        // 3. Render Letterboxed Image
        val letterboxed = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(letterboxed)
        canvas.drawColor(Color.rgb(127, 127, 127)) // Neutral gray fill

        val scaledBitmap = Bitmap.createScaledBitmap(rotatedBitmap, newW, newH, true)
        canvas.drawBitmap(scaledBitmap, padX, padY, Paint(Paint.FILTER_BITMAP_FLAG))

        // 4. Populate NCHW FloatBuffer with (x - 127.5) / 128.0 normalization
        val numPixels = targetWidth * targetHeight
        val floatBuffer = ByteBuffer.allocateDirect(1 * 3 * numPixels * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()

        val pixels = IntArray(numPixels)
        letterboxed.getPixels(pixels, 0, targetWidth, 0, 0, targetWidth, targetHeight)

        // R channel plane
        for (i in 0 until numPixels) {
            val c = pixels[i]
            val r = (c shr 16) and 0xFF
            floatBuffer.put((r - ScrfdModelMetadata.INPUT_MEAN[0]) / ScrfdModelMetadata.INPUT_STD[0])
        }

        // G channel plane
        for (i in 0 until numPixels) {
            val c = pixels[i]
            val g = (c shr 8) and 0xFF
            floatBuffer.put((g - ScrfdModelMetadata.INPUT_MEAN[1]) / ScrfdModelMetadata.INPUT_STD[1])
        }

        // B channel plane
        for (i in 0 until numPixels) {
            val c = pixels[i]
            val b = c and 0xFF
            floatBuffer.put((b - ScrfdModelMetadata.INPUT_MEAN[2]) / ScrfdModelMetadata.INPUT_STD[2])
        }

        floatBuffer.rewind()

        val info = LetterboxInfo(
            scale = scale,
            padX = padX,
            padY = padY,
            originalWidth = origW,
            originalHeight = origH,
            rotationApplied = rotationDegrees
        )

        return Pair(floatBuffer, info)
    }
}
