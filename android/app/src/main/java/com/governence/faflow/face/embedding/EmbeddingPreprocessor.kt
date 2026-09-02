package com.governence.faflow.face.embedding

import android.graphics.Bitmap
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Preprocessing engine transforming 112x112 aligned face bitmaps into NCHW normalized float tensors.
 */
object EmbeddingPreprocessor {

    const val INPUT_WIDTH = 112
    const val INPUT_HEIGHT = 112
    const val NUM_CHANNELS = 3
    const val TOTAL_FLOATS = 1 * NUM_CHANNELS * INPUT_WIDTH * INPUT_HEIGHT // 37,632 floats

    private const val MEAN = 127.5f
    private const val STD = 128.0f

    /**
     * Converts a 112x112 canonical face bitmap into a direct FloatBuffer in NCHW Float32 layout.
     * Normalization formula: (pixel - 127.5) / 128.0
     */
    fun preprocessBitmapToFloatBuffer(bitmap: Bitmap): FloatBuffer {
        val scaledBitmap = if (bitmap.width != INPUT_WIDTH || bitmap.height != INPUT_HEIGHT) {
            Bitmap.createScaledBitmap(bitmap, INPUT_WIDTH, INPUT_HEIGHT, true)
        } else {
            bitmap
        }

        val intValues = IntArray(INPUT_WIDTH * INPUT_HEIGHT)
        scaledBitmap.getPixels(intValues, 0, INPUT_WIDTH, 0, 0, INPUT_WIDTH, INPUT_HEIGHT)

        val byteBuffer = ByteBuffer.allocateDirect(TOTAL_FLOATS * 4).apply {
            order(ByteOrder.nativeOrder())
        }
        val floatBuffer = byteBuffer.asFloatBuffer()

        val channelStride = INPUT_WIDTH * INPUT_HEIGHT

        // Write R channel plane
        for (i in 0 until channelStride) {
            val pixel = intValues[i]
            val r = (pixel shr 16) and 0xFF
            floatBuffer.put(i, (r - MEAN) / STD)
        }

        // Write G channel plane
        for (i in 0 until channelStride) {
            val pixel = intValues[i]
            val g = (pixel shr 8) and 0xFF
            floatBuffer.put(channelStride + i, (g - MEAN) / STD)
        }

        // Write B channel plane
        for (i in 0 until channelStride) {
            val pixel = intValues[i]
            val b = pixel and 0xFF
            floatBuffer.put(channelStride * 2 + i, (b - MEAN) / STD)
        }

        floatBuffer.rewind()
        return floatBuffer
    }
}
