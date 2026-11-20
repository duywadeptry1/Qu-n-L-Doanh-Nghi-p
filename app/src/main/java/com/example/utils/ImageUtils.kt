package com.example.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import android.util.LruCache
import android.widget.ImageView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.InputStream
import kotlin.math.max

object ImageUtils {

    // Cache decoded Bitmaps in memory (max 1/8 of available memory)
    private val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
    private val cacheSize = max(1024, maxMemory / 8)
    private val memoryCache = object : LruCache<String, Bitmap>(cacheSize) {
        override fun sizeOf(key: String, bitmap: Bitmap): Int {
            return bitmap.byteCount / 1024
        }
    }

    /**
     * Reads an image from Uri, downsamples and compresses it into a lightweight Base64 data URL
     * ready to be sent over HTTP and stored in MongoDB Atlas (typically ~40KB - 80KB).
     */
    suspend fun compressUriToBase64(
        context: Context,
        uri: Uri,
        maxDimension: Int = 640,
        quality: Int = 78
    ): String? = withContext(Dispatchers.IO) {
        try {
            val resolver = context.contentResolver

            // Step 1: Decode bounds only to calculate inSampleSize
            var input: InputStream? = resolver.openInputStream(uri) ?: return@withContext null
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeStream(input, null, options)
            input?.close()

            val origW = options.outWidth
            val origH = options.outHeight
            if (origW <= 0 || origH <= 0) return@withContext null

            // Calculate inSampleSize (power of 2)
            var inSampleSize = 1
            var halfW = origW
            var halfH = origH
            while (halfW > maxDimension * 1.5 || halfH > maxDimension * 1.5) {
                inSampleSize *= 2
                halfW /= 2
                halfH /= 2
            }

            // Step 2: Decode downsampled bitmap
            val decodeOptions = BitmapFactory.Options().apply {
                this.inSampleSize = inSampleSize
                inPreferredConfig = Bitmap.Config.RGB_565 // Saves 50% RAM compared to ARGB_8888
            }
            input = resolver.openInputStream(uri) ?: return@withContext null
            val sampledBmp = BitmapFactory.decodeStream(input, null, decodeOptions)
            input?.close()
            if (sampledBmp == null) return@withContext null

            // Step 3: Handle rotation from EXIF if needed
            val rotatedBmp = fixOrientation(context, uri, sampledBmp)

            // Step 4: Scale down precisely to fit within maxDimension
            val finalBmp = scaleBitmap(rotatedBmp, maxDimension)

            // Step 5: Compress to JPEG byte array
            val baos = ByteArrayOutputStream()
            finalBmp.compress(Bitmap.CompressFormat.JPEG, quality, baos)
            val bytes = baos.toByteArray()

            if (finalBmp != sampledBmp && !sampledBmp.isRecycled) {
                sampledBmp.recycle()
            }
            if (rotatedBmp != finalBmp && !rotatedBmp.isRecycled) {
                rotatedBmp.recycle()
            }

            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            "data:image/jpeg;base64,$base64"
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun fixOrientation(context: Context, uri: Uri, bitmap: Bitmap): Bitmap {
        return try {
            val input = context.contentResolver.openInputStream(uri) ?: return bitmap
            val exif = ExifInterface(input)
            val orientation = exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
            input.close()

            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                else -> return bitmap
            }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } catch (_: Exception) {
            bitmap
        }
    }

    private fun scaleBitmap(bitmap: Bitmap, maxDimension: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        if (width <= maxDimension && height <= maxDimension) return bitmap

        val ratio = width.toFloat() / height.toFloat()
        val targetW: Int
        val targetH: Int
        if (width >= height) {
            targetW = maxDimension
            targetH = (maxDimension / ratio).toInt().coerceAtLeast(1)
        } else {
            targetH = maxDimension
            targetW = (maxDimension * ratio).toInt().coerceAtLeast(1)
        }
        return Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
    }

    /**
     * Decodes a Base64 data URL into an in-memory Android Bitmap.
     */
    fun base64ToBitmap(base64Data: String): Bitmap? {
        val clean = if (base64Data.contains(",")) {
            base64Data.substringAfter(",")
        } else {
            base64Data
        }
        return try {
            val bytes = Base64.decode(clean, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Safely loads and caches product images from:
     * - Base64 Data URLs ("data:image/jpeg;base64,...")
     * - Content URIs ("content://...")
     * - Default Drawable Resources
     */
    fun loadProductImage(
        imageView: ImageView,
        imageUrl: String?,
        fallbackRes: Int
    ) {
        val url = imageUrl?.trim().orEmpty()
        if (url.isBlank()) {
            imageView.setImageResource(fallbackRes)
            return
        }

        // 1. Base64 Data URL (Stored in MongoDB Atlas)
        if (url.startsWith("data:image") || (url.length > 200 && !url.contains("://"))) {
            val cacheKey = "b64_" + url.take(64) + "_" + url.length
            val cached = memoryCache.get(cacheKey)
            if (cached != null && !cached.isRecycled) {
                imageView.setImageBitmap(cached)
                return
            }

            // Decode on background dispatcher to keep UI buttery smooth
            imageView.setImageResource(fallbackRes)
            imageView.tag = cacheKey
            CoroutineScope(Dispatchers.IO).launch {
                val bmp = base64ToBitmap(url)
                if (bmp != null) {
                    memoryCache.put(cacheKey, bmp)
                    withContext(Dispatchers.Main) {
                        if (imageView.tag == cacheKey) {
                            imageView.setImageBitmap(bmp)
                        }
                    }
                }
            }
            return
        }

        // 2. Content URI from local device
        if (url.startsWith("content://") || url.startsWith("file://")) {
            val cacheKey = "uri_" + url
            val cached = memoryCache.get(cacheKey)
            if (cached != null && !cached.isRecycled) {
                imageView.setImageBitmap(cached)
                return
            }

            imageView.setImageResource(fallbackRes)
            imageView.tag = cacheKey
            CoroutineScope(Dispatchers.IO).launch {
                val bmp = runCatching {
                    val uri = Uri.parse(url)
                    val input = imageView.context.contentResolver.openInputStream(uri)
                    val decoded = BitmapFactory.decodeStream(input)
                    input?.close()
                    decoded
                }.getOrNull()

                if (bmp != null) {
                    memoryCache.put(cacheKey, bmp)
                    withContext(Dispatchers.Main) {
                        if (imageView.tag == cacheKey) {
                            imageView.setImageBitmap(bmp)
                        }
                    }
                }
            }
            return
        }

        imageView.setImageResource(fallbackRes)
    }
}
