package com.mariner.pro;

import android.content.res.AssetManager;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;

public class LocalAssetServer implements Runnable {
    private static final String TAG = "LocalAssetServer";
    public static final int PORT = 8080;
    private final AssetManager assetManager;
    private ServerSocket serverSocket;
    private volatile boolean isRunning = false;

    public LocalAssetServer(AssetManager assetManager) {
        this.assetManager = assetManager;
    }

    public synchronized void start() {
        if (isRunning) return;
        isRunning = true;
        Thread thread = new Thread(this, "LocalAssetServerThread");
        thread.setDaemon(true);
        thread.start();
    }

    public synchronized void stop() {
        isRunning = false;
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void run() {
        try {
            serverSocket = new ServerSocket(PORT, 50, InetAddress.getByName("127.0.0.1"));
            Log.i(TAG, "Local offline HTTP server listening on http://127.0.0.1:" + PORT);

            while (isRunning) {
                try {
                    Socket socket = serverSocket.accept();
                    handleClient(socket);
                } catch (Exception e) {
                    if (!isRunning) break;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting local server: " + e.getMessage());
        }
    }

    private void handleClient(final Socket socket) {
        new Thread(() -> {
            try {
                InputStream in = socket.getInputStream();
                OutputStream out = socket.getOutputStream();

                byte[] buffer = new byte[2048];
                int read = in.read(buffer);
                if (read <= 0) {
                    socket.close();
                    return;
                }

                String request = new String(buffer, 0, read);
                String[] lines = request.split("\r\n");
                if (lines.length == 0) {
                    socket.close();
                    return;
                }

                String[] requestLine = lines[0].split(" ");
                if (requestLine.length < 2 || !requestLine[0].equalsIgnoreCase("GET")) {
                    socket.close();
                    return;
                }

                String uri = requestLine[1];
                if (uri.contains("?")) {
                    uri = uri.substring(0, uri.indexOf("?"));
                }
                if (uri.startsWith("/")) {
                    uri = uri.substring(1);
                }
                if (uri.isEmpty()) {
                    uri = "index.html";
                }

                String assetPath = "public/" + uri;
                byte[] data = null;
                String contentType = getMimeType(uri);

                try {
                    data = readAsset(assetPath);
                } catch (Exception e) {
                    // Fallback to SPA index.html
                    try {
                        data = readAsset("public/index.html");
                        contentType = "text/html; charset=UTF-8";
                    } catch (Exception ignored) {}
                }

                if (data != null) {
                    String headers = "HTTP/1.1 200 OK\r\n" +
                            "Content-Type: " + contentType + "\r\n" +
                            "Content-Length: " + data.length + "\r\n" +
                            "Access-Control-Allow-Origin: *\r\n" +
                            "Connection: close\r\n\r\n";
                    out.write(headers.getBytes("UTF-8"));
                    out.write(data);
                } else {
                    String notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
                    out.write(notFound.getBytes("UTF-8"));
                }

                out.flush();
                socket.close();
            } catch (Exception e) {
                try { socket.close(); } catch (Exception ignored) {}
            }
        }).start();
    }

    private byte[] readAsset(String path) throws Exception {
        InputStream is = assetManager.open(path);
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int nRead;
        byte[] data = new byte[4096];
        while ((nRead = is.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, nRead);
        }
        buffer.flush();
        is.close();
        return buffer.toByteArray();
    }

    private String getMimeType(String path) {
        if (path.endsWith(".html")) return "text/html; charset=UTF-8";
        if (path.endsWith(".js")) return "application/javascript; charset=UTF-8";
        if (path.endsWith(".css")) return "text/css; charset=UTF-8";
        if (path.endsWith(".json")) return "application/json; charset=UTF-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
