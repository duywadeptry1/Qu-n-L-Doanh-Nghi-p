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
    private var isProfitTheme: Boolean = false

    private var activeBarColor: Int = Color.parseColor("#2563EB")
    private var activeSelectedBarColor: Int = Color.parseColor("#1D4ED8")
    private var outsidePillTextColor: Int = Color.parseColor("#1D4ED8")
    private var selectedXLabelColor: Int = Color.parseColor("#2563EB")

    private val defaultXLabelColor = Color.parseColor("#64748B")
    private val pillInsideTextColor = Color.WHITE

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
        color = defaultXLabelColor
        textSize = 11.5f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = activeBarColor
        style = Paint.Style.FILL
    }

    private val selectedBarPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = activeSelectedBarColor
        style = Paint.Style.FILL
    }

    private val valueTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = pillInsideTextColor
        textSize = 9.5f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val barRects = mutableListOf<RectF>()
    private val currentBarRect = RectF()
    private val barPath = Path()

    var onBarSelected: ((index: Int, item: IncomeBarPoint) -> Unit)? = null

    fun setData(
        points: List<IncomeBarPoint>,
        maxVal: Float,
        initialSelection: Int = 0,
        profitMode: Boolean = false
    ) {
        bars = points
        maxAxisValue = maxVal.coerceAtLeast(1f)
        selectedIndex = initialSelection.coerceIn(0, (points.size - 1).coerceAtLeast(0))
        updateThemeColors(profitMode)

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

        if (points.isNotEmpty()) {
            onBarSelected?.invoke(selectedIndex, points[selectedIndex])
        }
    }

    private fun updateThemeColors(profitMode: Boolean) {
        isProfitTheme = profitMode
        if (profitMode) {
            activeBarColor = Color.parseColor("#10B981")
            activeSelectedBarColor = Color.parseColor("#059669")
            outsidePillTextColor = Color.parseColor("#059669")
            selectedXLabelColor = Color.parseColor("#059669")
        } else {
            activeBarColor = Color.parseColor("#2563EB")
            activeSelectedBarColor = Color.parseColor("#1D4ED8")
            outsidePillTextColor = Color.parseColor("#1D4ED8")
            selectedXLabelColor = Color.parseColor("#2563EB")
        }
        barPaint.color = activeBarColor
        selectedBarPaint.color = activeSelectedBarColor
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (bars.isEmpty() || width == 0 || height == 0) return

        val leftPad = paddingLeft + 30f * density
        val rightPad = paddingRight + 10f * density
        val topPad = paddingTop + 14f * density
        val bottomPad = paddingBottom + 28f * density

        val chartW = (width - leftPad - rightPad).coerceAtLeast(1f)
        val chartH = (height - topPad - bottomPad).coerceAtLeast(1f)
        val chartRight = width - rightPad
        val chartBottom = topPad + chartH

        // Vẽ lưới ngang và nhãn trục tung
        val steps = if (maxAxisValue <= 10f) 9 else 5
        for (i in 0..steps) {
            val ratio = i.toFloat() / steps
            val y = chartBottom - ratio * chartH
            canvas.drawLine(leftPad, y, chartRight, y, gridPaint)

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
        val radii = floatArrayOf(
            cornerRadius, cornerRadius,
            cornerRadius, cornerRadius,
            0f, 0f,
            0f, 0f
        )

        val minInsideBarHeight = 26f * density

        bars.forEachIndexed { index, point ->
            val centerX = leftPad + slotW * index + slotW / 2f
            val ratio = if (point.valueMillions <= 0f) {
                0.025f
            } else {
                (point.valueMillions / maxAxisValue).coerceIn(0.06f, 1f)
            }
            val targetH = ratio * chartH * animProgress
            val topY = chartBottom - targetH

            currentBarRect.set(
                centerX - barW / 2f,
                topY,
                centerX + barW / 2f,
                chartBottom
            )
            barRects.add(RectF(centerX - slotW / 2f, topPad, centerX + slotW / 2f, chartBottom))

            barPath.reset()
            barPath.addRoundRect(currentBarRect, radii, Path.Direction.CW)

            val isSelected = index == selectedIndex
            canvas.drawPath(barPath, if (isSelected) selectedBarPaint else barPaint)

            if (isSelected && animProgress > 0.6f) {
                val labelY = (topY - 6f * density).coerceAtLeast(topPad + 10f * density)
                valueTextPaint.color = outsidePillTextColor
                canvas.drawText(point.displayPill, centerX, labelY, valueTextPaint)
            }

            xLabelPaint.color = if (isSelected) selectedXLabelColor else defaultXLabelColor
            canvas.drawText(point.label, centerX, height - paddingBottom - 6f * density, xLabelPaint)
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
                onBarSelected?.invoke(hitIndex, bars[hitIndex])
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