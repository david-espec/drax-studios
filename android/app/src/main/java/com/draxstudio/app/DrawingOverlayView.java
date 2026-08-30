package com.draxstudio.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

/**
 * Full-screen overlay the "Lápis" tool draws onto. Unlike the bubble/toolbar
 * (chrome for the person recording), this view's content is not excluded
 * from the MediaProjection capture, so strokes drawn here show up in the
 * final recording — that's the whole point of an in-recording annotation
 * tool, as opposed to a note only the presenter can see.
 */
public class DrawingOverlayView extends View {

    public enum Tool { PEN, ERASER }

    private Tool tool = Tool.PEN;
    private int color = Color.parseColor("#FF3B30");
    private float strokeWidthPx;

    private Bitmap bitmap;
    private Canvas bitmapCanvas;
    private final Paint bitmapPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint livePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private Path livePath;

    public DrawingOverlayView(Context context, AttributeSet attrs) {
        super(context, attrs);
        strokeWidthPx = dp(8);
        bitmapPaint.setStyle(Paint.Style.STROKE);
        bitmapPaint.setStrokeJoin(Paint.Join.ROUND);
        bitmapPaint.setStrokeCap(Paint.Cap.ROUND);
        livePaint.setStyle(Paint.Style.STROKE);
        livePaint.setStrokeJoin(Paint.Join.ROUND);
        livePaint.setStrokeCap(Paint.Cap.ROUND);
        updateLivePaint();
    }

    public void setTool(Tool tool) {
        this.tool = tool;
        updateLivePaint();
    }

    public void setColor(int color) {
        this.color = color;
        updateLivePaint();
    }

    public void setStrokeWidthDp(float dp) {
        strokeWidthPx = dp(dp);
        updateLivePaint();
    }

    private void updateLivePaint() {
        if (tool == Tool.ERASER) {
            livePaint.setColor(Color.BLACK);
            livePaint.setStrokeWidth(strokeWidthPx * 2.5f);
            livePaint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        } else {
            livePaint.setColor(color);
            livePaint.setStrokeWidth(strokeWidthPx);
            livePaint.setXfermode(null);
        }
    }

    public void clearAll() {
        if (bitmap != null) {
            bitmap.eraseColor(Color.TRANSPARENT);
        }
        invalidate();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        if (w > 0 && h > 0) {
            Bitmap previous = bitmap;
            bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            bitmapCanvas = new Canvas(bitmap);
            if (previous != null) {
                bitmapCanvas.drawBitmap(previous, 0, 0, null);
                previous.recycle();
            }
        }
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        float x = event.getX();
        float y = event.getY();
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                livePath = new Path();
                livePath.moveTo(x, y);
                return true;
            case MotionEvent.ACTION_MOVE:
                if (livePath != null) {
                    livePath.lineTo(x, y);
                    invalidate();
                }
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                if (livePath != null && bitmapCanvas != null) {
                    updateLivePaint();
                    bitmapCanvas.drawPath(livePath, livePaint);
                    livePath = null;
                    invalidate();
                }
                return true;
            default:
                return false;
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (bitmap != null) {
            canvas.drawBitmap(bitmap, 0, 0, null);
        }
        if (livePath != null && tool == Tool.PEN) {
            canvas.drawPath(livePath, livePaint);
        }
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}
