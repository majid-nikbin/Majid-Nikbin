package com.mariner.pro;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private LocalAssetServer localServer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            localServer = new LocalAssetServer(getAssets());
            localServer.start();
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
