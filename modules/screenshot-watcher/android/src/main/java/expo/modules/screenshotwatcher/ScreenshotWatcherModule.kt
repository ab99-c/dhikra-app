package expo.modules.screenshotwatcher

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native screenshot watcher for Dhikra.
 *
 * Observes MediaStore image changes on a background thread and emits an
 * "onScreenshotTaken" event whenever a NEW image appears in the device's
 * Screenshots folder — including when the app is in the background.
 *
 * Requires a development build (not available in Expo Go).
 */
class ScreenshotWatcherModule : Module() {
  private val handlerThread by lazy {
    HandlerThread("dhikra-screenshot-watcher").apply { start() }
  }
  private val handler by lazy { Handler(handlerThread.looper) }
  private var observer: ContentObserver? = null
  private var lastHandledId: Long = -1L

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is null" }

  override fun definition() = ModuleDefinition {
    Name("ScreenshotWatcher")

    Events("onScreenshotTaken")

    OnCreate {
      // Only react to screenshots taken AFTER the app started; the JS side
      // scans the album separately for anything older.
      lastHandledId = findLatestScreenshotId()
      startObserving()
    }

    OnDestroy {
      stopObserving()
      handlerThread.quitSafely()
    }
  }

  private fun findLatestScreenshotId(): Long {
    return queryLatestScreenshot()?.get("id") as? Long ?: -1L
  }

  private fun startObserving() {
    if (observer != null) return
    observer = object : ContentObserver(handler) {
      override fun onChange(selfChange: Boolean, uri: Uri?) {
        super.onChange(selfChange, uri)
        handleMediaStoreChange()
      }
    }
    context.contentResolver.registerContentObserver(
      MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      true,
      observer,
    )
  }

  private fun stopObserving() {
    observer?.let {
      context.contentResolver.unregisterContentObserver(it)
      observer = null
    }
  }

  private fun handleMediaStoreChange() {
    val latest = queryLatestScreenshot() ?: return
    val id = latest["id"] as? Long ?: return
    if (id <= lastHandledId) return
    lastHandledId = id
    sendEvent("onScreenshotTaken", latest)
  }

  private fun queryLatestScreenshot(): Map<String, Any>? {
    val projection = arrayOf(
      MediaStore.Images.Media._ID,
      MediaStore.Images.Media.DISPLAY_NAME,
      MediaStore.Images.Media.DATE_ADDED,
      MediaStore.Images.Media.WIDTH,
      MediaStore.Images.Media.HEIGHT,
    )
    val selection: String
    val selectionArgs: Array<String>
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      selection = "${MediaStore.Images.Media.RELATIVE_PATH} LIKE ?"
      selectionArgs = arrayOf("%/Screenshots/%")
    } else {
      selection = "${MediaStore.Images.Media.BUCKET_DISPLAY_NAME} = ?"
      selectionArgs = arrayOf("Screenshots")
    }
    val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"

    return try {
      context.contentResolver.query(
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        projection,
        selection,
        selectionArgs,
        sortOrder,
      )?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID))
        val contentUri = Uri.withAppendedPath(
          MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
          id.toString(),
        )
        mapOf(
          "id" to id,
          "uri" to contentUri.toString(),
          "filename" to cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)),
          "createdAt" to cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)) * 1000L,
          "width" to cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)),
          "height" to cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)),
        )
      }
    } catch (_: Exception) {
      null
    }
  }
}
