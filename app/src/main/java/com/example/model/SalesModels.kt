package com.example.model

import androidx.annotation.DrawableRes
import java.text.NumberFormat
import java.util.Locale

enum class OrderStatus(val label: String) {
    PLACED("Đã đặt"),
    DELIVERING("Đang giao"),
    DELIVERED("Đã giao"),
    CANCELLED("Đã huỷ")
}

enum class OrderFilter(val label: String) {
    ALL("Tất cả"),
    PLACED("Mới đặt"),
    DELIVERING("Đang giao"),
    DELIVERED("Đã giao"),
    CANCELLED("Đã huỷ")
}

enum class PaymentType(val label: String) {
    ALL("Tất cả"),
    COD("COD"),
    BANK("Chuyển khoản"),
    WALLET("Ví MoMo")
}

enum class IncomePeriod(val label: String) {
    WEEK("Tuần"),
    MONTH("Tháng"),
    YEAR("Năm")
}

data class OrderItem(
    val productName: String,
    val quantity: Int,
    val unitPrice: Long
)

data class Order(
    val id: String,
    val timeAgo: String,
    val customerName: String,
    val customerPhone: String,
    val address: String,
    val status: OrderStatus,
    val items: List<OrderItem>,
    val shippingFee: Long,
    val paymentMethodLabel: String,
    val paymentType: PaymentType,
    val shipperName: String = "Trần Minh Quân",
    val shipperPlate: String = "59-D2 482.19",
    val etaMinutes: Int = 12,
    val distanceKm: Double = 2.4
) {
    val subtotal: Long
        get() = items.sumOf { it.unitPrice * it.quantity }

    val total: Long
        get() = subtotal + shippingFee
}

data class Product(
    val id: String,
    val sku: String,
    val name: String,
    val category: String,
    val price: Long,
    val stock: Int,
    val soldCount: Int,
    @DrawableRes val imageRes: Int,
    val description: String = "",
    val imageUrl: String = ""
)

data class CalendarDaySummary(
    val dayNumber: Int,
    val monthLabel: String,
    val fullDate: String,
    val totalOrders: Int,
    val completedOrders: Int,
    val deliveringOrders: Int
)

data class IncomeBarPoint(
    val label: String,
    val valueMillions: Float,
    val displayPill: String
)

data class IncomePeriodData(
    val period: IncomePeriod,
    val heroLabel: String,
    val totalFormatted: String,
    val growthPercent: String,
    val codFormatted: String,
    val bankFormatted: String,
    val avgFormatted: String,
    val peakText: String,
    val maxAxisValue: Float,
    val bars: List<IncomeBarPoint>
)

data class PaymentTransaction(
    val id: String,
    val orderCode: String,
    val methodTitle: String,
    val subtitle: String,
    val amount: Long,
    val paymentType: PaymentType
)

data class NotificationItem(
    val id: String,
    val title: String,
    val message: String,
    val timeAgo: String,
    val isAlert: Boolean = false
)

object CurrencyFormatter {
    private val vnLocale = Locale("vi", "VN")
    private val numberFormat = NumberFormat.getInstance(vnLocale)

    fun formatVnd(amount: Long): String {
        return "${numberFormat.format(amount).replace(',', '.')}đ"
    }

    fun formatVndFull(amount: Long): String {
        return "${numberFormat.format(amount).replace(',', '.')} VNĐ"
    }
}
