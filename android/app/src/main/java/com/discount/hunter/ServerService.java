package com.discount.hunter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Runs the app's own Next.js server on the phone.
 *
 * Layout it assembles at runtime:
 *   assets/server-bundle.zip   →  filesDir/server/   (standalone Next.js app
 *                                                     + public/ + bootstrap.js)
 *   jniLibs/<abi>/libnode.so   →  nativeLibraryDir/libnode.so  (the Android
 *              build of Node.js; the installer extracts it there and that is
 *              the one directory an app may exec from on API 29+)
 *
 * The service is foreground+sticky: a persistent notification shows the
 * address, and a dead Node process is restarted with backoff. Other devices
 * on the Wi-Fi reach the same server at http://<phone-ip>:3000.
 */
public class ServerService extends Service {

    public static final String ACTION_START = "com.discount.hunter.START_SERVER";
    private static final String TAG = "DHServer";
    private static final String CHANNEL_ID = "dh-server";
    private static final int NOTIFICATION_ID = 1001;

    private volatile boolean running = true;
    private volatile Process nodeProcess;
    private Thread supervisor;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundCompat();
        if (!running) running = true;
        if (supervisor == null || !supervisor.isAlive()) {
            supervisor = new Thread(this::supervise, "dh-node-supervisor");
            supervisor.start();
        }
        return START_STICKY;
    }

    /* ------------------------------------------------------------ server */

    private void supervise() {
        try {
            ensureBundle();
        } catch (IOException e) {
            Log.e(TAG, "bundle extraction failed", e);
            updateNotification("خطا در راه‌اندازی سرور");
            return;
        }

        int backoff = 1;
        while (running) {
            long startedAt = System.currentTimeMillis();
            try {
                startNode();
                backoff = 1;
            } catch (IOException e) {
                Log.e(TAG, "node spawn failed", e);
            }
            try {
                if (nodeProcess != null) nodeProcess.waitFor();
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
                return;
            }
            if (!running) return;

            // A crash loop should not spin the CPU: back off, reset if the
            // process at least lived a minute.
            if (System.currentTimeMillis() - startedAt > 60_000) backoff = 1;
            try {
                TimeUnit.SECONDS.sleep(backoff);
            } catch (InterruptedException ignored) {
                return;
            }
            backoff = Math.min(backoff * 2, 30);
            updateNotification("سرور در حال راه‌اندازی مجدد…");
        }
    }

    private void startNode() throws IOException {
        File serverDir = new File(getFilesDir(), "server");
        File bootstrap = new File(serverDir, "bootstrap.js");
        String node = new File(getApplicationInfo().nativeLibraryDir, "libnode.so").getAbsolutePath();

        ProcessBuilder pb = new ProcessBuilder(node, bootstrap.getAbsolutePath());
        pb.directory(serverDir);
        pb.redirectErrorStream(true);
        pb.environment().put("PORT", "3000");
        pb.environment().put("HOSTNAME", "0.0.0.0");
        Process p = pb.start();
        nodeProcess = p;
        updateNotification("سرور روشن است · پورت ۳۰۰۰");

        // Drain stdout/stderr to logcat so `adb logcat -s DHNode` shows the
        // Next.js output; a full pipe would otherwise deadlock the child.
        Thread drainer = new Thread(() -> {
            byte[] buf = new byte[4096];
            try (InputStream in = p.getInputStream()) {
                int n;
                StringBuilder line = new StringBuilder();
                while ((n = in.read(buf)) != -1) {
                    line.append(new String(buf, 0, n));
                    int idx;
                    while ((idx = line.indexOf("\n")) >= 0) {
                        Log.i("DHNode", line.substring(0, idx).trim());
                        line.delete(0, idx + 1);
                    }
                }
            } catch (IOException ignored) {
                /* process end */
            }
        }, "dh-node-stdout");
        drainer.setDaemon(true);
        drainer.start();
    }

    /* ------------------------------------------------------------ bundle */

    /** Unpack assets/server-bundle.zip when missing or from an older app build. */
    private void ensureBundle() throws IOException {
        File dir = new File(getFilesDir(), "server");
        File marker = new File(dir, ".bundle-version");
        String version = appVersion();
        if (marker.exists() && version.equals(readMarker(marker))) return;

        deleteRecursive(dir);
        dir.mkdirs();
        try (InputStream in = getAssets().open("server-bundle.zip");
             ZipInputStream zip = new ZipInputStream(in)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                File out = new File(dir, entry.getName());
                // Zip-slip guard: nothing may escape the bundle directory.
                if (!out.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator)) {
                    throw new IOException("zip entry escapes target: " + entry.getName());
                }
                if (entry.isDirectory()) {
                    out.mkdirs();
                } else {
                    out.getParentFile().mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(out)) {
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = zip.read(buf)) != -1) fos.write(buf, 0, n);
                    }
                }
                zip.closeEntry();
            }
        }
        writeMarker(marker, version);
        Log.i(TAG, "server bundle unpacked for " + version);
    }

    private String appVersion() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return String.valueOf(info.getLongVersionCode());
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static String readMarker(File f) {
        try (InputStream in = new java.io.FileInputStream(f)) {
            return new String(in.readAllBytes()).trim();
        } catch (IOException e) {
            return "";
        }
    }

    private static void writeMarker(File f, String v) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(f)) {
            fos.write(v.getBytes());
        }
    }

    private static void deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRecursive(k);
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    /* ------------------------------------------------------ notification */

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "سرور شکارچی تخفیف", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("تا وقتی سرور برنامه روشن است این اعلان می‌ماند.");
            getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("شکارچی تخفیف")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private void startForegroundCompat() {
        Notification n = buildNotification("سرور در حال راه‌اندازی…");
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
    }

    private void updateNotification(String text) {
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification(text));
    }

    /* -------------------------------------------------------- lifecycle */

    @Override
    public void onDestroy() {
        running = false;
        Process p = nodeProcess;
        if (p != null) p.destroy();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
