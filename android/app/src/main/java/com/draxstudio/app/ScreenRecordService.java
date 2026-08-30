package com.draxstudio.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.AudioManager;
import android.media.Image;
import android.media.ImageReader;
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
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
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

    private static final int[] PALETTE = {
        Color.parseColor("#FF3B30"),
        Color.parseColor("#FF8A3D"),
        Color.parseColor("#2F9BFF"),
        Color.parseColor("#34C759"),
        Color.parseColor("#AF52DE"),
        Color.parseColor("#FFFFFF"),
    };

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
    private AudioManager audioManager;

    // ---- Bubble (pill / lápis toolbar / mais panel / minimized) ----
    private View bubbleView;
    private WindowManager.LayoutParams bubbleParams;
    private View miniContainer;
    private View fullContainer;
    private Chronometer bubbleTimer;
    private Chronometer bubbleMiniTimer;
    private View recDot;
    private View miniDot;
    private TextView pausedLabel;
    private ImageButton pauseButton;
    private View lapisToolbar;
    private ImageButton toolCanetaIcon;
    private ImageButton toolBorrachaIcon;
    private LinearLayout colorSwatchesRow;
    private View maisPanel;
    private ImageView maisAudioIcon;
    private TextView maisAudioLabel;
    private boolean isMinimized = false;
    private boolean isLapisOpen = false;
    private boolean isMaisOpen = false;
    private boolean isMicMuted = false;

    // ---- "Lápis" drawing overlay: a separate full-screen window so its
    // strokes are captured, unlike the pill/toolbar chrome above. ----
    private DrawingOverlayView drawingView;
    private WindowManager.LayoutParams drawingParams;

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
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
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
        if (isRecording) {
            // A start arrived while one is already running (e.g. a duplicate
            // tap that raced past the JS-side guard): reject it without
            // tearing down the recording that's already in progress.
            if (callback != null) callback.onError("Já existe uma gravação em andamento.");
            return;
        }
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
            // Aligned to a multiple of 16: several hardware H.264 encoders
            // (notably some Mediatek/Qualcomm chipsets) reject or silently
            // corrupt odd macroblock-unaligned dimensions, which is why this
            // failed intermittently depending on the device's exact screen size.
            videoWidth = alignToMacroblock(metrics.widthPixels);
            videoHeight = alignToMacroblock(metrics.heightPixels);

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
        mediaRecorder.setOnErrorListener((mr, what, extra) -> {
            if (isRecording) {
                notifyError("Erro no gravador durante a captura (código " + what + "/" + extra + ").");
            }
        });
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
            long pausedGap = SystemClock.elapsedRealtime() - pausedAtElapsed;
            if (bubbleTimer != null) bubbleTimer.setBase(bubbleTimer.getBase() + pausedGap);
            if (bubbleMiniTimer != null) bubbleMiniTimer.setBase(bubbleMiniTimer.getBase() + pausedGap);
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
        removeDrawingOverlay();
        if (isMicMuted && audioManager != null) {
            audioManager.setMicrophoneMute(false);
            isMicMuted = false;
        }
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

    private int alignToMacroblock(int value) {
        int aligned = value - (value % 16);
        return Math.max(aligned, 16);
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

        miniContainer = bubbleView.findViewById(R.id.bubble_mini);
        fullContainer = bubbleView.findViewById(R.id.bubble_full);
        recDot = bubbleView.findViewById(R.id.bubble_rec_dot);
        miniDot = bubbleView.findViewById(R.id.bubble_mini_dot);
        pausedLabel = bubbleView.findViewById(R.id.bubble_paused_label);
        lapisToolbar = bubbleView.findViewById(R.id.lapis_toolbar);
        maisPanel = bubbleView.findViewById(R.id.mais_panel);
        colorSwatchesRow = bubbleView.findViewById(R.id.color_swatches);

        bubbleTimer = bubbleView.findViewById(R.id.bubble_timer);
        bubbleTimer.setBase(SystemClock.elapsedRealtime());
        bubbleTimer.start();
        bubbleMiniTimer = bubbleView.findViewById(R.id.bubble_mini_timer);
        bubbleMiniTimer.setBase(bubbleTimer.getBase());
        bubbleMiniTimer.start();

        pauseButton = bubbleView.findViewById(R.id.bubble_pause);
        pauseButton.setOnClickListener(v -> sendSelfAction(isPaused ? ACTION_RESUME : ACTION_PAUSE));

        ImageButton stopButton = bubbleView.findViewById(R.id.bubble_stop);
        stopButton.setOnClickListener(v -> sendSelfAction(ACTION_STOP));

        View dragHandle = bubbleView.findViewById(R.id.bubble_drag_handle);
        dragHandle.setOnTouchListener(new DragTouchListener());

        ImageButton lapisButton = bubbleView.findViewById(R.id.bubble_lapis);
        lapisButton.setOnClickListener(v -> toggleLapis(lapisButton));

        ImageButton maisButton = bubbleView.findViewById(R.id.bubble_mais);
        maisButton.setOnClickListener(v -> toggleMais());

        ImageButton minimizeButton = bubbleView.findViewById(R.id.bubble_minimize);
        minimizeButton.setOnClickListener(v -> setMinimized(true));

        ImageButton expandButton = bubbleView.findViewById(R.id.bubble_expand);
        expandButton.setOnClickListener(v -> setMinimized(false));

        setUpLapisToolbar();
        setUpMaisPanel();

        windowManager.addView(bubbleView, bubbleParams);
    }

    private void setMinimized(boolean minimized) {
        isMinimized = minimized;
        miniContainer.setVisibility(minimized ? View.VISIBLE : View.GONE);
        fullContainer.setVisibility(minimized ? View.GONE : View.VISIBLE);
        if (minimized) {
            // Collapsing while Lápis/Mais are open would leave them stuck
            // open with no way to reach their toolbars, so fold them away.
            if (isLapisOpen) setLapisOpen(false, null);
            isMaisOpen = false;
            maisPanel.setVisibility(View.GONE);
        }
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
        if (recDot != null) recDot.setBackgroundResource(isPaused ? R.drawable.bg_rec_dot_paused : R.drawable.bg_rec_dot);
        if (miniDot != null) miniDot.setBackgroundResource(isPaused ? R.drawable.bg_rec_dot_paused : R.drawable.bg_rec_dot);
        if (pausedLabel != null) pausedLabel.setVisibility(isPaused ? View.VISIBLE : View.GONE);
        if (bubbleTimer != null && bubbleMiniTimer != null) {
            if (isPaused) {
                bubbleTimer.stop();
                bubbleMiniTimer.stop();
            } else {
                bubbleTimer.start();
                bubbleMiniTimer.start();
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

    // ---- "Lápis" annotation tool ----

    private void setUpLapisToolbar() {
        toolCanetaIcon = bubbleView.findViewById(R.id.tool_caneta_icon);
        toolBorrachaIcon = bubbleView.findViewById(R.id.tool_borracha_icon);

        toolCanetaIcon.setOnClickListener(v -> selectTool(DrawingOverlayView.Tool.PEN));
        toolBorrachaIcon.setOnClickListener(v -> selectTool(DrawingOverlayView.Tool.ERASER));

        // A dropdown/PopupMenu can't be shown from a Service (it needs an
        // Activity window token and would throw BadTokenException), so
        // thickness is a tap-to-cycle control instead.
        TextView espessuraLabel = bubbleView.findViewById(R.id.tool_espessura_label);
        View espessura = bubbleView.findViewById(R.id.tool_espessura);
        espessura.setOnClickListener(v -> cycleThickness(espessuraLabel));

        ImageButton limpar = bubbleView.findViewById(R.id.tool_limpar);
        limpar.setOnClickListener(v -> {
            if (drawingView != null) drawingView.clearAll();
        });

        for (int paletteColor : PALETTE) {
            ImageView dot = new ImageView(this);
            int size = (int) (20 * getResources().getDisplayMetrics().density);
            int margin = (int) (4 * getResources().getDisplayMetrics().density);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, size);
            lp.setMargins(margin, 0, margin, 0);
            dot.setLayoutParams(lp);
            dot.setImageResource(R.drawable.bg_swatch_dot);
            dot.setColorFilter(paletteColor);
            dot.setScaleX(paletteColor == PALETTE[0] ? 1.3f : 1f);
            dot.setScaleY(paletteColor == PALETTE[0] ? 1.3f : 1f);
            dot.setOnClickListener(v -> {
                if (drawingView != null) drawingView.setColor(paletteColor);
                for (int i = 0; i < colorSwatchesRow.getChildCount(); i++) {
                    View child = colorSwatchesRow.getChildAt(i);
                    boolean selected = child == dot;
                    child.setScaleX(selected ? 1.3f : 1f);
                    child.setScaleY(selected ? 1.3f : 1f);
                }
            });
            colorSwatchesRow.addView(dot);
        }
    }

    private static final String[] THICKNESS_LABELS = { "Fina", "Média", "Grossa" };
    private static final float[] THICKNESS_VALUES_DP = { 4f, 8f, 14f };
    private int thicknessIndex = 1;

    private void cycleThickness(TextView label) {
        thicknessIndex = (thicknessIndex + 1) % THICKNESS_LABELS.length;
        label.setText(THICKNESS_LABELS[thicknessIndex]);
        if (drawingView != null) drawingView.setStrokeWidthDp(THICKNESS_VALUES_DP[thicknessIndex]);
    }

    private void selectTool(DrawingOverlayView.Tool tool) {
        if (drawingView != null) drawingView.setTool(tool);
        boolean pen = tool == DrawingOverlayView.Tool.PEN;
        toolCanetaIcon.setBackgroundResource(pen ? R.drawable.bg_tool_button_active : android.R.color.transparent);
        toolBorrachaIcon.setBackgroundResource(pen ? android.R.color.transparent : R.drawable.bg_tool_button_active);
    }

    private void toggleLapis(ImageButton lapisButton) {
        setLapisOpen(!isLapisOpen, lapisButton);
    }

    private void setLapisOpen(boolean open, @Nullable ImageButton lapisButton) {
        isLapisOpen = open;
        lapisToolbar.setVisibility(open ? View.VISIBLE : View.GONE);
        if (lapisButton != null) {
            lapisButton.setBackgroundResource(open ? R.drawable.bg_tool_button_active : android.R.color.transparent);
        }
        if (open) {
            addDrawingOverlay();
        } else {
            removeDrawingOverlay();
        }
    }

    private void addDrawingOverlay() {
        if (drawingView != null) return;
        drawingView = new DrawingOverlayView(this, null);

        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        drawingParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            0,
            PixelFormat.TRANSLUCENT
        );
        drawingParams.gravity = Gravity.TOP | Gravity.START;
        windowManager.addView(drawingView, drawingParams);

        // Re-add the bubble so it renders above the drawing canvas (most
        // recently added TYPE_APPLICATION_OVERLAY window ends up on top),
        // otherwise the toolbar would be unreachable once the canvas covers it.
        if (bubbleView != null) {
            windowManager.removeView(bubbleView);
            windowManager.addView(bubbleView, bubbleParams);
        }
    }

    private void removeDrawingOverlay() {
        if (drawingView != null && windowManager != null) {
            try {
                windowManager.removeView(drawingView);
            } catch (Exception ignored) {
            }
            drawingView = null;
        }
    }

    // ---- "Mais" panel ----

    private void setUpMaisPanel() {
        LinearLayout panel = (LinearLayout) maisPanel;

        addMaisRow(panel, "Câmera", R.drawable.ic_camera, false, null);

        View audioRow = addMaisRow(panel, "Áudio", R.drawable.ic_mic, true, this::toggleMicMute);
        maisAudioIcon = audioRow.findViewById(R.id.row_icon);
        maisAudioLabel = audioRow.findViewById(R.id.row_label);

        addMaisRow(panel, "Qualidade", R.drawable.ic_quality, false, null);
        addMaisRow(panel, "Cursor", R.drawable.ic_cursor, false, null);
        addMaisRow(panel, "Anotações", R.drawable.ic_pencil, true, () -> {
            isMaisOpen = false;
            maisPanel.setVisibility(View.GONE);
            ImageButton lapisButton = bubbleView.findViewById(R.id.bubble_lapis);
            setLapisOpen(true, lapisButton);
        });
        addMaisRow(panel, "Captura", R.drawable.ic_screenshot, true, this::takeScreenshot);
        addMaisRow(panel, "Configurações", R.drawable.ic_gear, true, this::openApp);
    }

    private View addMaisRow(LinearLayout panel, String label, int iconRes, boolean enabled, @Nullable Runnable onClick) {
        View row = LayoutInflater.from(this).inflate(R.layout.overlay_mais_row, panel, false);
        ImageView icon = row.findViewById(R.id.row_icon);
        TextView labelView = row.findViewById(R.id.row_label);
        TextView badge = row.findViewById(R.id.row_badge);

        icon.setImageResource(iconRes);
        labelView.setText(label);
        row.setAlpha(enabled ? 1f : 0.4f);
        if (!enabled) {
            badge.setVisibility(View.VISIBLE);
        } else if (onClick != null) {
            row.setOnClickListener(v -> onClick.run());
        }
        panel.addView(row);
        return row;
    }

    private void toggleMais() {
        isMaisOpen = !isMaisOpen;
        maisPanel.setVisibility(isMaisOpen ? View.VISIBLE : View.GONE);
    }

    private void toggleMicMute() {
        if (audioManager == null) return;
        isMicMuted = !isMicMuted;
        audioManager.setMicrophoneMute(isMicMuted);
        if (maisAudioIcon != null) {
            maisAudioIcon.setImageResource(isMicMuted ? R.drawable.ic_mic_off : R.drawable.ic_mic);
        }
        if (maisAudioLabel != null) {
            maisAudioLabel.setText(isMicMuted ? "Áudio (mudo)" : "Áudio");
        }
        Toast.makeText(this, isMicMuted ? "Microfone mudo" : "Microfone ativo", Toast.LENGTH_SHORT).show();
    }

    private void openApp() {
        isMaisOpen = false;
        maisPanel.setVisibility(View.GONE);
        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(launch);
    }

    private void takeScreenshot() {
        isMaisOpen = false;
        maisPanel.setVisibility(View.GONE);
        if (mediaProjection == null) return;

        ImageReader reader = ImageReader.newInstance(videoWidth, videoHeight, PixelFormat.RGBA_8888, 2);
        VirtualDisplay shotDisplay = mediaProjection.createVirtualDisplay(
            "DraxStudioScreenshot",
            videoWidth,
            videoHeight,
            screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.getSurface(),
            null,
            null
        );

        Handler handler = new Handler(Looper.getMainLooper());
        reader.setOnImageAvailableListener(r -> {
            Image image = null;
            try {
                image = r.acquireLatestImage();
                if (image != null) {
                    saveScreenshot(image);
                }
            } catch (Exception e) {
                Toast.makeText(ScreenRecordService.this, "Falha ao capturar print.", Toast.LENGTH_SHORT).show();
            } finally {
                if (image != null) image.close();
                shotDisplay.release();
                reader.close();
            }
        }, handler);
    }

    private void saveScreenshot(Image image) {
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int pixelStride = plane.getPixelStride();
        int rowStride = plane.getRowStride();
        int rowPadding = rowStride - pixelStride * videoWidth;

        Bitmap bitmap = Bitmap.createBitmap(videoWidth + rowPadding / pixelStride, videoHeight, Bitmap.Config.ARGB_8888);
        bitmap.copyPixelsFromBuffer(buffer);
        if (rowPadding != 0) {
            bitmap = Bitmap.createBitmap(bitmap, 0, 0, videoWidth, videoHeight);
        }

        File dir = new File(getExternalFilesDir(null), "DraxStudioScreenshots");
        if (!dir.exists()) dir.mkdirs();
        String name = "print_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".png";
        File file = new File(dir, name);

        try (OutputStream out = new FileOutputStream(file)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            Toast.makeText(this, "Print salvo", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Falha ao salvar print.", Toast.LENGTH_SHORT).show();
        }
    }
}
