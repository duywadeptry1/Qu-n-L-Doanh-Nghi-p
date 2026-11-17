package com.example.ui.views

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import android.view.animation.LinearInterpolator

class SalesPipelineView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    data class StageInfo(
        val title: String,
        val count: Int,
        val colorHex: String,
        val bgHex: String
    )

    private var stages: List<StageInfo> = listOf(
        StageInfo("Khách đặt", 0, "#2563EB", "#DBEAFE"),
        StageInfo("Chuẩn bị", 0, "#4F46E5", "#E0E7FF"),
        StageInfo("Giao ĐVVC", 0, "#D97706", "#FEF3C7"),
        StageInfo("Đã nhận", 0, "#059669", "#D1FAE5")
    )

    private var flowPhase = 0f
    private var animator: ValueAnimator? = null
    private var onStageClick: ((Int) -> Unit)? = null

    private val density = resources.displayMetrics.density
    private val sp = resources.displayMetrics.scaledDensity

    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E2E8F0")
        strokeWidth = 3f * density
        strokeCap = Paint.Cap.ROUND
    }

    private val activeTrackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#93C5FD")
        strokeWidth = 3f * density
        strokeCap = Paint.Cap.ROUND
    }

    private val pulseDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2563EB")
        style = Paint.Style.FILL
    }

    private val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f * density
    }

    private val numberPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 13f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#334155")
        textSize = 10.8f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#64748B")
        textSize = 10f * sp
        textAlign = Paint.Align.CENTER
    }

    private val nodeCentersX = mutableListOf<Float>()

    fun setStages(placed: Int, packing: Int, delivering: Int, settled: Int) {
        stages = listOf(
            StageInfo("Khách đặt", placed, "#2563EB", "#DBEAFE"),
            StageInfo("Chuẩn bị", packing, "#4F46E5", "#E0E7FF"),
            StageInfo("Giao ĐVVC", delivering, "#D97706", "#FEF3C7"),
            StageInfo("Đã nhận", settled, "#059669", "#D1FAE5")
        )
        invalidate()
    }

    fun setOnStageClickListener(listener: (Int) -> Unit) {
        onStageClick = listener
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        animator?.cancel()
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 2200L
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener {
                flowPhase = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onDetachedFromWindow() {
        animator?.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (width == 0 || height == 0 || stages.isEmpty()) return

        val padX = 36f * density
        val usableW = (width - padX * 2).coerceAtLeast(1f)
        val stepW = usableW / (stages.size - 1).coerceAtLeast(1)
        val centerY = 30f * density
        val radius = 19f * density

        nodeCentersX.clear()
        for (i in stages.indices) {
            nodeCentersX.add(padX + stepW * i)
        }

        val startX = nodeCentersX.first()
        val endX = nodeCentersX.last()
        canvas.drawLine(startX, centerY, endX, centerY, trackPaint)
        canvas.drawLine(startX, centerY, endX, centerY, activeTrackPaint)

        val dotX = startX + (endX - startX) * flowPhase
        canvas.drawCircle(dotX, centerY, 4.5f * density, pulseDotPaint)

        stages.forEachIndexed { index, stage ->
            val cx = nodeCentersX[index]
            circlePaint.color = Color.parseColor(stage.bgHex)
            ringPaint.color = Color.parseColor(stage.colorHex)
            numberPaint.color = Color.parseColor(stage.colorHex)

            canvas.drawCircle(cx, centerY, radius, circlePaint)
            canvas.drawCircle(cx, centerY, radius, ringPaint)
            canvas.drawText(stage.count.toString(), cx, centerY + 4.5f * density, numberPaint)

            canvas.drawText(stage.title, cx, centerY + radius + 18f * density, labelPaint)
            canvas.drawText("đơn", cx, centerY + radius + 31f * density, subPaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_DOWN) {
            val hit = nodeCentersX.indexOfFirst { kotlin.math.abs(event.x - it) < 36f * density }
            if (hit >= 0) {
                onStageClick?.invoke(hit)
                performClick()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }
}
