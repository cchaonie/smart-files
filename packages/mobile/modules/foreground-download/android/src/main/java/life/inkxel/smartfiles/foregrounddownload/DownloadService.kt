package life.inkxel.smartfiles.foregrounddownload

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Binder
import android.os.Build
import android.os.Environment
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class DownloadService : Service() {
  inner class LocalBinder : Binder() {
    fun getService(): DownloadService = this@DownloadService
  }

  private val binder = LocalBinder()
  private val NOTIFICATION_ID = 1001
  private val CHANNEL_ID = "apk_download"
  private val CHANNEL_NAME = "APK 下载"

  private var module: ForegroundDownloadModule? = null
  private var downloadThread: Thread? = null
  private var isRunning = false
  private var cancelRequested = false

  fun setModule(mod: ForegroundDownloadModule) {
    module = mod
  }

  fun isDownloading(): Boolean = isRunning

  fun cancel() {
    cancelRequested = true
    isRunning = false
    downloadThread?.interrupt()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val url = intent?.getStringExtra("url") ?: return START_NOT_STICKY
    val fileName = intent?.getStringExtra("fileName") ?: "update.apk"

    val notification = buildNotification("准备下载…", 0, false)
    startForeground(NOTIFICATION_ID, notification)

    startDownload(url, fileName)

    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder = binder

  private fun startDownload(urlString: String, fileName: String) {
    downloadThread = Thread {
      isRunning = true
      cancelRequested = false

      try {
        val url = URL(urlString)
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = 15000
        connection.readTimeout = 30000
        connection.connect()

        val totalBytes = connection.contentLengthLong
        val inputStream = connection.inputStream

        val downloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: filesDir
        val outputFile = File(downloadsDir, fileName)
        val outputStream = FileOutputStream(outputFile)

        val buffer = ByteArray(8192)
        var bytesRead: Int
        var totalRead: Long = 0
        var lastNotificationPercent = -1

        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
          if (cancelRequested) {
            outputStream.close()
            inputStream.close()
            connection.disconnect()
            outputFile.delete()
            return@Thread
          }

          outputStream.write(buffer, 0, bytesRead)
          totalRead += bytesRead

          // Throttle notification updates to every 2% to avoid binder spam
          val percent = if (totalBytes > 0) ((totalRead * 100) / totalBytes).toInt() else 0
          if (percent != lastNotificationPercent) {
            lastNotificationPercent = percent
            val notification = buildNotification("正在下载更新… $percent%", percent, false)
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(NOTIFICATION_ID, notification)

            // Emit progress to JS
            module?.sendProgress(totalRead, totalBytes)
          }
        }

        outputStream.close()
        inputStream.close()
        connection.disconnect()

        // Download complete — show install notification
        val absolutePath = outputFile.absolutePath
        val installIntent = createInstallIntent(absolutePath)
        val pendingInstall = PendingIntent.getActivity(
          this, 0, installIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val completeNotification = NotificationCompat.Builder(this, CHANNEL_ID)
          .setContentTitle("下载完成")
          .setContentText("点击安装更新")
          .setSmallIcon(android.R.drawable.stat_sys_download_done)
          .setContentIntent(pendingInstall)
          .setAutoCancel(true)
          .setOngoing(false)
          .setPriority(NotificationCompat.PRIORITY_HIGH)
          .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, completeNotification)

        // Stop foreground (notification stays as regular notification)
        stopForeground(STOP_FOREGROUND_DETACH)

        // Emit complete to JS
        module?.sendComplete(absolutePath)

      } catch (e: Exception) {
        if (!cancelRequested) {
          val errorNotification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("下载失败")
            .setContentText(e.message ?: "未知错误")
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setAutoCancel(true)
            .setOngoing(false)
            .build()

          val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
          notificationManager.notify(NOTIFICATION_ID, errorNotification)

          stopForeground(STOP_FOREGROUND_DETACH)
          module?.sendError(e.message ?: "下载失败")
        }
      } finally {
        isRunning = false
      }
    }
    downloadThread?.start()
  }

  private fun buildNotification(text: String, progress: Int, indeterminate: Boolean): Notification {
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("更新 Smart Files")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)

    if (progress > 0) {
      builder.setProgress(100, progress, false)
    } else if (indeterminate) {
      builder.setProgress(0, 0, true)
    }

    return builder.build()
  }

  private fun createInstallIntent(apkPath: String): Intent {
    val file = File(apkPath)
    val uri: Uri

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      // Use FileProvider for Android 7+
      val providerAuthority = "${packageName}.fileprovider"
      uri = androidx.core.content.FileProvider.getUriForFile(this, providerAuthority, file)
    } else {
      uri = Uri.fromFile(file)
    }

    return Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
  }

  private fun createNotificationChannel() {
    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "APK 下载进度通知"
      setShowBadge(false)
    }
    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.createNotificationChannel(channel)
  }
}
