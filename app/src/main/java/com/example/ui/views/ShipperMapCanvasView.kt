package com.example.ui.views

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator

class ShipperMapCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var shipperProgress = 0.62f
    private var pulseFraction = 0f
    private var pulseAnimator: ValueAnimator? = null
    private var routeAnimator: ValueAnimator? = null

    private val density = resources.displayMetrics.density
    private val sp = resources.displayMetrics.scaledDensity

    private val mapBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#EEF4FA")
        style = Paint.Style.FILL
    }

    private val blockPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E2EBF5")
        style = Paint.Style.FILL
    }

    private val canalPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#BAE6FD")
        strokeWidth = 10f * density
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }

    private val roadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 8f * density
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }

    private val routeDashedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#94A3B8")
        strokeWidth = 3.5f * density
        style = Paint.Style.STROKE
        pathEffect = DashPathEffect(floatArrayOf(12f, 8f), 0f)
    }

    private val routeDonePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2563EB")
        strokeWidth = 4.5f * density
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }

    private val streetTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#64748B")
        textSize = 10f * sp
    }

    private val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pulsePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#44EA8C00")
        style = Paint.Style.FILL
    }

    private val badgeBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#0F172A")
        style = Paint.Style.FILL
    }

    private val badgeTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 10.5f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val clipPath = Path()

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        pulseAnimator?.cancel()
        pulseAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1400L
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener {
                pulseFraction = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onDetachedFromWindow() {
        pulseAnimator?.cancel()
        routeAnimator?.cancel()
        super.onDetachedFromWindow()
    }

    fun simulateMovement(onProgressChanged: ((Float) -> Unit)? = null) {
        routeAnimator?.cancel()
        val start = if (shipperProgress >= 0.96f) 0.15f else shipperProgress
        routeAnimator = ValueAnimator.ofFloat(start, 0.98f).apply {
            duration = 3200L
            interpolator = LinearInterpolator()
            addUpdateListener {
                shipperProgress = it.animatedValue as Float
                onProgressChanged?.invoke(shipperProgress)
                invalidate()
            }
            start()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (width == 0 || height == 0) return

        val w = width.toFloat()
        val h = height.toFloat()
        val rect = RectF(0f, 0f, w, h)

        clipPath.reset()
        clipPath.addRoundRect(rect, 18f * density, 18f * density, Path.Direction.CW)
        canvas.save()
        canvas.clipPath(clipPath)

        // Base map
        canvas.drawRect(rect, mapBgPaint)

        // City blocks
        canvas.drawRoundRect(RectF(w * 0.06f, h * 0.1f, w * 0.34f, h * 0.38f), 10f, 10f, blockPaint)
        canvas.drawRoundRect(RectF(w * 0.42f, h * 0.14f, w * 0.85f, h * 0.44f), 10f, 10f, blockPaint)
        canvas.drawRoundRect(RectF(w * 0.12f, h * 0.54f, w * 0.56f, h * 0.86f), 10f, 10f, blockPaint)
        canvas.drawRoundRect(RectF(w * 0.65f, h * 0.56f, w * 0.92f, h * 0.88f), 10f, 10f, blockPaint)

        // Canal curve
        val canal = Path().apply {
            moveTo(0f, h * 0.48f)
            quadTo(w * 0.48f, h * 0.36f, w, h * 0.52f)
        }
        canvas.drawPath(canal, canalPaint)

        // Major roads
        canvas.drawLine(w * 0.15f, 0f, w * 0.25f, h, roadPaint)
        canvas.drawLine(w * 0.58f, 0f, w * 0.62f, h, roadPaint)
        canvas.drawLine(0f, h * 0.28f, w, h * 0.32f, roadPaint)
        canvas.drawLine(0f, h * 0.72f, w, h * 0.68f, roadPaint)

        // Street labels
        canvas.drawText("Nguyễn Huệ (Q.1)", w * 0.08f, h * 0.78f, streetTextPaint)
        canvas.drawText("Võ Văn Tần", w * 0.38f, h * 0.54f, streetTextPaint)
        canvas.drawText("Lê Văn Sỹ (Q.3)", w * 0.62f, h * 0.22f, streetTextPaint)

        // Route points: Warehouse -> Midpoint -> Customer
        val p0 = PointF(w * 0.18f, h * 0.76f)
        val p1 = PointF(w * 0.45f, h * 0.52f)
        val p2 = PointF(w * 0.78f, h * 0.26f)

        val fullPath = Path().apply {
            moveTo(p0.x, p0.y)
            lineTo(p1.x, p1.y)
            lineTo(p2.x, p2.y)
        }
        canvas.drawPath(fullPath, routeDashedPaint)

        // Shipper current position along polyline
        val shipperPos = if (shipperProgress <= 0.5f) {
            val t = shipperProgress / 0.5f
            PointF(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t)
        } else {
            val t = (shipperProgress - 0.5f) / 0.5f
            PointF(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t)
        }

        val donePath = Path().apply {
            moveTo(p0.x, p0.y)
            if (shipperProgress > 0.5f) {
                lineTo(p1.x, p1.y)
            }
            lineTo(shipperPos.x, shipperPos.y)
        }
        canvas.drawPath(donePath, routeDonePaint)

        // Warehouse marker
        markerPaint.color = Color.parseColor("#2563EB")
        canvas.drawCircle(p0.x, p0.y, 9f * density, markerPaint)
        markerPaint.color = Color.WHITE
        canvas.drawCircle(p0.x, p0.y, 4f * density, markerPaint)
        drawTag(canvas, "Kho Viễn Đông", p0.x + 12f * density, p0.y + 22f * density)

        // Customer destination marker
        markerPaint.color = Color.parseColor("#E11D48")
        canvas.drawCircle(p2.x, p2.y, 9f * density, markerPaint)
        markerPaint.color = Color.WHITE
        canvas.drawCircle(p2.x, p2.y, 4f * density, markerPaint)
        drawTag(canvas, "Khách nhận", p2.x - 10f * density, p2.y - 16f * density)

        // Pulsing Shipper marker
        val pulseRadius = (12f + 16f * pulseFraction) * density
        pulsePaint.alpha = ((1f - pulseFraction) * 140).toInt()
        canvas.drawCircle(shipperPos.x, shipperPos.y, pulseRadius, pulsePaint)

        markerPaint.color = Color.parseColor("#EA8C00")
        canvas.drawCircle(shipperPos.x, shipperPos.y, 11f * density, markerPaint)
        markerPaint.color = Color.WHITE
        canvas.drawCircle(shipperPos.x, shipperPos.y, 4.5f * density, markerPaint)
        drawTag(canvas, "Shipper", shipperPos.x, shipperPos.y - 18f * density)

        canvas.restore()
    }

    private fun drawTag(canvas: Canvas, text: String, cx: Float, cy: Float) {
        val textW = badgeTextPaint.measureText(text)
        val padH = 8f * density
        val rect = RectF(
            cx - textW / 2f - padH,
            cy - 12f * density,
            cx + textW / 2f + padH,
            cy + 6f * density
        )
        canvas.drawRoundRect(rect, 8f * density, 8f * density, badgeBgPaint)
        canvas.drawText(text, cx, cy, badgeTextPaint)
    }
}
