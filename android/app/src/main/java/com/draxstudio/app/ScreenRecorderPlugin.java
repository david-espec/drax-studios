package com.draxstudio.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Bridges the web app to real Android screen recording: the "draw over other
 * apps" permission, the MediaProjection capture prompt, and the floating
 * control bubble — none of which have a web equivalent.
 */
@CapacitorPlugin(
    name = "ScreenRecorder",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class ScreenRecorderPlugin extends Plugin implements ScreenRecordService.Callback {

    private PluginCall pendingStartCall;
    private PluginCall pendingStopCall;

    @PluginMethod
    public void hasOverlayPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canDrawOverlays());
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (canDrawOverlays()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        startActivityForResult(call, intent, "overlayPermissionResult");
    }

    @ActivityCallback
    private void overlayPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject data = new JSObject();
        data.put("granted", canDrawOverlays());
        call.resolve(data);
    }

    private boolean canDrawOverlays() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (pendingStartCall != null) {
            call.reject("Uma gravação já está sendo iniciada.");
            return;
        }
        if (!canDrawOverlays()) {
            call.reject("Permissão para desenhar sobre outros apps não concedida.", "OVERLAY_PERMISSION_DENIED");
            return;
        }

        boolean wantsAudio = call.getBoolean("audio", true);
        if (wantsAudio && getPermissionState("microphone") != PermissionState.GRANTED) {
            call.setKeepAlive(true);
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }

        beginScreenCapture(call, wantsAudio);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (call == null) return;
        // Mic is a nice-to-have, not the blocking permission (that's overlay,
        // handled above): if the user denies it, record without audio instead
        // of failing the whole recording outright.
        boolean granted = getPermissionState("microphone") == PermissionState.GRANTED;
        beginScreenCapture(call, granted);
    }

    private void beginScreenCapture(PluginCall call, boolean withAudio) {
        Activity activity = getActivity();
        MediaProjectionManager manager = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            call.reject("Gravação de tela não é suportada neste dispositivo.");
            return;
        }

        pendingStartCall = call;
        call.setKeepAlive(true);
        ScreenRecordService.pendingWithAudio = withAudio;

        Intent captureIntent = manager.createScreenCaptureIntent();
        startActivityForResult(call, captureIntent, "screenCaptureResult");
    }

    @ActivityCallback
    private void screenCaptureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            pendingStartCall = null;
            call.reject("Permissão de gravação de tela negada.", "SCREEN_CAPTURE_DENIED");
            return;
        }

        ScreenRecordService.setCallback(this);
        Intent serviceIntent = new Intent(getContext(), ScreenRecordService.class);
        serviceIntent.setAction(ScreenRecordService.ACTION_START);
        serviceIntent.putExtra(ScreenRecordService.EXTRA_RESULT_CODE, result.getResultCode());
        serviceIntent.putExtra(ScreenRecordService.EXTRA_RESULT_DATA, result.getData());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        // pendingStartCall resolves from onStarted()/onError() once the service confirms.
    }

    @PluginMethod
    public void pauseRecording(PluginCall call) {
        sendAction(ScreenRecordService.ACTION_PAUSE);
        call.resolve();
    }

    @PluginMethod
    public void resumeRecording(PluginCall call) {
        sendAction(ScreenRecordService.ACTION_RESUME);
        call.resolve();
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        pendingStopCall = call;
        call.setKeepAlive(true);
        sendAction(ScreenRecordService.ACTION_STOP);
    }

    private void sendAction(String action) {
        Intent intent = new Intent(getContext(), ScreenRecordService.class);
        intent.setAction(action);
        getContext().startService(intent);
    }

    @Override
    public void onStarted() {
        if (pendingStartCall != null) {
            JSObject data = new JSObject();
            data.put("started", true);
            pendingStartCall.resolve(data);
            pendingStartCall = null;
        }
        notifyListeners("recordingStateChanged", stateEvent("recording"));
    }

    @Override
    public void onPaused() {
        notifyListeners("recordingStateChanged", stateEvent("paused"));
    }

    @Override
    public void onResumed() {
        notifyListeners("recordingStateChanged", stateEvent("recording"));
    }

    @Override
    public void onStopped(String filePath, long durationMs, int width, int height) {
        JSObject data = new JSObject();
        data.put("filePath", filePath);
        data.put("durationMs", durationMs);
        data.put("width", width);
        data.put("height", height);

        if (pendingStopCall != null) {
            pendingStopCall.resolve(data);
            pendingStopCall = null;
        }

        // Also carried on the event: the user may have stopped from the floating
        // bubble directly, with no pending stopRecording() call to resolve.
        JSObject event = stateEvent("stopped");
        event.put("filePath", filePath);
        event.put("durationMs", durationMs);
        event.put("width", width);
        event.put("height", height);
        notifyListeners("recordingStateChanged", event);
    }

    @Override
    public void onError(String message) {
        if (pendingStartCall != null) {
            pendingStartCall.reject(message);
            pendingStartCall = null;
        }
        if (pendingStopCall != null) {
            pendingStopCall.reject(message);
            pendingStopCall = null;
        }
        JSObject data = stateEvent("error");
        data.put("message", message);
        notifyListeners("recordingStateChanged", data);
    }

    private JSObject stateEvent(String state) {
        JSObject data = new JSObject();
        data.put("state", state);
        return data;
    }
}
