package com.example.ui.views

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import android.view.animation.DecelerateInterpolator
import com.example.model.IncomeBarPoint

class IncomeBarChartView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var bars: List<IncomeBarPoint> = emptyList()
    private var maxAxisValue: Float = 9f
    private var selectedIndex: Int = 0
    private var animProgress: Float = 1f
    private var animator: ValueAnimator? = null

    private val density = resources.displayMetrics.density
    private val sp = resources.displayMetrics.scaledDensity

    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E2E8F0")
        strokeWidth = 1f * density
    }

    private val axisTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#94A3B8")
        textSize = 11f * sp
        textAlign = Paint.Align.RIGHT
    }

    private val xLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#64748B")
        textSize = 11.5f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2563EB")
        style = Paint.Style.FILL
    }

    private val selectedBarPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#1D4ED8")
        style = Paint.Style.FILL
    }

    private val valueTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 9.5f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val barRects = mutableListOf<RectF>()

    fun setData(points: List<IncomeBarPoint>, maxVal: Float, initialSelection: Int = 0) {
        bars = points
        maxAxisValue = maxVal.coerceAtLeast(1f)
        selectedIndex = initialSelection.coerceIn(0, (points.size - 1).coerceAtLeast(0))
        animator?.cancel()
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 420L
            interpolator = DecelerateInterpolator()
            addUpdateListener {
                animProgress = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (bars.isEmpty() || width == 0 || height == 0) return

        val leftPad = 30f * density
        val rightPad = 10f * density
        val topPad = 14f * density
        val bottomPad = 28f * density

        val chartW = (width - leftPad - rightPad).coerceAtLeast(1f)
        val chartH = (height - topPad - bottomPad).coerceAtLeast(1f)
        val chartBottom = topPad + chartH

        // Draw horizontal gridlines (5 or 10 steps)
        val steps = if (maxAxisValue <= 10f) 9 else 5
        for (i in 0..steps) {
            val ratio = i.toFloat() / steps
            val y = chartBottom - ratio * chartH
            canvas.drawLine(leftPad, y, width - rightPad, y, gridPaint)

            val tickVal = (maxAxisValue * ratio).toInt()
            canvas.drawText(
                tickVal.toString(),
                leftPad - 8f * density,
                y + 4f * density,
                axisTextPaint
            )
        }

        barRects.clear()
        val slotW = chartW / bars.size
        val barW = (slotW * 0.62f).coerceAtMost(38f * density)
        val cornerRadius = 8f * density

        bars.forEachIndexed { index, point ->
            val centerX = leftPad + slotW * index + slotW / 2f
            val ratio = (point.valueMillions / maxAxisValue).coerceIn(0.05f, 1f)
            val targetH = ratio * chartH * animProgress
            val topY = chartBottom - targetH
            val rect = RectF(
                centerX - barW / 2f,
                topY,
                centerX + barW / 2f,
                chartBottom
            )
            barRects.add(RectF(centerX - slotW / 2f, topPad, centerX + slotW / 2f, chartBottom))

            val path = Path().apply {
                addRoundRect(
                    rect,
                    floatArrayOf(
                        cornerRadius, cornerRadius,
                        cornerRadius, cornerRadius,
                        0f, 0f,
                        0f, 0f
                    ),
                    Path.Direction.CW
                )
            }
            val isSelected = index == selectedIndex
            canvas.drawPath(path, if (isSelected) selectedBarPaint else barPaint)

            if (isSelected && animProgress > 0.6f) {
                val labelY = if (targetH > 26f * density) {
                    topY + 15f * density
                } else {
                    (topY - 6f * density).coerceAtLeast(topPad + 10f * density)
                }
                if (targetH <= 26f * density) {
                    valueTextPaint.color = Color.parseColor("#1D4ED8")
                } else {
                    valueTextPaint.color = Color.WHITE
                }
                canvas.drawText(point.displayPill, centerX, labelY, valueTextPaint)
            }

            xLabelPaint.color = if (isSelected) {
                Color.parseColor("#2563EB")
            } else {
                Color.parseColor("#64748B")
            }
            canvas.drawText(point.label, centerX, height - 6f * density, xLabelPaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_DOWN) {
            val x = event.x
            val hitIndex = barRects.indexOfFirst { x >= it.left && x <= it.right }
            if (hitIndex >= 0 && hitIndex != selectedIndex) {
                selectedIndex = hitIndex
                invalidate()
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

    override fun onDetachedFromWindow() {
        animator?.cancel()
        super.onDetachedFromWindow()
    }
}
