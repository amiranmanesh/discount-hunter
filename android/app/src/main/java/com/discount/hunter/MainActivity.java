package com.discount.hunter;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Starts the in-app server and keeps WebView back-navigation native.
 *
 * The server lives in {@link ServerService}; a started activity is the only
 * legal moment to raise a foreground service on Android 14+, so the launch is
 * here. The app navigates between tabs by real URL changes, so walking the
 * WebView history on back is what a native user expects; at the root of the
 * history the default behaviour (close the app) applies.
 */
public class MainActivity extends BridgeActivity {

    private static final int REQUEST_NOTIFICATIONS = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 13+ drops the foreground notification silently without the
        // runtime grant, and that notification is how the user sees the
        // server's state, its errors, and the address to share.
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this, new String[] {Manifest.permission.POST_NOTIFICATIONS},
                    REQUEST_NOTIFICATIONS);
        }

        Intent server = new Intent(this, ServerService.class);
        server.setAction(ServerService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(server);
        } else {
            startService(server);
        }
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
