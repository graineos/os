package fr.angelbeta.movies;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;

/**
 * Pointeur virtuel dessiné au-dessus de la page : à la télécommande, les flèches le déplacent
 * et OK « touche » l'écran à sa position. Indispensable pour les lecteurs intégrés d'autres sites
 * (fenêtres de pub, choix de source), que la navigation aux flèches ne peut pas atteindre.
 */
public class CursorView extends View {
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float radius;
    float x = -1, y = -1;
    boolean pressed;

    public CursorView(Context context) {
        super(context);
        radius = 11 * getResources().getDisplayMetrics().density;
        fill.setColor(Color.WHITE);
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeWidth(3 * getResources().getDisplayMetrics().density);
        ring.setColor(Color.parseColor("#E50914"));
        setWillNotDraw(false);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        if (x < 0) { x = getWidth() / 2f; y = getHeight() / 2f; }
        float r = pressed ? radius * 0.75f : radius;
        fill.setShadowLayer(6, 0, 2, Color.argb(160, 0, 0, 0));
        canvas.drawCircle(x, y, r, fill);
        canvas.drawCircle(x, y, r + ring.getStrokeWidth(), ring);
    }
}
