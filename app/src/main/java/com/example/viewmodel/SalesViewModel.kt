package com.example.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.R
import com.example.model.*
import com.example.repository.SalesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Date
import java.util.Locale

data class DashboardKpis(
    val placedCount: Int,
    val preparingCount: Int,
    val deliveringCount: Int,
    val deliveredCount: Int,
    val cancelledCount: Int
)

class SalesViewModel : ViewModel() {

    private val repository = SalesRepository()

    private val _orders = MutableStateFlow(seedOrders())
    val orders: StateFlow<List<Order>> = _orders.asStateFlow()

    private val _orderFilter = MutableStateFlow(OrderFilter.ALL)
    val orderFilter: StateFlow<OrderFilter> = _orderFilter.asStateFlow()

    private val _orderSearch = MutableStateFlow("")
    val orderSearch: StateFlow<String> = _orderSearch.asStateFlow()

    private val _products = MutableStateFlow(seedProducts())
    val products: StateFlow<List<Product>> = _products.asStateFlow()

    private val _productCategory = MutableStateFlow("Tất cả")
    val productCategory: StateFlow<String> = _productCategory.asStateFlow()

    private val _productSearch = MutableStateFlow("")
    val productSearch: StateFlow<String> = _productSearch.asStateFlow()

    private val _calendarDays = MutableStateFlow<List<CalendarDaySummary>>(emptyList())
    val calendarDays: StateFlow<List<CalendarDaySummary>> = _calendarDays.asStateFlow()

    private val _selectedDayNumber = MutableStateFlow(AppClock.todayDayOfMonth())
    val selectedDayNumber: StateFlow<Int> = _selectedDayNumber.asStateFlow()

    private val _incomePeriod = MutableStateFlow(IncomePeriod.WEEK)
    val incomePeriod: StateFlow<IncomePeriod> = _incomePeriod.asStateFlow()

    private val _incomeChartMetric = MutableStateFlow(IncomeChartMetric.REVENUE)
    val incomeChartMetric: StateFlow<IncomeChartMetric> = _incomeChartMetric.asStateFlow()

    private val _txTypeFilter = MutableStateFlow(PaymentType.ALL)
    val txTypeFilter: StateFlow<PaymentType> = _txTypeFilter.asStateFlow()

    private val _transactions = MutableStateFlow<List<PaymentTransaction>>(emptyList())
    val transactions: StateFlow<List<PaymentTransaction>> = _transactions.asStateFlow()

    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()

    private val _hasUnreadNotifications = MutableStateFlow(true)
    val hasUnreadNotifications: StateFlow<Boolean> = _hasUnreadNotifications.asStateFlow()

    init {
        recomputeDerivedData()
        loadDataFromBackend()
    }

    fun refreshBackendData() {
        loadDataFromBackend()
    }

    private fun loadDataFromBackend() {
        viewModelScope.launch {
            repository.checkBackendConnection()

            val backendOrders = repository.fetchOrders()
            if (backendOrders != null) {
                _orders.value = backendOrders
            }

            val backendProducts = repository.fetchProducts()
            if (backendProducts != null) {
                _products.value = backendProducts
            }

            recomputeDerivedData()

            val backendTx = repository.fetchTransactions()
            if (!backendTx.isNullOrEmpty()) {
                _transactions.value = backendTx
            }

            val backendNotifs = repository.fetchNotifications()
            if (!backendNotifs.isNullOrEmpty()) {
                _notifications.value = backendNotifs
            }

            val backendCalendar = repository.fetchCalendarDays()
            if (!backendCalendar.isNullOrEmpty() && backendCalendar.size >= 28) {
                _calendarDays.value = backendCalendar
            }
        }
    }

    private fun recomputeDerivedData() {
        val currentOrders = _orders.value
        val currentProducts = _products.value
        _calendarDays.value = buildMonthlyCalendarFromOrders(currentOrders)
        _transactions.value = buildTransactionsFromOrders(currentOrders)
        _notifications.value = buildNotificationsFromRealData(currentOrders, currentProducts)
    }

    /**
     * 100% real counts directly from actual orders (no artificial base offsets).
     */
    fun computeKpis(currentOrders: List<Order>): DashboardKpis {
        val placed = currentOrders.count { it.status == OrderStatus.PLACED }
        val preparing = currentOrders.count { it.status == OrderStatus.PREPARING }
        val delivering = currentOrders.count { it.status == OrderStatus.DELIVERING }
        val delivered = currentOrders.count { it.status == OrderStatus.DELIVERED }
        val cancelled = currentOrders.count { it.status == OrderStatus.CANCELLED }

        return DashboardKpis(
            placedCount = placed,
            preparingCount = preparing,
            deliveringCount = delivering,
            deliveredCount = delivered,
            cancelledCount = cancelled
        )
    }

    /**
     * Day of the current month (business time zone) the order was placed on,
     * or null if the order belongs to another month.
     */
    fun extractOrderDayOfMonth(order: Order): Int? {
        val day = AppClock.orderDay(order) ?: return null
        val today = AppClock.today()
        return if (day.year == today.year && day.month == today.month) day.day else null
    }

    fun getOrdersForDay(dayNumber: Int, allOrders: List<Order> = _orders.value): List<Order> {
        if (dayNumber > AppClock.todayDayOfMonth()) return emptyList()
        return allOrders.filter { extractOrderDayOfMonth(it) == dayNumber }
    }

    private fun buildMonthlyCalendarFromOrders(currentOrders: List<Order>): List<CalendarDaySummary> {
        val today = AppClock.today()
        val monthLabel = "Thg ${today.month}"
        return (1..AppClock.daysInCurrentMonth()).map { day ->
            val isFuture = day > today.day
            val dateStr = AppClock.formatDay(today.copy(day = day))
            if (isFuture) {
                CalendarDaySummary(
                    dayNumber = day,
                    monthLabel = monthLabel,
                    fullDate = "Ngày $dateStr (Chưa tới)",
                    totalOrders = 0,
                    completedOrders = 0,
                    deliveringOrders = 0,
                    isFuture = true
                )
            } else {
                val ordersOfDay = currentOrders.filter { extractOrderDayOfMonth(it) == day }
                val completed = ordersOfDay.count { it.status == OrderStatus.DELIVERED }
                val inProgress = ordersOfDay.count {
                    it.status == OrderStatus.PLACED ||
                        it.status == OrderStatus.PREPARING ||
                        it.status == OrderStatus.DELIVERING
                }
                val title = if (day == today.day) {
                    "Hôm nay, $dateStr"
                } else {
                    "Ngày $dateStr"
                }
                CalendarDaySummary(
                    dayNumber = day,
                    monthLabel = monthLabel,
                    fullDate = title,
                    totalOrders = ordersOfDay.size,
                    completedOrders = completed,
                    deliveringOrders = inProgress,
                    isFuture = false
                )
            }
        }
    }

    private fun buildTransactionsFromOrders(currentOrders: List<Order>): List<PaymentTransaction> {
        return currentOrders
            .filter { it.status == OrderStatus.DELIVERED }
            .map { order ->
                val dateStr = AppClock.orderDay(order)?.let { AppClock.formatDay(it) } ?: AppClock.formatDate()
                PaymentTransaction(
                    id = "tx-${order.id}",
                    orderCode = "#${order.id}",
                    methodTitle = "Đơn #${order.id} (${order.paymentType.label})",
                    subtitle = "$dateStr • Đã đến tay ${order.customerName}",
                    amount = order.total,
                    paymentType = order.paymentType
                )
            }
    }

    private fun buildNotificationsFromRealData(
        currentOrders: List<Order>,
        currentProducts: List<Product>
    ): List<NotificationItem> {
        val list = mutableListOf<NotificationItem>()

        val outOfStock = currentProducts.filter { it.isTradeLocked }
        if (outOfStock.isNotEmpty()) {
            val preview = outOfStock.take(3).joinToString(", ") { it.name }
            list.add(
                NotificationItem(
                    id = "notif-trade-locked",
                    title = "🔒 Đã khóa giao dịch (${outOfStock.size} mã hết hàng)",
                    message = "$preview đã hết tồn kho (tồn: 0). Giao dịch bị khóa cho tới khi nhập thêm hàng.",
                    timeAgo = AppClock.formatDate(),
                    isAlert = true
                )
            )
        }

        val lowStock = currentProducts.filter { it.stock in 1..10 }
        if (lowStock.isNotEmpty()) {
            val preview = lowStock.take(3).joinToString(", ") { "${it.name} (còn ${it.stock})" }
            list.add(
                NotificationItem(
                    id = "notif-low-stock",
                    title = "Cảnh báo tồn kho thấp (${lowStock.size} mã SP)",
                    message = "$preview cần nhập thêm hàng vào kho.",
                    timeAgo = AppClock.formatDate(),
                    isAlert = true
                )
            )
        }

        currentOrders.take(12).forEach { order ->
            val (title, msg, isAlert) = when (order.status) {
                OrderStatus.PLACED -> Triple(
                    "Đơn mới #${order.id} chờ duyệt",
                    "${order.customerName} vừa đặt hàng (${CurrencyFormatter.formatVnd(order.total)}). Cần duyệt đơn & chuẩn bị hàng.",
                    true
                )
                OrderStatus.PREPARING -> Triple(
                    "Đang chuẩn bị hàng #${order.id}",
                    "Đơn của ${order.customerName} đã được duyệt và đang đóng gói tại kho.",
                    false
                )
                OrderStatus.DELIVERING -> Triple(
                    "Đã giao ĐVVC đơn #${order.id}",
                    "Đơn hàng của ${order.customerName} đã bàn giao cho đơn vị vận chuyển.",
                    false
                )
                OrderStatus.DELIVERED -> Triple(
                    "Giao thành công #${order.id}",
                    "Đơn hàng đã đến tay ${order.customerName}. Đã ghi nhận thu nhập +${CurrencyFormatter.formatVnd(order.total)}.",
                    false
                )
                OrderStatus.CANCELLED -> Triple(
                    "Đơn hàng #${order.id} đã huỷ",
                    "Đơn của ${order.customerName} đã được xác nhận huỷ.",
                    true
                )
            }
            list.add(
                NotificationItem(
                    id = "notif-order-${order.id}",
                    title = title,
                    message = msg,
                    timeAgo = order.timeAgo,
                    isAlert = isAlert
                )
            )
        }
        return list
    }

    fun selectOrderFilter(filter: OrderFilter) {
        _orderFilter.value = filter
    }

    fun updateOrderSearch(query: String) {
        _orderSearch.value = query
    }

    fun selectProductCategory(category: String) {
        _productCategory.value = category
    }

    fun updateProductSearch(query: String) {
        _productSearch.value = query
    }

    fun selectCalendarDay(dayNumber: Int) {
        _selectedDayNumber.value = dayNumber
    }

    fun selectIncomePeriod(period: IncomePeriod) {
        _incomePeriod.value = period
    }

    fun selectIncomeChartMetric(metric: IncomeChartMetric) {
        _incomeChartMetric.value = metric
    }

    private fun normalizePhone(phone: String): String = phone.replace(Regex("\\s+"), "").trim()

    /**
     * Counts non-cancelled orders for a customer (matched by phone, falling back to name).
     */
    fun getCustomerOrderCount(
        customerPhone: String,
        customerName: String = "",
        currentOrders: List<Order> = _orders.value
    ): Int {
        val normPhone = normalizePhone(customerPhone)
        val normName = customerName.trim().lowercase(Locale.ROOT)
        if (normPhone.isEmpty() && normName.isEmpty()) return 0
        return currentOrders.count { order ->
            if (order.status == OrderStatus.CANCELLED) return@count false
            if (normPhone.isNotEmpty()) {
                normalizePhone(order.customerPhone) == normPhone
            } else {
                order.customerName.trim().lowercase(Locale.ROOT) == normName
            }
        }
    }

    /**
     * Live preview of VIP tier, demo product discount, and cost-floored shipping discount.
     */
    fun previewOrderPricing(
        customerPhone: String,
        customerName: String,
        product: Product,
        quantity: Int
    ): VipPricingBreakdown {
        val count = getCustomerOrderCount(customerPhone, customerName)
        val effectiveImport = if (product.importPrice > 0L) product.importPrice else (product.price * 70L) / 100L
        return VipTier.calculatePricing(
            unitPrice = product.price,
            importPrice = effectiveImport,
            quantity = quantity.coerceAtLeast(1),
            isDemoProduct = product.isDemoProduct,
            existingOrderCount = count
        )
    }

    /**
     * Builds customer/representative profiles ranked by purchase frequency for VIP tracking.
     */
    fun getCustomerProfiles(currentOrders: List<Order> = _orders.value): List<CustomerVipProfile> {
        val activeOrders = currentOrders.filter { it.status != OrderStatus.CANCELLED }
        val grouped = activeOrders.groupBy { order ->
            normalizePhone(order.customerPhone).ifEmpty { order.customerName.trim().lowercase(Locale.ROOT) }
        }
        return grouped.values.mapNotNull { ordersForCustomer ->
            val latest = ordersForCustomer.firstOrNull() ?: return@mapNotNull null
            val b2bCount = ordersForCustomer.count { it.salesChannel == SalesChannel.B2B }
            val primaryChannel = if (b2bCount >= ordersForCustomer.size - b2bCount && b2bCount > 0) {
                SalesChannel.B2B
            } else {
                SalesChannel.B2C
            }
            val count = ordersForCustomer.size
            CustomerVipProfile(
                customerName = latest.customerName,
                customerPhone = latest.customerPhone,
                primaryChannel = primaryChannel,
                orderCount = count,
                deliveredCount = ordersForCustomer.count { it.status == OrderStatus.DELIVERED },
                totalSpent = ordersForCustomer.sumOf { it.total },
                totalVipSavings = ordersForCustomer.sumOf { it.vipProductDiscount + it.shippingDiscount },
                vipTier = VipTier.fromOrderCount(count)
            )
        }.sortedWith(compareByDescending<CustomerVipProfile> { it.orderCount }.thenByDescending { it.totalSpent })
    }

    /**
     * Resolves an order's total cost (import cost of goods + shipping base cost),
     * with fallback lookup against the product catalog for older orders.
     */
    fun resolveOrderCost(order: Order, catalog: List<Product> = _products.value): Long {
        val goodsCost = order.items.sumOf { item ->
            val unitImport = when {
                item.importPrice > 0L -> item.importPrice
                else -> catalog.find { it.name.equals(item.productName, ignoreCase = true) }
                    ?.importPrice?.takeIf { it > 0L }
                    ?: ((item.unitPrice * 70L) / 100L)
            }
            unitImport * item.quantity
        }
        val shipCost = if (order.shippingFee > 0L) order.shippingCost else 0L
        return goodsCost + shipCost
    }

    fun resolveOrderProfit(order: Order, catalog: List<Product> = _products.value): Long {
        return order.total - resolveOrderCost(order, catalog)
    }

    fun cycleTransactionFilter(): PaymentType {
        val next = when (_txTypeFilter.value) {
            PaymentType.ALL -> PaymentType.COD
            PaymentType.COD -> PaymentType.BANK
            PaymentType.BANK -> PaymentType.WALLET
            PaymentType.WALLET -> PaymentType.ALL
        }
        _txTypeFilter.value = next
        return next
    }

    fun markNotificationsRead() {
        _hasUnreadNotifications.value = false
    }

    fun getOrderById(orderId: String): Order? {
        return _orders.value.find { it.id == orderId }
    }

    fun nextWorkflowStatus(current: OrderStatus): OrderStatus? {
        return when (current) {
            OrderStatus.PLACED -> OrderStatus.PREPARING
            OrderStatus.PREPARING -> OrderStatus.DELIVERING
            OrderStatus.DELIVERING -> OrderStatus.DELIVERED
            OrderStatus.DELIVERED, OrderStatus.CANCELLED -> null
        }
    }

    fun advanceOrderStatus(orderId: String): Order? {
        val current = getOrderById(orderId) ?: return null
        val nextStatus = nextWorkflowStatus(current.status) ?: current.status
        return updateOrderStatus(orderId, nextStatus)
    }

    fun updateOrderStatus(orderId: String, targetStatus: OrderStatus): Order? {
        var updatedOrder: Order? = null
        _orders.update { list ->
            list.map { order ->
                if (order.id == orderId) {
                    val nextOrder = order.copy(status = targetStatus)
                    updatedOrder = nextOrder
                    nextOrder
                } else {
                    order
                }
            }
        }

        recomputeDerivedData()
        _hasUnreadNotifications.value = true

        viewModelScope.launch {
            val backendResult = repository.updateOrderStatus(orderId, targetStatus)
            if (backendResult != null) {
                _orders.update { list -> list.map { if (it.id == orderId) backendResult else it } }
                recomputeDerivedData()
            }
            refreshBackendData()
        }

        return updatedOrder
    }

    fun updateServerIp(hostOrIp: String) {
        val cleanHost = hostOrIp.trim()
        val url = when {
            cleanHost.startsWith("http://") || cleanHost.startsWith("https://") -> cleanHost
            cleanHost.contains(":") -> "http://$cleanHost/"
            else -> "http://$cleanHost:5000/api/"
        }
        com.example.api.RetrofitClient.updateBaseUrl(url)
        refreshBackendData()
    }

    fun resetServerUrl() {
        com.example.api.RetrofitClient.resetToDefault()
        refreshBackendData()
    }

    suspend fun checkBackendConnection(): Pair<Boolean, String> = repository.checkBackendConnection()

    /**
     * Returns true if at least one product in inventory has positive stock available to trade.
     */
    fun hasTradableInventory(currentProducts: List<Product> = _products.value): Boolean {
        return currentProducts.any { !it.isTradeLocked }
    }

    /**
     * Evaluates whether a trade for [product] with [requestedQuantity] must be locked due to
     * insufficient inventory, always checking the freshest stock level in [_products].
     */
    fun checkTradeLock(
        product: Product,
        requestedQuantity: Int,
        currentProducts: List<Product> = _products.value
    ): TradeLockStatus {
        val latest = currentProducts.find { it.id == product.id } ?: product
        val available = latest.stock.coerceAtLeast(0)
        val requested = requestedQuantity.coerceAtLeast(0)

        return when {
            requested <= 0 -> TradeLockStatus(
                isLocked = true,
                productId = latest.id,
                productName = latest.name,
                availableStock = available,
                requestedQuantity = requested,
                shortage = 1,
                title = "🔒 Khóa giao dịch — Số lượng không hợp lệ",
                message = "Số lượng đặt hàng phải lớn hơn 0."
            )
            latest.isTradeLocked -> TradeLockStatus(
                isLocked = true,
                productId = latest.id,
                productName = latest.name,
                availableStock = 0,
                requestedQuantity = requested,
                shortage = requested,
                title = "🔒 Đã khóa giao dịch — Hết tồn kho",
                message = "\"${latest.name}\" đã hết hàng trong kho (tồn: 0). Vui lòng nhập thêm hàng để mở khóa giao dịch."
            )
            !latest.canFulfill(requested) -> {
                val shortage = (requested - available).coerceAtLeast(1)
                TradeLockStatus(
                    isLocked = true,
                    productId = latest.id,
                    productName = latest.name,
                    availableStock = available,
                    requestedQuantity = requested,
                    shortage = shortage,
                    title = "🔒 Đã khóa giao dịch — Tồn kho không đủ",
                    message = "\"${latest.name}\" chỉ còn $available sp trong kho (bạn đặt $requested, thiếu $shortage). Hãy giảm số lượng xuống tối đa $available hoặc nhập thêm kho."
                )
            }
            else -> TradeLockStatus(
                isLocked = false,
                productId = latest.id,
                productName = latest.name,
                availableStock = available,
                requestedQuantity = requested,
                shortage = 0
            )
        }
    }

    /**
     * Attempts to create an order while enforcing the inventory trade lock.
     * Returns [CreateOrderResult.TradeLocked] without modifying orders or stock if inventory is insufficient.
     */
    fun tryCreateOrder(
        customerName: String,
        customerPhone: String,
        address: String,
        product: Product,
        quantity: Int,
        paymentType: PaymentType,
        salesChannel: SalesChannel = SalesChannel.B2C
    ): CreateOrderResult {
        val lockStatus = checkTradeLock(product, quantity)
        if (lockStatus.isLocked) {
            return CreateOrderResult.TradeLocked(lockStatus)
        }
        val order = createOrder(
            customerName = customerName,
            customerPhone = customerPhone,
            address = address,
            product = product,
            quantity = quantity,
            paymentType = paymentType,
            salesChannel = salesChannel
        )
        return CreateOrderResult.Success(order)
    }

    fun createOrder(
        customerName: String,
        customerPhone: String,
        address: String,
        product: Product,
        quantity: Int,
        paymentType: PaymentType,
        salesChannel: SalesChannel = SalesChannel.B2C
    ): Order {
        val lockStatus = checkTradeLock(product, quantity)
        if (lockStatus.isLocked) {
            throw InsufficientStockException(lockStatus)
        }

        val latestProduct = _products.value.find { it.id == product.id } ?: product
        val maxNum = _orders.value.mapNotNull {
            it.id.removePrefix("DH-").toIntOrNull()
        }.maxOrNull() ?: 9821
        val newId = "DH-${maxNum + 1}"
        val paymentLabel = when (paymentType) {
            PaymentType.COD -> "Thanh toán khi nhận hàng (COD)"
            PaymentType.BANK -> "Chuyển khoản ngân hàng (VCB)"
            PaymentType.WALLET -> "Ví điện tử MoMo"
            PaymentType.ALL -> "Thanh toán khi nhận hàng (COD)"
        }
        val pricing = previewOrderPricing(customerPhone, customerName, latestProduct, quantity)
        val effectiveImport = if (latestProduct.importPrice > 0L) latestProduct.importPrice else (latestProduct.price * 70L) / 100L
        val now = Date()
        val newOrder = Order(
            id = newId,
            timeAgo = AppClock.formatOrderTime(now),
            customerName = customerName,
            customerPhone = customerPhone,
            address = address,
            status = OrderStatus.PLACED,
            items = listOf(
                OrderItem(
                    productName = latestProduct.name,
                    quantity = quantity,
                    unitPrice = latestProduct.price,
                    importPrice = effectiveImport,
                    isDemoProduct = latestProduct.isDemoProduct
                )
            ),
            shippingFee = pricing.finalShippingFee,
            paymentMethodLabel = paymentLabel,
            paymentType = paymentType,
            createdAt = AppClock.toIso(now),
            salesChannel = salesChannel,
            vipTierAtPurchase = pricing.tier,
            vipProductDiscount = pricing.vipProductDiscount,
            shippingDiscount = pricing.shippingDiscount,
            shippingCost = pricing.shippingCost
        )
        _orders.update { listOf(newOrder) + it }
        _products.update { list ->
            list.map {
                if (it.id == latestProduct.id) {
                    it.copy(
                        stock = (it.stock - quantity).coerceAtLeast(0),
                        soldCount = it.soldCount + quantity
                    )
                } else it
            }
        }
        _selectedDayNumber.value = AppClock.todayDayOfMonth()
        recomputeDerivedData()
        _hasUnreadNotifications.value = true

        viewModelScope.launch {
            when (
                repository.createOrder(
                    customerName = customerName,
                    customerPhone = customerPhone,
                    address = address,
                    product = latestProduct,
                    quantity = quantity,
                    paymentType = paymentType,
                    salesChannel = salesChannel
                )
            ) {
                is BackendCreateOrderResult.Success -> refreshBackendData()
                is BackendCreateOrderResult.TradeLocked -> {
                    // Server rejected due to insufficient stock — roll back optimistic local state & sync
                    _orders.update { list -> list.filterNot { it.id == newId } }
                    _products.update { list ->
                        list.map {
                            if (it.id == latestProduct.id) {
                                it.copy(
                                    stock = it.stock + quantity,
                                    soldCount = (it.soldCount - quantity).coerceAtLeast(0)
                                )
                            } else it
                        }
                    }
                    recomputeDerivedData()
                    refreshBackendData()
                }
                BackendCreateOrderResult.NetworkError -> Unit
            }
        }

        return newOrder
    }

    fun restockProduct(productId: String, amount: Int = 10) {
        _products.update { list ->
            list.map {
                if (it.id == productId) it.copy(stock = it.stock + amount) else it
            }
        }
        recomputeDerivedData()
        viewModelScope.launch {
            repository.restockProduct(productId, amount)
            refreshBackendData()
        }
    }

    fun addProduct(
        name: String,
        category: String,
        importPrice: Long,
        price: Long,
        stock: Int,
        isDemoProduct: Boolean = false,
        description: String = "",
        imageUrl: String = ""
    ) {
        val nextSku = "VD-SP0${_products.value.size + 1}"
        val imageRes = if (category == "Thời trang") {
            R.drawable.img_product_tshirt
        } else {
            R.drawable.img_product_electronics
        }
        val resolvedImport = if (importPrice > 0L) importPrice else (price * 70L) / 100L
        val newProduct = Product(
            id = "p-${_products.value.size + 1}",
            sku = nextSku,
            name = name,
            category = category,
            price = price,
            stock = stock,
            soldCount = 0,
            imageRes = imageRes,
            description = description,
            imageUrl = imageUrl,
            importPrice = resolvedImport,
            isDemoProduct = isDemoProduct
        )
        _products.update { listOf(newProduct) + it }
        recomputeDerivedData()

        viewModelScope.launch {
            repository.createProduct(name, category, resolvedImport, price, stock, isDemoProduct, description, imageUrl)
            refreshBackendData()
        }
    }

    suspend fun addProductsBulk(items: List<BulkProductInput>): BulkImportOutcome {
        if (items.isEmpty()) {
            return BulkImportOutcome(success = false, insertedCount = 0, message = "Không có sản phẩm nào để lưu")
        }

        val outcome = repository.createProductsBulk(items)
        if (outcome.success) {
            val refreshed = repository.fetchProducts()
            if (!refreshed.isNullOrEmpty()) {
                _products.value = refreshed
            } else if (outcome.products.isNotEmpty()) {
                _products.update { current -> outcome.products + current }
            }
            recomputeDerivedData()
            return outcome
        }

        val existingMax = _products.value.mapNotNull {
            it.id.removePrefix("p-").toIntOrNull()
        }.maxOrNull() ?: _products.value.size

        val localProducts = items.mapIndexed { idx, item ->
            val seq = existingMax + idx + 1
            val imageRes = if (item.category == "Thời trang") {
                R.drawable.img_product_tshirt
            } else {
                R.drawable.img_product_electronics
            }
            Product(
                id = "p-$seq",
                sku = item.sku.ifBlank { "VD-SP${seq.toString().padStart(2, '0')}" },
                name = item.name,
                category = item.category,
                price = item.price,
                stock = item.stock,
                soldCount = 0,
                imageRes = imageRes,
                description = item.description,
                imageUrl = item.imageUrl,
                importPrice = if (item.importPrice > 0L) item.importPrice else (item.price * 70L) / 100L,
                isDemoProduct = item.isDemoProduct
            )
        }
        _products.update { current -> localProducts.reversed() + current }
        recomputeDerivedData()
        return BulkImportOutcome(
            success = true,
            insertedCount = localProducts.size,
            savedOffline = true,
            message = "Không kết nối được Backend — đã thêm tạm ${localProducts.size} sản phẩm trên ứng dụng",
            products = localProducts
        )
    }

    fun updateProduct(
        productId: String,
        name: String,
        category: String,
        importPrice: Long,
        price: Long,
        stock: Int,
        isDemoProduct: Boolean,
        description: String,
        imageUrl: String
    ) {
        val resolvedImport = importPrice.coerceAtLeast(0L)
        _products.update { list ->
            list.map {
                if (it.id == productId) {
                    it.copy(
                        name = name,
                        category = category,
                        importPrice = resolvedImport,
                        price = price,
                        stock = stock,
                        isDemoProduct = isDemoProduct,
                        description = description,
                        imageUrl = imageUrl
                    )
                } else it
            }
        }
        recomputeDerivedData()
        viewModelScope.launch {
            repository.updateProduct(productId, name, category, resolvedImport, price, stock, isDemoProduct, description, imageUrl)
            refreshBackendData()
        }
    }

    fun deleteProduct(productId: String) {
        _products.update { list -> list.filterNot { it.id == productId } }
        recomputeDerivedData()
        viewModelScope.launch {
            repository.deleteProduct(productId)
            refreshBackendData()
        }
    }

    /**
     * Computes real income statement statistics (Revenue, Cost, Profit, B2B vs B2C channel split,
     * and VIP discounts) from delivered orders, bucketed by real calendar date.
     */
    fun getIncomeData(
        period: IncomePeriod,
        currentOrders: List<Order> = _orders.value,
        metric: IncomeChartMetric = _incomeChartMetric.value,
        catalog: List<Product> = _products.value
    ): IncomePeriodData {
        val today = AppClock.today()
        val datedDelivered: List<Pair<Order, AppClock.Day>> = currentOrders
            .filter { it.status == OrderStatus.DELIVERED }
            .mapNotNull { order -> AppClock.orderDay(order)?.let { order to it } }

        fun pad2(n: Int) = n.toString().padStart(2, '0')
        val vnLocale = Locale.forLanguageTag("vi-VN")

        fun formatMillionsPill(amount: Long): String {
            if (amount <= 0L) return "0đ"
            val m = amount / 1_000_000f
            return if (m >= 1f) {
                String.format(vnLocale, "%.2fTR", m).replace(".00", "")
            } else {
                "${amount / 1000}K"
            }
        }

        fun orderMetricValue(order: Order): Long = when (metric) {
            IncomeChartMetric.REVENUE -> order.total
            IncomeChartMetric.PROFIT -> resolveOrderProfit(order, catalog).coerceAtLeast(0L)
        }

        fun buildData(
            heroLabel: String,
            periodOrders: List<Order>,
            buckets: List<Pair<String, Long>>,
            emptyPeakText: String,
            selectedIndex: Int
        ): IncomePeriodData {
            val totalRevenue = periodOrders.sumOf { it.total }
            val totalCost = periodOrders.sumOf { resolveOrderCost(it, catalog) }
            val totalProfit = totalRevenue - totalCost
            val marginPercent = if (totalRevenue > 0L) (totalProfit.toDouble() / totalRevenue.toDouble()) * 100.0 else 0.0
            val totalMetricSum = if (metric == IncomeChartMetric.REVENUE) totalRevenue else totalProfit

            val codRevenue = periodOrders.filter { it.paymentType == PaymentType.COD }.sumOf { it.total }
            val bankAndWalletRevenue = periodOrders.filter {
                it.paymentType == PaymentType.BANK || it.paymentType == PaymentType.WALLET
            }.sumOf { it.total }

            // B2B vs B2C stats for this period
            val b2bOrders = periodOrders.filter { it.salesChannel == SalesChannel.B2B }
            val b2cOrders = periodOrders.filter { it.salesChannel == SalesChannel.B2C }
            val b2bRevenue = b2bOrders.sumOf { it.total }
            val b2cRevenue = b2cOrders.sumOf { it.total }
            val b2bProfit = b2bOrders.sumOf { resolveOrderProfit(it, catalog) }
            val b2cProfit = b2cOrders.sumOf { resolveOrderProfit(it, catalog) }
            val b2bShare = if (totalRevenue > 0L) ((b2bRevenue * 100L) / totalRevenue).toInt() else 0
            val b2cShare = if (totalRevenue > 0L) (100 - b2bShare).coerceAtLeast(0) else 0

            val totalVipSavings = periodOrders.sumOf { it.vipProductDiscount + it.shippingDiscount }

            val bars = buckets.map { (label, sum) ->
                IncomeBarPoint(
                    label = label,
                    valueMillions = sum / 1_000_000f,
                    displayPill = formatMillionsPill(sum)
                )
            }
            val maxMillions = (bars.maxOfOrNull { it.valueMillions } ?: 1f).coerceAtLeast(1f) * 1.2f
            val activeBuckets = buckets.count { it.second > 0L }.coerceAtLeast(1)
            val peak = buckets.maxByOrNull { it.second }
            val peakText = if (peak != null && peak.second > 0L) {
                "Đỉnh điểm: ${CurrencyFormatter.formatVnd(peak.second)} (${peak.first})"
            } else {
                emptyPeakText
            }

            return IncomePeriodData(
                period = period,
                metric = metric,
                heroLabel = heroLabel,
                totalFormatted = CurrencyFormatter.formatVndFull(totalRevenue),
                totalProfitFormatted = CurrencyFormatter.formatVndFull(totalProfit),
                totalCostFormatted = CurrencyFormatter.formatVnd(totalCost),
                profitMarginFormatted = String.format(vnLocale, "%.1f%%", marginPercent),
                growthPercent = "${periodOrders.size} đơn hoàn tất",
                codFormatted = CurrencyFormatter.formatVnd(codRevenue),
                bankFormatted = CurrencyFormatter.formatVnd(bankAndWalletRevenue),
                avgFormatted = CurrencyFormatter.formatVnd(totalMetricSum / activeBuckets),
                peakText = peakText,
                maxAxisValue = maxMillions.coerceAtLeast(2f),
                bars = bars,
                defaultSelectedIndex = selectedIndex.coerceIn(0, (bars.size - 1).coerceAtLeast(0)),
                b2bStats = ChannelSalesStats(
                    channel = SalesChannel.B2B,
                    orderCount = b2bOrders.size,
                    revenue = b2bRevenue,
                    profit = b2bProfit,
                    sharePercent = b2bShare
                ),
                b2cStats = ChannelSalesStats(
                    channel = SalesChannel.B2C,
                    orderCount = b2cOrders.size,
                    revenue = b2cRevenue,
                    profit = b2cProfit,
                    sharePercent = b2cShare
                ),
                totalVipSavingsFormatted = CurrencyFormatter.formatVnd(totalVipSavings)
            )
        }

        return when (period) {
            IncomePeriod.WEEK -> {
                val days = (-6..0).map { AppClock.dayOffsetFromToday(it) }
                val inWeek = datedDelivered.filter { (_, day) -> day in days }
                val buckets = days.map { d ->
                    "${pad2(d.day)}/${pad2(d.month)}" to
                        inWeek.filter { it.second == d }.sumOf { orderMetricValue(it.first) }
                }
                buildData(
                    heroLabel = "DOANH THU & LỢI NHUẬN (${buckets.first().first} - ${buckets.last().first})",
                    periodOrders = inWeek.map { it.first },
                    buckets = buckets,
                    emptyPeakText = "Chưa phát sinh đơn giao thành công",
                    selectedIndex = buckets.lastIndex
                )
            }

            IncomePeriod.MONTH -> {
                val totalDays = AppClock.daysInCurrentMonth()
                val mm = pad2(today.month)
                val ranges = (1..totalDays step 7).map { start -> start..minOf(start + 6, totalDays) }
                val inMonth = datedDelivered.filter { (_, day) ->
                    day.year == today.year && day.month == today.month
                }
                val buckets = ranges.map { range ->
                    "${pad2(range.first)}-${pad2(range.last)}/$mm" to
                        inMonth.filter { it.second.day in range }.sumOf { orderMetricValue(it.first) }
                }
                buildData(
                    heroLabel = "DOANH THU & LỢI NHUẬN THÁNG $mm/${today.year}",
                    periodOrders = inMonth.map { it.first },
                    buckets = buckets,
                    emptyPeakText = "Chưa phát sinh doanh thu",
                    selectedIndex = ranges.indexOfFirst { today.day in it }
                )
            }

            IncomePeriod.YEAR -> {
                val months = (-5..0).map { AppClock.monthOffsetFromCurrent(it) }
                val inRange = datedDelivered.filter { (_, day) -> (day.year to day.month) in months }
                val buckets = months.map { ym ->
                    "T${ym.second}" to inRange
                        .filter { (it.second.year to it.second.month) == ym }
                        .sumOf { orderMetricValue(it.first) }
                }
                val (firstYear, firstMonth) = months.first()
                buildData(
                    heroLabel = "DOANH THU & LỢI NHUẬN (${pad2(firstMonth)}/$firstYear - ${pad2(today.month)}/${today.year})",
                    periodOrders = inRange.map { it.first },
                    buckets = buckets,
                    emptyPeakText = "Chưa phát sinh doanh thu",
                    selectedIndex = buckets.lastIndex
                )
            }
        }
    }

    /** Demo/offline orders dated relative to "now" (mirrors backend seedData.js). */
    private fun seedOrders(): List<Order> {
        val nowMs = System.currentTimeMillis()
        fun ago(minutes: Long) = Date(nowMs - minutes * 60_000L)
        val minutesPerDay = 24 * 60L
        val t9824 = ago(10)
        val t9823 = ago(25)
        val t9822 = ago(45)
        val t9821 = ago(1 * minutesPerDay)
        val t9820 = ago(1 * minutesPerDay + 180)
        val t9819 = ago(2 * minutesPerDay)
        val t9818 = ago(2 * minutesPerDay + 120)
        val t9817 = ago(3 * minutesPerDay)

        return listOf(
            Order(
                id = "DH-9824",
                timeAgo = AppClock.formatOrderTime(t9824),
                customerName = "Cty TNHH Minh Phát (Đại diện: A. Hoàng)",
                customerPhone = "0901 234 567",
                address = "88 Nguyễn Huệ, Q.1, TP.HCM",
                status = OrderStatus.DELIVERED,
                items = listOf(OrderItem("Tai Nghe Chống Ồn Viễn Đông ANC (Demo)", 1, 1220000L, 820000L, true)),
                shippingFee = 20000L,
                paymentMethodLabel = "Chuyển khoản ngân hàng (VCB)",
                paymentType = PaymentType.BANK,
                createdAt = AppClock.toIso(t9824),
                salesChannel = SalesChannel.B2B,
                vipTierAtPurchase = VipTier.VIP_GOLD,
                vipProductDiscount = 183000L,
                shippingDiscount = 10000L,
                shippingCost = VipTier.SHIPPING_BASE_COST
            ),
            Order(
                id = "DH-9823",
                timeAgo = AppClock.formatOrderTime(t9823),
                customerName = "Nguyễn Văn An",
                customerPhone = "0988 123 456",
                address = "45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM",
                status = OrderStatus.DELIVERING,
                items = listOf(OrderItem("Chuột Không Dây Công Thái Học M331", 2, 380000L, 240000L, false)),
                shippingFee = 25000L,
                paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
                paymentType = PaymentType.COD,
                createdAt = AppClock.toIso(t9823),
                salesChannel = SalesChannel.B2C,
                vipTierAtPurchase = VipTier.VIP_SILVER,
                vipProductDiscount = 0L,
                shippingDiscount = 5000L,
                shippingCost = VipTier.SHIPPING_BASE_COST
            ),
            Order(
                id = "DH-9822",
                timeAgo = AppClock.formatOrderTime(t9822),
                customerName = "Cty TNHH Minh Phát (Đại diện: A. Hoàng)",
                customerPhone = "0901 234 567",
                address = "88 Nguyễn Huệ, Q.1, TP.HCM",
                status = OrderStatus.DELIVERED,
                items = listOf(OrderItem("Bộ Chia Mạng Gigabit B2B Pro", 5, 950000L, 650000L, false)),
                shippingFee = 25000L,
                paymentMethodLabel = "Chuyển khoản ngân hàng (VCB)",
                paymentType = PaymentType.BANK,
                createdAt = AppClock.toIso(t9822),
                salesChannel = SalesChannel.B2B,
                vipTierAtPurchase = VipTier.VIP_SILVER,
                vipProductDiscount = 0L,
                shippingDiscount = 5000L,
                shippingCost = VipTier.SHIPPING_BASE_COST
            ),
            Order(
                id = "DH-9821",
                timeAgo = AppClock.formatOrderTime(t9821),
                customerName = "Lê Hoàng Long",
                customerPhone = "0933 444 555",
                address = "78 Nguyễn Thị Minh Khai, Q.1, TP.HCM",
                status = OrderStatus.DELIVERED,
                items = listOf(OrderItem("Hub USB-C Đa Năng 7-in-1 (Demo)", 1, 820000L, 540000L, true)),
                shippingFee = 30000L,
                paymentMethodLabel = "Ví điện tử MoMo",
                paymentType = PaymentType.WALLET,
                createdAt = AppClock.toIso(t9821),
                salesChannel = SalesChannel.B2C,
                vipTierAtPurchase = VipTier.STANDARD,
                shippingCost = VipTier.SHIPPING_BASE_COST
            ),
            Order(
                id = "DH-9820",
                timeAgo = AppClock.formatOrderTime(t9820),
                customerName = "Cty TNHH Minh Phát (Đại diện: A. Hoàng)",
                customerPhone = "0901 234 567",
                address = "88 Nguyễn Huệ, Q.1, TP.HCM",
                status = OrderStatus.DELIVERED,
                items = listOf(OrderItem("Bàn Phím Cơ Bluetooth K8 Pro", 3, 1290000L, 890000L, false)),
                shippingFee = 25000L,
                paymentMethodLabel = "Chuyển khoản ngân hàng (VCB)",
                paymentType = PaymentType.BANK,
                createdAt = AppClock.toIso(t9820),
                salesChannel = SalesChannel.B2B,
                vipTierAtPurchase = VipTier.VIP_SILVER,
                shippingDiscount = 5000L,
                shippingCost = VipTier.SHIPPING_BASE_COST
            ),
            Order(
                id = "DH-9819",
                timeAgo = AppClock.formatOrderTime(t9819),
                customerName = "Nguyễn Văn An",
                customerPhone = "0988 123 456",
                address = "45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM",
                status = OrderStatus.DELIVERED,
                items = listOf(OrderItem("Củ Sạc Nhanh GaN 65W Chính Hãng", 2, 325000L, 210000L, false)),
                shippingFee = 30000L,
                paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
                paymentType = PaymentType.COD,
                createdAt = AppClock.toIso(t9819),
                salesChannel = SalesChannel.B2C,
                vipTierAtPurchase = VipTier.STANDARD,
                shippingCost = VipTier.SHIPPING_BASE_COST
            ),
            Order(
                id = "DH-9818",
                timeAgo = AppClock.formatOrderTime(t9818),
                customerName = "Phạm Quốc Bảo",
                customerPhone = "0977 111 222",
                address = "12 Đường số 5, Q.7, TP.HCM",
                status = OrderStatus.CANCELLED,
                items = listOf(OrderItem("Bàn Phím Cơ Bluetooth K8 Pro", 2, 1290000L, 890000L, false)),
                shippingFee = 0L,
                paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
                paymentType = PaymentType.COD,
                createdAt = AppClock.toIso(t9818),
                salesChannel = SalesChannel.B2C,
                shippingCost = 0L
            ),
            Order(
                id = "DH-9817",
                timeAgo = AppClock.formatOrderTime(t9817),
                customerName = "Cty TNHH Minh Phát (Đại diện: A. Hoàng)",
                customerPhone = "0901 234 567",
                address = "88 Nguyễn Huệ, Q.1, TP.HCM",
                status = OrderStatus.DELIVERED,
                items = listOf(OrderItem("Chuột Không Dây Công Thái Học M331", 10, 380000L, 240000L, false)),
                shippingFee = 30000L,
                paymentMethodLabel = "Chuyển khoản ngân hàng (VCB)",
                paymentType = PaymentType.BANK,
                createdAt = AppClock.toIso(t9817),
                salesChannel = SalesChannel.B2B,
                vipTierAtPurchase = VipTier.STANDARD,
                shippingCost = VipTier.SHIPPING_BASE_COST
            )
        )
    }

    private fun seedProducts(): List<Product> = listOf(
        Product(
            id = "p-1",
            sku = "VD-BP01",
            name = "Bàn Phím Cơ Bluetooth K8 Pro",
            category = "Thiết bị điện tử",
            price = 1290000L,
            stock = 25,
            soldCount = 45,
            imageRes = R.drawable.img_product_electronics,
            importPrice = 890000L,
            isDemoProduct = false
        ),
        Product(
            id = "p-2",
            sku = "VD-TN02",
            name = "Tai Nghe Chống Ồn Viễn Đông ANC (Demo)",
            category = "Thiết bị điện tử",
            price = 1220000L,
            stock = 18,
            soldCount = 39,
            imageRes = R.drawable.img_product_electronics,
            importPrice = 820000L,
            isDemoProduct = true
        ),
        Product(
            id = "p-3",
            sku = "VD-HB03",
            name = "Hub USB-C Đa Năng 7-in-1 (Demo)",
            category = "Phụ kiện",
            price = 820000L,
            stock = 8,
            soldCount = 27,
            imageRes = R.drawable.img_product_electronics,
            importPrice = 540000L,
            isDemoProduct = true
        ),
        Product(
            id = "p-4",
            sku = "VD-CH04",
            name = "Chuột Không Dây Công Thái Học M331",
            category = "Phụ kiện",
            price = 380000L,
            stock = 42,
            soldCount = 60,
            imageRes = R.drawable.img_product_electronics,
            importPrice = 240000L,
            isDemoProduct = false
        ),
        Product(
            id = "p-5",
            sku = "VD-CS05",
            name = "Củ Sạc Nhanh GaN 65W Chính Hãng",
            category = "Phụ kiện",
            price = 325000L,
            stock = 6,
            soldCount = 52,
            imageRes = R.drawable.img_product_electronics,
            importPrice = 210000L,
            isDemoProduct = false
        ),
        Product(
            id = "p-6",
            sku = "VD-TB06",
            name = "Bộ Chia Mạng Gigabit B2B Pro",
            category = "Thiết bị điện tử",
            price = 950000L,
            stock = 40,
            soldCount = 19,
            imageRes = R.drawable.img_product_electronics,
            importPrice = 650000L,
            isDemoProduct = false
        )
    )
}

