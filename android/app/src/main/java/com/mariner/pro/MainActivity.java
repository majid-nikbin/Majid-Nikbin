package com.mariner.pro;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private LocalAssetServer localServer;
    private MarinerNativeStorage nativeStorage;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            localServer = new LocalAssetServer(getAssets());
            localServer.start();
        } catch (Exception ignored) {}

        try {
            nativeStorage = new MarinerNativeStorage(this);
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(nativeStorage, "MarinerNativeStorage");
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        if (localServer != null) {
            localServer.stop();
        }
        super.onDestroy();
    }
}
