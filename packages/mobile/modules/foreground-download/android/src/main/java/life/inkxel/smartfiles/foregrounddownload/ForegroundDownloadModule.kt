package life.inkxel.smartfiles.foregrounddownload

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class ForegroundDownloadModule : Module() {
  private var boundService: DownloadService? = null
  private var isBound = false

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      val binder = service as DownloadService.LocalBinder
      boundService = binder.getService()
      boundService?.setModule(this@ForegroundDownloadModule)
      isBound = true
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      boundService = null
      isBound = false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ForegroundDownload")

    Events("onProgress", "onComplete", "onError")

    AsyncFunction("startDownload") { url: String, fileName: String ->
      val ctx = appContext.reactContext ?: throw Exception("React context not available")
      val intent = Intent(ctx, DownloadService::class.java).apply {
        putExtra("url", url)
        putExtra("fileName", fileName)
      }
      ctx.startForegroundService(intent)
      ctx.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    AsyncFunction("cancelDownload") {
      val ctx = appContext.reactContext
      if (isBound && boundService != null) {
        boundService?.cancel()
      }
      if (ctx != null && isBound) {
        try {
          ctx.unbindService(connection)
        } catch (_: Exception) {}
        isBound = false
        boundService = null
      }
    }

    Function("isDownloading") {
      boundService?.isDownloading() ?: false
    }
  }

  fun sendProgress(bytesWritten: Long, bytesTotal: Long) {
    sendEvent("onProgress", mapOf(
      "bytesWritten" to bytesWritten,
      "bytesTotal" to bytesTotal,
    ))
  }

  fun sendComplete(localPath: String) {
    sendEvent("onComplete", mapOf(
      "localPath" to localPath,
    ))
    cleanup()
  }

  fun sendError(message: String) {
    sendEvent("onError", mapOf(
      "message" to message,
    ))
    cleanup()
  }

  private fun cleanup() {
    val ctx = appContext.reactContext
    if (ctx != null && isBound) {
      try {
        ctx.unbindService(connection)
      } catch (_: Exception) {}
    }
    isBound = false
    boundService = null
  }
}
