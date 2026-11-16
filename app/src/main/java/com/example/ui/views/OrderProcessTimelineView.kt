package com.example.ui.views

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.View
import com.example.model.OrderStatus

class OrderProcessTimelineView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var currentStatus: OrderStatus = OrderStatus.DELIVERING
    private val density = resources.displayMetrics.density
    private val sp = resources.displayMetrics.scaledDensity

    private val trackGray = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E2E8F0")
        strokeWidth = 3f * density
        strokeCap = Paint.Cap.ROUND
    }

    private val trackActive = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2563EB")
        strokeWidth = 3f * density
        strokeCap = Paint.Cap.ROUND
    }

    private val circleFill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val checkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 10f * sp
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val stepLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 10.5f * sp
        textAlign = Paint.Align.CENTER
    }

    fun setStatus(status: OrderStatus) {
        currentStatus = status
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (width == 0 || height == 0) return

        val steps = if (currentStatus == OrderStatus.CANCELLED) {
            listOf("Đặt hàng", "Xác nhận", "Đã huỷ")
        } else {
            listOf("Đặt hàng", "Đóng gói", "Đang giao", "Hoàn tất")
        }

        val activeStepIndex = when (currentStatus) {
            OrderStatus.PLACED -> 0
            OrderStatus.DELIVERING -> 2
            OrderStatus.DELIVERED -> 3
            OrderStatus.CANCELLED -> 2
        }

        val activeColor = when (currentStatus) {
            OrderStatus.PLACED -> Color.parseColor("#2563EB")
            OrderStatus.DELIVERING -> Color.parseColor("#EA8C00")
            OrderStatus.DELIVERED -> Color.parseColor("#059669")
            OrderStatus.CANCELLED -> Color.parseColor("#DC2626")
        }

        trackActive.color = activeColor
        val padX = 36f * density
        val usableW = (width - padX * 2).coerceAtLeast(1f)
        val stepW = usableW / (steps.size - 1).coerceAtLeast(1)
        val cy = 22f * density
        val radius = 11f * density

        val startX = padX
        val endX = padX + usableW
        val activeEndX = padX + stepW * activeStepIndex

        canvas.drawLine(startX, cy, endX, cy, trackGray)
        canvas.drawLine(startX, cy, activeEndX, cy, trackActive)

        steps.forEachIndexed { index, label ->
            val cx = padX + stepW * index
            val isCompletedOrCurrent = index <= activeStepIndex
            if (isCompletedOrCurrent) {
                circleFill.color = activeColor
                canvas.drawCircle(cx, cy, radius, circleFill)
                val symbol = if (currentStatus == OrderStatus.CANCELLED && index == 2) "✕" else "✓"
                canvas.drawText(symbol, cx, cy + 3.5f * density, checkPaint)
                stepLabelPaint.color = Color.parseColor("#0F172A")
                stepLabelPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            } else {
                circleFill.color = Color.parseColor("#E2E8F0")
                canvas.drawCircle(cx, cy, radius, circleFill)
                stepLabelPaint.color = Color.parseColor("#94A3B8")
                stepLabelPaint.typeface = Typeface.DEFAULT
            }
            canvas.drawText(label, cx, cy + radius + 16f * density, stepLabelPaint)
        }
    }
}
