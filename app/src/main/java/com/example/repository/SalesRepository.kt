package com.example.repository

import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.example.R
import com.example.api.ApiCalendarDay
import com.example.api.ApiNotification
import com.example.api.ApiOrder
import com.example.api.ApiProduct
import com.example.api.ApiTransaction
import com.example.api.CreateOrderRequest
import com.example.api.CreateProductRequest
import com.example.api.RestockRequest
import com.example.api.RetrofitClient
import com.example.model.CalendarDaySummary
import com.example.model.NotificationItem
import com.example.model.Order
import com.example.model.OrderItem
import com.example.model.OrderFilter
import com.example.model.OrderStatus
import com.example.model.PaymentTransaction
import com.example.model.PaymentType
import com.example.model.Product
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SalesRepository {

    private val api: com.example.api.ApiService
        get() = RetrofitClient.apiService

    private var lastToastTime = 0L

    private fun handleException(e: Exception) {
        e.printStackTrace()
        val now = System.currentTimeMillis()
        if (now - lastToastTime > 6000) {
            lastToastTime = now
            val currentUrl = RetrofitClient.getBaseUrl()
            val isEmulatorIp = currentUrl.contains("10.0.2.2")
            val msg = if (isEmulatorIp) {
                "⚠️ Điện thoại thật không kết nối được 10.0.2.2. Hãy vào Hồ sơ -> Cấu hình IP và chọn IP máy tính!"
            } else {
                "⚠️ Không thể kết nối Backend tại $currentUrl. Hãy kiểm tra backend (npm run dev) và Wi-Fi!"
            }
            Handler(Looper.getMainLooper()).post {
                try {
                    // Try to showToast if context available via handler
                } catch (_: Exception) {}
            }
        }
    }

    /**
     * Pings GET /api/health on the active URL; if unreachable, automatically probes
     * USB localhost (127.0.0.1:5000 via adb reverse) and LAN default URL, switching
     * to whichever responds first.
     */
    suspend fun checkBackendConnection(): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        var firstError = ""
        for ((index, candidateUrl) in RetrofitClient.candidateUrls().withIndex()) {
            try {
                val service = if (index == 0) api else RetrofitClient.createTempApiService(candidateUrl)
                val health = service.health()
                if (health.status == "OK") {
                    if (index > 0) {
                        RetrofitClient.switchActiveUrl(candidateUrl)
                    }
                    return@withContext true to (health.message ?: "OK")
                }
            } catch (e: Exception) {
                if (index == 0) {
                    firstError = e.message ?: e.javaClass.simpleName
                }
            }
        }
        false to firstError
    }

    suspend fun fetchOrders(filter: OrderFilter = OrderFilter.ALL, search: String = ""): List<Order>? = withContext(Dispatchers.IO) {
        try {
            val filterParam = if (filter != OrderFilter.ALL) filter.name else null
            val searchParam = if (search.isNotBlank()) search else null
            val apiOrders = api.getOrders(filterParam, searchParam)
            apiOrders.map { it.toDomain() }
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun createOrder(
        customerName: String,
        customerPhone: String,
        address: String,
        product: Product,
        quantity: Int,
        paymentType: PaymentType
    ): Order? = withContext(Dispatchers.IO) {
        try {
            val req = CreateOrderRequest(
                customerName = customerName,
                customerPhone = customerPhone,
                address = address,
                productId = product.id,
                quantity = quantity,
                paymentType = paymentType.name
            )
            val created = api.createOrder(req)
            created.toDomain()
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun advanceOrderStatus(orderId: String): Order? = withContext(Dispatchers.IO) {
        try {
            val updated = api.advanceOrderStatus(orderId)
            updated.toDomain()
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun updateOrderStatus(orderId: String, newStatus: OrderStatus): Order? = withContext(Dispatchers.IO) {
        try {
            val updated = api.updateOrderStatus(orderId, mapOf("status" to newStatus.name))
            updated.toDomain()
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun fetchProducts(category: String = "Tất cả", search: String = ""): List<Product>? = withContext(Dispatchers.IO) {
        try {
            val categoryParam = if (category != "Tất cả") category else null
            val searchParam = if (search.isNotBlank()) search else null
            val apiProducts = api.getProducts(categoryParam, searchParam)
            apiProducts.map { it.toDomain() }
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun createProduct(
        name: String,
        category: String,
        price: Long,
        stock: Int,
        description: String = "",
        imageUrl: String = ""
    ): Product? = withContext(Dispatchers.IO) {
        try {
            val req = CreateProductRequest(name, category, price, stock, description, imageUrl)
            val created = api.createProduct(req)
            created.toDomain()
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun createProductsBulk(items: List<com.example.model.BulkProductInput>): com.example.model.BulkImportOutcome = withContext(Dispatchers.IO) {
        if (items.isEmpty()) {
            return@withContext com.example.model.BulkImportOutcome(
                success = false,
                insertedCount = 0,
                message = "Danh sách sản phẩm trống"
            )
        }
        try {
            val requests = items.map { item ->
                CreateProductRequest(
                    name = item.name,
                    category = item.category,
                    price = item.price,
                    stock = item.stock,
                    description = item.description,
                    imageUrl = item.imageUrl,
                    sku = item.sku
                )
            }
            val response = api.bulkCreateProducts(com.example.api.BulkCreateProductsRequest(requests))
            val domainProducts = response.products.map { it.toDomain() }
            com.example.model.BulkImportOutcome(
                success = true,
                insertedCount = response.insertedCount,
                skippedCount = response.skippedCount,
                savedOffline = false,
                message = "Đã lưu ${response.insertedCount} sản phẩm vào MongoDB",
                products = domainProducts
            )
        } catch (e: Exception) {
            handleException(e)
            com.example.model.BulkImportOutcome(
                success = false,
                insertedCount = 0,
                savedOffline = true,
                message = e.message ?: "Không kết nối được Backend"
            )
        }
    }

    suspend fun updateProduct(
        productId: String,
        name: String,
        category: String,
        price: Long,
        stock: Int,
        description: String,
        imageUrl: String
    ): Product? = withContext(Dispatchers.IO) {
        try {
            val req = CreateProductRequest(name, category, price, stock, description, imageUrl)
            val updated = api.updateProduct(productId, req)
            updated.toDomain()
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun restockProduct(productId: String, amount: Int = 10): Product? = withContext(Dispatchers.IO) {
        try {
            val updated = api.restockProduct(productId, RestockRequest(amount))
            updated.toDomain()
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun deleteProduct(productId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val res = api.deleteProduct(productId)
            res.isSuccessful
        } catch (e: Exception) {
            handleException(e)
            false
        }
    }

    suspend fun fetchTransactions(type: PaymentType = PaymentType.ALL): List<PaymentTransaction>? = withContext(Dispatchers.IO) {
        try {
            val typeParam = if (type != PaymentType.ALL) type.name else null
            val list = api.getTransactions(typeParam)
            list.map { it.toDomain() }
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun fetchNotifications(): List<NotificationItem>? = withContext(Dispatchers.IO) {
        try {
            val list = api.getNotifications()
            list.map { it.toDomain() }
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    suspend fun fetchCalendarDays(): List<CalendarDaySummary>? = withContext(Dispatchers.IO) {
        try {
            val list = api.getCalendarDays()
            list.map { it.toDomain() }
        } catch (e: Exception) {
            handleException(e)
            null
        }
    }

    // --- MAPPERS ---

    private fun ApiOrder.toDomain(): Order {
        val domainStatus = try { OrderStatus.valueOf(status) } catch (_: Exception) { OrderStatus.PLACED }
        val domainPaymentType = try { PaymentType.valueOf(paymentType) } catch (_: Exception) { PaymentType.COD }
        return Order(
            id = id,
            timeAgo = timeAgo ?: "17/11/2026",
            customerName = customerName,
            customerPhone = customerPhone,
            address = address,
            status = domainStatus,
            items = items.map { OrderItem(it.productName, it.quantity, it.unitPrice) },
            shippingFee = shippingFee,
            paymentMethodLabel = paymentMethodLabel,
            paymentType = domainPaymentType,
            createdAt = createdAt ?: ""
        )
    }

    private fun ApiProduct.toDomain(): Product {
        val resId = if (imageResName == "img_product_tshirt") R.drawable.img_product_tshirt else R.drawable.img_product_electronics
        return Product(
            id = id,
            sku = sku,
            name = name,
            category = category,
            price = price,
            stock = stock,
            soldCount = soldCount,
            imageRes = resId,
            description = description ?: "",
            imageUrl = imageUrl ?: ""
        )
    }

    private fun ApiTransaction.toDomain(): PaymentTransaction {
        val pType = try { PaymentType.valueOf(paymentType) } catch (_: Exception) { PaymentType.COD }
        return PaymentTransaction(
            id = id,
            orderCode = orderCode,
            methodTitle = methodTitle,
            subtitle = subtitle,
            amount = amount,
            paymentType = pType
        )
    }

    private fun ApiNotification.toDomain(): NotificationItem {
        return NotificationItem(
            id = id,
            title = title,
            message = message,
            timeAgo = timeAgo ?: "17/11/2026",
            isAlert = isAlert ?: false
        )
    }

    private fun ApiCalendarDay.toDomain(): CalendarDaySummary {
        return CalendarDaySummary(
            dayNumber = dayNumber,
            monthLabel = monthLabel,
            fullDate = fullDateLabel,
            totalOrders = totalOrders,
            completedOrders = deliveredOrders,
            deliveringOrders = cancelledOrders,
            isFuture = isFuture ?: (dayNumber > 17)
        )
    }
}
