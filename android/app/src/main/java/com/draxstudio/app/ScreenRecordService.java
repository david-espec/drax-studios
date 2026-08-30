package com.draxstudio.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Chronometer;
import android.widget.ImageButton;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Foreground service doing the actual screen capture (MediaProjection +
 * MediaRecorder) and hosting the floating control bubble (WindowManager
 * overlay) — the two pieces that only exist for native apps, never for a
 * website. Runs independently of the Activity so recording survives the
 * user switching to other apps.
 */
public class ScreenRecordService extends Service {

    public static final String ACTION_START = "com.draxstudio.app.action.START";
    public static final String ACTION_PAUSE = "com.draxstudio.app.action.PAUSE";
    public static final String ACTION_RESUME = "com.draxstudio.app.action.RESUME";
    public static final String ACTION_STOP = "com.draxstudio.app.action.STOP";

    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";

    private static final String CHANNEL_ID = "screen_recording";
    private static final int NOTIFICATION_ID = 4821;

    public interface Callback {
        void onStarted();
        void onPaused();
        void onResumed();
        void onStopped(String filePath, long durationMs, int width, int height);
        void onError(String message);
    }

    private static Callback callback;
    public static boolean pendingWithAudio = true;

    public static void setCallback(Callback cb) {
        callback = cb;
    }

    private MediaProjectionManager projectionManager;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private MediaRecorder mediaRecorder;
    private WindowManager windowManager;

    private View bubbleView;
    private WindowManager.LayoutParams bubbleParams;
    private Chronometer bubbleTimer;
    private ImageButton pauseButton;
    private long pausedAtElapsed;

    private String outputFilePath;
    private int videoWidth;
    private int videoHeight;
    private int screenDensity;
    private boolean isRecording = false;
    private boolean isPaused = false;
    private long recordingStartElapsed = 0;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return START_NOT_STICKY;
        }

        switch (intent.getAction()) {
            case ACTION_START:
                handleStart(intent);
                break;
            case ACTION_PAUSE:
                handlePause();
                break;
            case ACTION_RESUME:
                handleResume();
                break;
            case ACTION_STOP:
                handleStop();
                break;
        }
        return START_NOT_STICKY;
    }

    private void handleStart(Intent intent) {
        try {
            int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1);
            Intent resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
            if (resultCode != Activity.RESULT_OK || resultData == null) {
                notifyError("Permissão de gravação de tela não concedida.");
                return;
            }

            startForeground(NOTIFICATION_ID, buildNotification(false));

            DisplayMetrics metrics = getResources().getDisplayMetrics();
            screenDensity = metrics.densityDpi;
            videoWidth = roundToEven(metrics.widthPixels);
            videoHeight = roundToEven(metrics.heightPixels);

            mediaProjection = projectionManager.getMediaProjection(resultCode, resultData);
            if (mediaProjection == null) {
                notifyError("Não foi possível iniciar a captura de tela.");
                return;
            }
            mediaProjection.registerCallback(
                new MediaProjection.Callback() {
                    @Override
                    public void onStop() {
                        handleStop();
                    }
                },
                new Handler(Looper.getMainLooper())
            );

            outputFilePath = createOutputFilePath();
            setUpRecorder(pendingWithAudio);

            virtualDisplay = mediaProjection.createVirtualDisplay(
                "DraxStudioScreenRecord",
                videoWidth,
                videoHeight,
                screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mediaRecorder.getSurface(),
                null,
                null
            );

            mediaRecorder.start();
            isRecording = true;
            isPaused = false;
            recordingStartElapsed = SystemClock.elapsedRealtime();

            showBubble();
            if (callback != null) callback.onStarted();
        } catch (Exception e) {
            notifyError("Falha ao iniciar a gravação: " + e.getMessage());
            cleanUp();
        }
    }

    private void setUpRecorder(boolean withAudio) throws Exception {
        mediaRecorder = new MediaRecorder();
        if (withAudio) {
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        }
        mediaRecorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
        mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        mediaRecorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
        if (withAudio) {
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioEncodingBitRate(128_000);
            mediaRecorder.setAudioSamplingRate(44_100);
        }
        mediaRecorder.setVideoSize(videoWidth, videoHeight);
        mediaRecorder.setVideoEncodingBitRate(8_000_000);
        mediaRecorder.setVideoFrameRate(30);
        mediaRecorder.setOutputFile(outputFilePath);
        mediaRecorder.prepare();
    }

    private void handlePause() {
        if (!isRecording || isPaused || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            mediaRecorder.pause();
            isPaused = true;
            pausedAtElapsed = SystemClock.elapsedRealtime();
            updateBubbleForPauseState();
            startForeground(NOTIFICATION_ID, buildNotification(true));
            if (callback != null) callback.onPaused();
        } catch (Exception ignored) {
            // Recording continues; the bubble state simply won't flip.
        }
    }

    private void handleResume() {
        if (!isRecording || !isPaused || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            mediaRecorder.resume();
            isPaused = false;
            if (bubbleTimer != null) {
                long pausedGap = SystemClock.elapsedRealtime() - pausedAtElapsed;
                bubbleTimer.setBase(bubbleTimer.getBase() + pausedGap);
            }
            updateBubbleForPauseState();
            startForeground(NOTIFICATION_ID, buildNotification(false));
            if (callback != null) callback.onResumed();
        } catch (Exception ignored) {
        }
    }

    private void handleStop() {
        if (!isRecording) {
            stopSelf();
            return;
        }
        long durationMs = SystemClock.elapsedRealtime() - recordingStartElapsed;
        try {
            mediaRecorder.stop();
        } catch (Exception ignored) {
            // A stop() called too soon after start() can throw; the file is
            // still usable in practice for our use case (a real recording).
        }
        isRecording = false;

        String finishedPath = outputFilePath;
        int w = videoWidth;
        int h = videoHeight;

        cleanUp();

        if (callback != null) callback.onStopped(finishedPath, durationMs, w, h);
        stopForeground(true);
        stopSelf();
    }

    private void cleanUp() {
        removeBubble();
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (mediaRecorder != null) {
            try {
                mediaRecorder.reset();
                mediaRecorder.release();
            } catch (Exception ignored) {
            }
            mediaRecorder = null;
        }
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }
    }

    private void notifyError(String message) {
        if (callback != null) callback.onError(message);
        cleanUp();
        stopForeground(true);
        stopSelf();
    }

    private String createOutputFilePath() {
        File dir = new File(getExternalFilesDir(null), "DraxStudioRecordings");
        if (!dir.exists()) dir.mkdirs();
        String name = "gravacao_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".mp4";
        return new File(dir, name).getAbsolutePath();
    }

    private int roundToEven(int value) {
        return value % 2 == 0 ? value : value - 1;
    }

    // ---- Notification (required by Android for MediaProjection capture) ----

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Gravação de tela",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notificação exibida enquanto o Drax Studio grava sua tela.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(boolean paused) {
        Intent stopIntent = new Intent(this, ScreenRecordService.class);
        stopIntent.setAction(ACTION_STOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent stopPendingIntent = PendingIntent.getService(this, 0, stopIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(paused ? "Gravação pausada" : "Gravando sua tela")
            .setContentText("Drax Studio")
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setOngoing(true)
            .addAction(0, "Parar", stopPendingIntent)
            .build();
    }

    // ---- Floating control bubble ----

    private void showBubble() {
        LayoutInflater inflater = LayoutInflater.from(this);
        bubbleView = inflater.inflate(R.layout.overlay_bubble, null);

        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        bubbleParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = 24;
        bubbleParams.y = 120;

        bubbleTimer = bubbleView.findViewById(R.id.bubble_timer);
        bubbleTimer.setBase(SystemClock.elapsedRealtime());
        bubbleTimer.start();

        pauseButton = bubbleView.findViewById(R.id.bubble_pause);
        pauseButton.setOnClickListener(v -> sendSelfAction(isPaused ? ACTION_RESUME : ACTION_PAUSE));

        ImageButton stopButton = bubbleView.findViewById(R.id.bubble_stop);
        stopButton.setOnClickListener(v -> sendSelfAction(ACTION_STOP));

        View dragHandle = bubbleView.findViewById(R.id.bubble_drag_handle);
        dragHandle.setOnTouchListener(new DragTouchListener());

        windowManager.addView(bubbleView, bubbleParams);
    }

    private class DragTouchListener implements View.OnTouchListener {
        private int initialX;
        private int initialY;
        private float initialTouchX;
        private float initialTouchY;

        @Override
        public boolean onTouch(View v, MotionEvent event) {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    initialX = bubbleParams.x;
                    initialY = bubbleParams.y;
                    initialTouchX = event.getRawX();
                    initialTouchY = event.getRawY();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    bubbleParams.x = initialX + (int) (event.getRawX() - initialTouchX);
                    bubbleParams.y = initialY + (int) (event.getRawY() - initialTouchY);
                    windowManager.updateViewLayout(bubbleView, bubbleParams);
                    return true;
                default:
                    return false;
            }
        }
    }

    private void sendSelfAction(String action) {
        Intent intent = new Intent(this, ScreenRecordService.class);
        intent.setAction(action);
        startService(intent);
    }

    private void updateBubbleForPauseState() {
        if (pauseButton == null) return;
        pauseButton.setImageResource(isPaused ? R.drawable.ic_play : R.drawable.ic_pause);
        if (bubbleTimer != null) {
            if (isPaused) {
                bubbleTimer.stop();
            } else {
                bubbleTimer.start();
            }
        }
    }

    private void removeBubble() {
        if (bubbleView != null && windowManager != null) {
            try {
                windowManager.removeView(bubbleView);
            } catch (Exception ignored) {
            }
            bubbleView = null;
        }
    }
}
