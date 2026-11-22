package com.example.api

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ApiHealth(
    @Json(name = "status") val status: String,
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class ApiOrderItem(
    @Json(name = "productName") val productName: String,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "unitPrice") val unitPrice: Long,
    @Json(name = "importPrice") val importPrice: Long? = null,
    @Json(name = "isDemoProduct") val isDemoProduct: Boolean? = null
)

@JsonClass(generateAdapter = true)
data class ApiOrder(
    @Json(name = "id") val id: String,
    @Json(name = "timeAgo") val timeAgo: String?,
    @Json(name = "customerName") val customerName: String,
    @Json(name = "customerPhone") val customerPhone: String,
    @Json(name = "address") val address: String,
    @Json(name = "status") val status: String,
    @Json(name = "items") val items: List<ApiOrderItem>,
    @Json(name = "shippingFee") val shippingFee: Long,
    @Json(name = "paymentMethodLabel") val paymentMethodLabel: String,
    @Json(name = "paymentType") val paymentType: String,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "salesChannel") val salesChannel: String? = null,
    @Json(name = "vipTierAtPurchase") val vipTierAtPurchase: String? = null,
    @Json(name = "vipProductDiscount") val vipProductDiscount: Long? = null,
    @Json(name = "shippingDiscount") val shippingDiscount: Long? = null,
    @Json(name = "shippingCost") val shippingCost: Long? = null
)

@JsonClass(generateAdapter = true)
data class CreateOrderRequest(
    @Json(name = "customerName") val customerName: String,
    @Json(name = "customerPhone") val customerPhone: String,
    @Json(name = "address") val address: String,
    @Json(name = "productId") val productId: String,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "paymentType") val paymentType: String,
    @Json(name = "salesChannel") val salesChannel: String = "B2C"
)

@JsonClass(generateAdapter = true)
data class ApiProduct(
    @Json(name = "id") val id: String,
    @Json(name = "sku") val sku: String,
    @Json(name = "name") val name: String,
    @Json(name = "category") val category: String,
    @Json(name = "importPrice") val importPrice: Long? = null,
    @Json(name = "price") val price: Long,
    @Json(name = "stock") val stock: Int,
    @Json(name = "soldCount") val soldCount: Int,
    @Json(name = "isDemoProduct") val isDemoProduct: Boolean? = null,
    @Json(name = "imageResName") val imageResName: String?,
    @Json(name = "description") val description: String? = null,
    @Json(name = "imageUrl") val imageUrl: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateProductRequest(
    @Json(name = "name") val name: String,
    @Json(name = "category") val category: String,
    @Json(name = "importPrice") val importPrice: Long = 0L,
    @Json(name = "price") val price: Long,
    @Json(name = "stock") val stock: Int,
    @Json(name = "isDemoProduct") val isDemoProduct: Boolean = false,
    @Json(name = "description") val description: String = "",
    @Json(name = "imageUrl") val imageUrl: String = "",
    @Json(name = "imageResName") val imageResName: String = "",
    @Json(name = "sku") val sku: String = ""
)

@JsonClass(generateAdapter = true)
data class BulkCreateProductsRequest(
    @Json(name = "products") val products: List<CreateProductRequest>
)

@JsonClass(generateAdapter = true)
data class BulkImportError(
    @Json(name = "row") val row: Int = 0,
    @Json(name = "name") val name: String = "",
    @Json(name = "reason") val reason: String = ""
)

@JsonClass(generateAdapter = true)
data class BulkCreateProductsResponse(
    @Json(name = "insertedCount") val insertedCount: Int = 0,
    @Json(name = "skippedCount") val skippedCount: Int = 0,
    @Json(name = "errors") val errors: List<BulkImportError> = emptyList(),
    @Json(name = "products") val products: List<ApiProduct> = emptyList()
)

@JsonClass(generateAdapter = true)
data class RestockRequest(
    @Json(name = "amount") val amount: Int = 10
)

@JsonClass(generateAdapter = true)
data class ApiTransaction(
    @Json(name = "id") val id: String,
    @Json(name = "orderCode") val orderCode: String,
    @Json(name = "methodTitle") val methodTitle: String,
    @Json(name = "subtitle") val subtitle: String,
    @Json(name = "amount") val amount: Long,
    @Json(name = "paymentType") val paymentType: String
)

@JsonClass(generateAdapter = true)
data class ApiNotification(
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String,
    @Json(name = "message") val message: String,
    @Json(name = "timeAgo") val timeAgo: String?,
    @Json(name = "isAlert") val isAlert: Boolean?
)

@JsonClass(generateAdapter = true)
data class ApiCalendarDay(
    @Json(name = "dayNumber") val dayNumber: Int,
    @Json(name = "monthLabel") val monthLabel: String,
    @Json(name = "fullDateLabel") val fullDateLabel: String,
    @Json(name = "totalOrders") val totalOrders: Int,
    @Json(name = "deliveredOrders") val deliveredOrders: Int,
    @Json(name = "cancelledOrders") val cancelledOrders: Int,
    @Json(name = "isFuture") val isFuture: Boolean? = null
)

@JsonClass(generateAdapter = true)
data class ApiDashboardKpis(
    @Json(name = "placedCount") val placedCount: Int,
    @Json(name = "preparingCount") val preparingCount: Int? = 0,
    @Json(name = "deliveringCount") val deliveringCount: Int,
    @Json(name = "deliveredCount") val deliveredCount: Int,
    @Json(name = "cancelledCount") val cancelledCount: Int
)
