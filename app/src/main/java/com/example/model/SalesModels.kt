package com.example.model

import androidx.annotation.DrawableRes
import java.text.NumberFormat
import java.util.Locale

enum class OrderStatus(val label: String) {
    PLACED("Khách đặt hàng"),
    PREPARING("Duyệt & Chuẩn bị"),
    DELIVERING("Giao cho ĐVVC"),
    DELIVERED("Đã đến tay khách"),
    CANCELLED("Đã huỷ")
}

enum class OrderFilter(val label: String) {
    ALL("Tất cả"),
    PLACED("Khách đặt"),
    PREPARING("Chuẩn bị hàng"),
    DELIVERING("Giao ĐVVC"),
    DELIVERED("Thành công"),
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

enum class IncomeChartMetric(val label: String) {
    REVENUE("Doanh thu"),
    PROFIT("Lợi nhuận")
}

/**
 * Sales channel: Business-to-Business (B2B) with building symbol vs Retail (B2C) with shopping symbol.
 */
enum class SalesChannel(val symbol: String, val label: String, val badgeText: String) {
    B2B("🏢", "Doanh nghiệp (B2B)", "🏢 B2B"),
    B2C("🛍️", "Bán lẻ (B2C)", "🛍️ B2C")
}

/**
 * VIP tier for customer representatives, determined by non-cancelled purchase frequency.
 * Shipping discount is always capped so the final shipping fee stays >= SHIPPING_BASE_COST.
 */
enum class VipTier(
    val badgeText: String,
    val label: String,
    val minOrders: Int,
    val demoDiscountPercent: Int,
    val shippingDiscountAmount: Long
) {
    STANDARD("Thường", "Khách thường", 0, 0, 0L),
    VIP_SILVER("⭐ VIP Bạc", "VIP Bạc", 2, 10, 5_000L),
    VIP_GOLD("👑 VIP Vàng", "VIP Vàng", 4, 15, 10_000L),
    VIP_DIAMOND("💎 VIP Kim Cương", "VIP Kim Cương", 6, 20, 15_000L);

    val isVip: Boolean get() = this != STANDARD

    companion object {
        const val STANDARD_SHIPPING_FEE = 30_000L
        const val SHIPPING_BASE_COST = 15_000L

        fun fromOrderCount(orderCount: Int): VipTier = when {
            orderCount >= VIP_DIAMOND.minOrders -> VIP_DIAMOND
            orderCount >= VIP_GOLD.minOrders -> VIP_GOLD
            orderCount >= VIP_SILVER.minOrders -> VIP_SILVER
            else -> STANDARD
        }

        fun calculatePricing(
            unitPrice: Long,
            importPrice: Long,
            quantity: Int,
            isDemoProduct: Boolean,
            existingOrderCount: Int,
            baseShippingFee: Long = STANDARD_SHIPPING_FEE
        ): VipPricingBreakdown {
            val tier = fromOrderCount(existingOrderCount)
            val subtotal = unitPrice * quantity
            val totalImportCost = importPrice.coerceAtLeast(0L) * quantity

            val vipProductDiscount = if (isDemoProduct && tier.demoDiscountPercent > 0) {
                val desired = (subtotal * tier.demoDiscountPercent) / 100L
                val maxSafe = if (totalImportCost > 0L) (subtotal - totalImportCost).coerceAtLeast(0L) else desired
                minOf(desired, maxSafe)
            } else {
                0L
            }

            // Cap shipping discount so finalShippingFee never drops below SHIPPING_BASE_COST
            val maxSafeShippingDiscount = (baseShippingFee - SHIPPING_BASE_COST).coerceAtLeast(0L)
            val shippingDiscount = minOf(tier.shippingDiscountAmount, maxSafeShippingDiscount)
            val finalShippingFee = baseShippingFee - shippingDiscount

            return VipPricingBreakdown(
                tier = tier,
                existingOrderCount = existingOrderCount,
                subtotal = subtotal,
                vipProductDiscount = vipProductDiscount,
                baseShippingFee = baseShippingFee,
                shippingDiscount = shippingDiscount,
                finalShippingFee = finalShippingFee,
                shippingCost = SHIPPING_BASE_COST,
                totalImportCost = totalImportCost
            )
        }
    }
}

data class VipPricingBreakdown(
    val tier: VipTier,
    val existingOrderCount: Int,
    val subtotal: Long,
    val vipProductDiscount: Long,
    val baseShippingFee: Long,
    val shippingDiscount: Long,
    val finalShippingFee: Long,
    val shippingCost: Long,
    val totalImportCost: Long
) {
    val totalPayment: Long
        get() = (subtotal - vipProductDiscount).coerceAtLeast(0L) + finalShippingFee

    val estimatedProfit: Long
        get() = totalPayment - totalImportCost - if (finalShippingFee > 0L) shippingCost else 0L
}

data class OrderItem(
    val productName: String,
    val quantity: Int,
    val unitPrice: Long,
    val importPrice: Long = 0L,
    val isDemoProduct: Boolean = false
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
    val createdAt: String = "",
    val salesChannel: SalesChannel = SalesChannel.B2C,
    val vipTierAtPurchase: VipTier = VipTier.STANDARD,
    val vipProductDiscount: Long = 0L,
    val shippingDiscount: Long = 0L,
    val shippingCost: Long = VipTier.SHIPPING_BASE_COST
) {
    val subtotal: Long
        get() = items.sumOf { it.unitPrice * it.quantity }

    val totalImportCost: Long
        get() = items.sumOf { it.importPrice * it.quantity }

    val total: Long
        get() = (subtotal - vipProductDiscount).coerceAtLeast(0L) + shippingFee

    val profit: Long
        get() = total - totalImportCost - if (shippingFee > 0L) shippingCost else 0L
}

data class Product(
    val id: String,
    val sku: String,
    val name: String,
    val category: String,
    val price: Long, // Export / selling price (Giá xuất)
    val stock: Int,
    val soldCount: Int,
    @DrawableRes val imageRes: Int,
    val description: String = "",
    val imageUrl: String = "",
    val importPrice: Long = 0L, // Import / cost price (Giá nhập)
    val isDemoProduct: Boolean = false
) {
    val exportPrice: Long get() = price
    val unitProfit: Long get() = price - importPrice
    val profitMarginPercent: Float
        get() = if (price > 0L) ((price - importPrice).toFloat() / price.toFloat()) * 100f else 0f

    /** True when inventory is depleted (stock <= 0) and new trades for this product are locked. */
    val isTradeLocked: Boolean get() = stock <= 0

    fun canFulfill(quantity: Int): Boolean = quantity > 0 && stock >= quantity
}

data class TradeLockStatus(
    val isLocked: Boolean,
    val productId: String,
    val productName: String,
    val availableStock: Int,
    val requestedQuantity: Int,
    val shortage: Int,
    val title: String = "",
    val message: String = ""
)

class InsufficientStockException(val lockStatus: TradeLockStatus) :
    IllegalStateException(lockStatus.message)

sealed class CreateOrderResult {
    data class Success(val order: Order) : CreateOrderResult()
    data class TradeLocked(val lockStatus: TradeLockStatus) : CreateOrderResult()
}

sealed class BackendCreateOrderResult {
    data class Success(val order: Order) : BackendCreateOrderResult()
    data class TradeLocked(val message: String) : BackendCreateOrderResult()
    object NetworkError : BackendCreateOrderResult()
}

data class BulkProductInput(
    val sku: String = "",
    val name: String,
    val category: String,
    val price: Long,
    val stock: Int,
    val description: String = "",
    val imageUrl: String = "",
    val importPrice: Long = 0L,
    val isDemoProduct: Boolean = false
)

data class BulkImportOutcome(
    val success: Boolean,
    val insertedCount: Int,
    val skippedCount: Int = 0,
    val savedOffline: Boolean = false,
    val message: String = "",
    val products: List<Product> = emptyList()
)

data class CalendarDaySummary(
    val dayNumber: Int,
    val monthLabel: String,
    val fullDate: String,
    val totalOrders: Int,
    val completedOrders: Int,
    val deliveringOrders: Int,
    val isFuture: Boolean = false
)

data class IncomeBarPoint(
    val label: String,
    val valueMillions: Float,
    val displayPill: String
)

data class ChannelSalesStats(
    val channel: SalesChannel,
    val orderCount: Int,
    val revenue: Long,
    val profit: Long,
    val sharePercent: Int
)

data class CustomerVipProfile(
    val customerName: String,
    val customerPhone: String,
    val primaryChannel: SalesChannel,
    val orderCount: Int,
    val deliveredCount: Int,
    val totalSpent: Long,
    val totalVipSavings: Long,
    val vipTier: VipTier
)

data class IncomePeriodData(
    val period: IncomePeriod,
    val metric: IncomeChartMetric = IncomeChartMetric.REVENUE,
    val heroLabel: String,
    val totalFormatted: String,
    val totalProfitFormatted: String = "0 VNĐ",
    val totalCostFormatted: String = "0đ",
    val profitMarginFormatted: String = "0%",
    val growthPercent: String,
    val codFormatted: String,
    val bankFormatted: String,
    val avgFormatted: String,
    val peakText: String,
    val maxAxisValue: Float,
    val bars: List<IncomeBarPoint>,
    /** Bar highlighted initially (the bucket containing today). */
    val defaultSelectedIndex: Int = 0,
    val b2bStats: ChannelSalesStats = ChannelSalesStats(SalesChannel.B2B, 0, 0L, 0L, 0),
    val b2cStats: ChannelSalesStats = ChannelSalesStats(SalesChannel.B2C, 0, 0L, 0L, 0),
    val totalVipSavingsFormatted: String = "0đ"
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
    private val vnLocale = Locale.forLanguageTag("vi-VN")
    private val numberFormat = NumberFormat.getInstance(vnLocale)

    fun formatVnd(amount: Long): String {
        return "${numberFormat.format(amount).replace(',', '.')}đ"
    }

    fun formatVndFull(amount: Long): String {
        return "${numberFormat.format(amount).replace(',', '.')} VNĐ"
    }
}

