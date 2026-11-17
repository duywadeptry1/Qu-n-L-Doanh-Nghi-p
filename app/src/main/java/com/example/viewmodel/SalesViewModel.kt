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

    private val _selectedDayNumber = MutableStateFlow(TODAY_DAY)
    val selectedDayNumber: StateFlow<Int> = _selectedDayNumber.asStateFlow()

    private val _incomePeriod = MutableStateFlow(IncomePeriod.WEEK)
    val incomePeriod: StateFlow<IncomePeriod> = _incomePeriod.asStateFlow()

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

    fun extractOrderDayOfMonth(order: Order): Int {
        val dateRegex = Regex("""(\d{1,2})/11/2026""")
        dateRegex.find(order.timeAgo)?.groupValues?.getOrNull(1)?.toIntOrNull()?.let { day ->
            if (day in 1..30) return day
        }
        val isoRegex = Regex("""2026-11-(\d{2})""")
        isoRegex.find(order.createdAt)?.groupValues?.getOrNull(1)?.toIntOrNull()?.let { day ->
            if (day in 1..30) return day
        }
        val lower = order.timeAgo.lowercase(Locale.ROOT)
        return when {
            lower.contains("hôm qua") -> TODAY_DAY - 1
            else -> TODAY_DAY
        }
    }

    fun getOrdersForDay(dayNumber: Int, allOrders: List<Order> = _orders.value): List<Order> {
        if (dayNumber > TODAY_DAY) return emptyList()
        return allOrders.filter { extractOrderDayOfMonth(it) == dayNumber }
    }

    private fun buildMonthlyCalendarFromOrders(currentOrders: List<Order>): List<CalendarDaySummary> {
        return (1..30).map { day ->
            val isFuture = day > TODAY_DAY
            val dayStr = day.toString().padStart(2, '0')
            if (isFuture) {
                CalendarDaySummary(
                    dayNumber = day,
                    monthLabel = "Thg 11",
                    fullDate = "Ngày $dayStr/11/2026 (Chưa tới)",
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
                val title = if (day == TODAY_DAY) {
                    "Hôm nay, $dayStr/11/2026"
                } else {
                    "Ngày $dayStr/11/2026"
                }
                CalendarDaySummary(
                    dayNumber = day,
                    monthLabel = "Thg 11",
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
                val day = extractOrderDayOfMonth(order).toString().padStart(2, '0')
                PaymentTransaction(
                    id = "tx-${order.id}",
                    orderCode = "#${order.id}",
                    methodTitle = "Đơn #${order.id} (${order.paymentType.label})",
                    subtitle = "$day/11/2026 • Đã đến tay ${order.customerName}",
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

        val lowStock = currentProducts.filter { it.stock <= 10 }
        if (lowStock.isNotEmpty()) {
            val preview = lowStock.take(3).joinToString(", ") { "${it.name} (còn ${it.stock})" }
            list.add(
                NotificationItem(
                    id = "notif-low-stock",
                    title = "Cảnh báo tồn kho thấp (${lowStock.size} mã SP)",
                    message = "$preview cần nhập thêm hàng vào kho.",
                    timeAgo = "17/11/2026",
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

    fun createOrder(
        customerName: String,
        customerPhone: String,
        address: String,
        product: Product,
        quantity: Int,
        paymentType: PaymentType
    ): Order {
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
        val newOrder = Order(
            id = newId,
            timeAgo = "17/11/2026 • Vừa xong",
            customerName = customerName,
            customerPhone = customerPhone,
            address = address,
            status = OrderStatus.PLACED,
            items = listOf(OrderItem(product.name, quantity, product.price)),
            shippingFee = 30000L,
            paymentMethodLabel = paymentLabel,
            paymentType = paymentType,
            createdAt = "2026-11-17T15:00:00+07:00"
        )
        _orders.update { listOf(newOrder) + it }
        _products.update { list ->
            list.map {
                if (it.id == product.id) {
                    it.copy(
                        stock = (it.stock - quantity).coerceAtLeast(0),
                        soldCount = it.soldCount + quantity
                    )
                } else it
            }
        }
        _selectedDayNumber.value = TODAY_DAY
        recomputeDerivedData()
        _hasUnreadNotifications.value = true

        viewModelScope.launch {
            val backendCreated = repository.createOrder(customerName, customerPhone, address, product, quantity, paymentType)
            if (backendCreated != null) {
                refreshBackendData()
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
        price: Long,
        stock: Int,
        description: String = "",
        imageUrl: String = ""
    ) {
        val nextSku = "VD-SP0${_products.value.size + 1}"
        val imageRes = if (category == "Thời trang") {
            R.drawable.img_product_tshirt
        } else {
            R.drawable.img_product_electronics
        }
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
            imageUrl = imageUrl
        )
        _products.update { listOf(newProduct) + it }
        recomputeDerivedData()

        viewModelScope.launch {
            repository.createProduct(name, category, price, stock, description, imageUrl)
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
                imageUrl = item.imageUrl
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
        price: Long,
        stock: Int,
        description: String,
        imageUrl: String
    ) {
        _products.update { list ->
            list.map {
                if (it.id == productId) {
                    it.copy(
                        name = name,
                        category = category,
                        price = price,
                        stock = stock,
                        description = description,
                        imageUrl = imageUrl
                    )
                } else it
            }
        }
        recomputeDerivedData()
        viewModelScope.launch {
            repository.updateProduct(productId, name, category, price, stock, description, imageUrl)
            refreshBackendData()
        }
    }

    /**
     * Computes real income statistics directly from delivered orders in `_orders`.
     */
    fun getIncomeData(period: IncomePeriod, currentOrders: List<Order> = _orders.value): IncomePeriodData {
        val deliveredOrders = currentOrders.filter { it.status == OrderStatus.DELIVERED }
        val totalRevenue = deliveredOrders.sumOf { it.total }
        val codRevenue = deliveredOrders.filter { it.paymentType == PaymentType.COD }.sumOf { it.total }
        val bankAndWalletRevenue = deliveredOrders.filter {
            it.paymentType == PaymentType.BANK || it.paymentType == PaymentType.WALLET
        }.sumOf { it.total }

        fun formatMillionsPill(amount: Long): String {
            if (amount <= 0L) return "0đ"
            val m = amount / 1_000_000f
            return if (m >= 1f) {
                String.format(Locale("vi", "VN"), "%.2fTR", m).replace(".00", "")
            } else {
                "${amount / 1000}K"
            }
        }

        return when (period) {
            IncomePeriod.WEEK -> {
                // Week of 11/11..17/11/2026
                val weekDays = listOf(
                    11 to "11/11",
                    12 to "12/11",
                    13 to "13/11",
                    14 to "14/11",
                    15 to "15/11",
                    16 to "16/11",
                    17 to "17/11"
                )
                val dayAmounts = weekDays.map { (dayNum, label) ->
                    val sum = deliveredOrders
                        .filter { extractOrderDayOfMonth(it) == dayNum }
                        .sumOf { it.total }
                    Triple(dayNum, label, sum)
                }
                val bars = dayAmounts.map { (_, label, sum) ->
                    IncomeBarPoint(
                        label = label,
                        valueMillions = sum / 1_000_000f,
                        displayPill = formatMillionsPill(sum)
                    )
                }
                val maxMillions = (bars.maxOfOrNull { it.valueMillions } ?: 1f).coerceAtLeast(1f) * 1.2f
                val activeDaysCount = dayAmounts.count { it.third > 0L }.coerceAtLeast(1)
                val avgAmount = totalRevenue / activeDaysCount
                val peak = dayAmounts.maxByOrNull { it.third }
                val peakText = if (peak != null && peak.third > 0L) {
                    "Đỉnh điểm: ${CurrencyFormatter.formatVnd(peak.third)} (${peak.second})"
                } else {
                    "Chưa phát sinh đơn giao thành công"
                }

                IncomePeriodData(
                    period = IncomePeriod.WEEK,
                    heroLabel = "THU NHẬP THỰC TẾ (11/11 - 17/11)",
                    totalFormatted = CurrencyFormatter.formatVndFull(totalRevenue),
                    growthPercent = "${deliveredOrders.size} đơn hoàn tất",
                    codFormatted = CurrencyFormatter.formatVnd(codRevenue),
                    bankFormatted = CurrencyFormatter.formatVnd(bankAndWalletRevenue),
                    avgFormatted = CurrencyFormatter.formatVnd(avgAmount),
                    peakText = peakText,
                    maxAxisValue = maxMillions.coerceAtLeast(2f),
                    bars = bars
                )
            }

            IncomePeriod.MONTH -> {
                // 4 weeks in November 2026 (Days > 17 are future = 0)
                val weekRanges = listOf(
                    Triple("01-07/11", 1..7, false),
                    Triple("08-14/11", 8..14, false),
                    Triple("15-17/11", 15..17, false),
                    Triple("18-30/11", 18..30, true)
                )
                val weekSums = weekRanges.map { (label, range, isFuture) ->
                    val sum = if (isFuture) 0L else deliveredOrders
                        .filter { extractOrderDayOfMonth(it) in range }
                        .sumOf { it.total }
                    label to sum
                }
                val bars = weekSums.map { (label, sum) ->
                    IncomeBarPoint(
                        label = label,
                        valueMillions = sum / 1_000_000f,
                        displayPill = formatMillionsPill(sum)
                    )
                }
                val maxMillions = (bars.maxOfOrNull { it.valueMillions } ?: 1f).coerceAtLeast(1f) * 1.2f
                val activeWeeks = weekSums.count { it.second > 0L }.coerceAtLeast(1)
                val avgAmount = totalRevenue / activeWeeks
                val peak = weekSums.maxByOrNull { it.second }
                val peakText = if (peak != null && peak.second > 0L) {
                    "Đỉnh điểm: ${CurrencyFormatter.formatVnd(peak.second)} (${peak.first})"
                } else {
                    "Chưa phát sinh doanh thu"
                }

                IncomePeriodData(
                    period = IncomePeriod.MONTH,
                    heroLabel = "THU NHẬP THỰC TẾ THÁNG 11/2026",
                    totalFormatted = CurrencyFormatter.formatVndFull(totalRevenue),
                    growthPercent = "${deliveredOrders.size} đơn hoàn tất",
                    codFormatted = CurrencyFormatter.formatVnd(codRevenue),
                    bankFormatted = CurrencyFormatter.formatVnd(bankAndWalletRevenue),
                    avgFormatted = CurrencyFormatter.formatVnd(avgAmount),
                    peakText = peakText,
                    maxAxisValue = maxMillions.coerceAtLeast(2f),
                    bars = bars
                )
            }

            IncomePeriod.YEAR -> {
                val months = listOf("T7", "T8", "T9", "T10", "T11", "T12")
                val bars = months.map { m ->
                    val sum = if (m == "T11") totalRevenue else 0L
                    IncomeBarPoint(
                        label = m,
                        valueMillions = sum / 1_000_000f,
                        displayPill = formatMillionsPill(sum)
                    )
                }
                val maxMillions = (bars.maxOfOrNull { it.valueMillions } ?: 1f).coerceAtLeast(1f) * 1.2f

                IncomePeriodData(
                    period = IncomePeriod.YEAR,
                    heroLabel = "THU NHẬP THỰC TẾ NĂM 2026",
                    totalFormatted = CurrencyFormatter.formatVndFull(totalRevenue),
                    growthPercent = "${deliveredOrders.size} đơn hoàn tất",
                    codFormatted = CurrencyFormatter.formatVnd(codRevenue),
                    bankFormatted = CurrencyFormatter.formatVnd(bankAndWalletRevenue),
                    avgFormatted = CurrencyFormatter.formatVnd(totalRevenue),
                    peakText = "Tháng 11: ${CurrencyFormatter.formatVnd(totalRevenue)}",
                    maxAxisValue = maxMillions.coerceAtLeast(2f),
                    bars = bars
                )
            }
        }
    }

    private fun seedOrders(): List<Order> = listOf(
        Order(
            id = "DH-9821",
            timeAgo = "17/11/2026 • 10 phút trước",
            customerName = "Nguyễn Văn An",
            customerPhone = "0988 123 456",
            address = "45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM",
            status = OrderStatus.DELIVERING,
            items = listOf(OrderItem("Áo Thun Nam Co Giãn Premium", 2, 210000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
            paymentType = PaymentType.COD,
            createdAt = "2026-11-17T14:20:00+07:00"
        ),
        Order(
            id = "DH-9820",
            timeAgo = "17/11/2026 • 25 phút trước",
            customerName = "Trần Thị Mai",
            customerPhone = "0912 999 888",
            address = "102 Võ Văn Tần, Q.3, TP.HCM",
            status = OrderStatus.PREPARING,
            items = listOf(OrderItem("Tai Nghe Chống Ồn Viễn Đông ANC", 1, 1220000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Chuyển khoản ngân hàng (VCB)",
            paymentType = PaymentType.BANK,
            createdAt = "2026-11-17T11:15:00+07:00"
        ),
        Order(
            id = "DH-9819",
            timeAgo = "16/11/2026 • 16:40",
            customerName = "Lê Hoàng Long",
            customerPhone = "0933 444 555",
            address = "78 Nguyễn Thị Minh Khai, Q.1, TP.HCM",
            status = OrderStatus.DELIVERED,
            items = listOf(OrderItem("Hub USB-C Đa Năng 7-in-1", 1, 820000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Ví điện tử MoMo",
            paymentType = PaymentType.WALLET,
            createdAt = "2026-11-16T16:40:00+07:00"
        ),
        Order(
            id = "DH-9818",
            timeAgo = "15/11/2026 • 14:10",
            customerName = "Phạm Quốc Bảo",
            customerPhone = "0977 111 222",
            address = "12 Đường số 5, Q.7, TP.HCM",
            status = OrderStatus.CANCELLED,
            items = listOf(OrderItem("Áo Polo Đồng Phục Doanh Nghiệp", 5, 420000L)),
            shippingFee = 0L,
            paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
            paymentType = PaymentType.COD,
            createdAt = "2026-11-15T14:10:00+07:00"
        ),
        Order(
            id = "DH-9817",
            timeAgo = "14/11/2026 • 09:30",
            customerName = "Đặng Thu Thảo",
            customerPhone = "0908 777 666",
            address = "55 Điện Biên Phủ, Bình Thạnh, TP.HCM",
            status = OrderStatus.DELIVERED,
            items = listOf(OrderItem("Củ Sạc Nhanh GaN 65W Chính Hãng", 2, 325000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
            paymentType = PaymentType.COD,
            createdAt = "2026-11-14T09:30:00+07:00"
        )
    )

    private fun seedProducts(): List<Product> = listOf(
        Product(
            id = "p-1",
            sku = "VD-AT01",
            name = "Áo Thun Nam Co Giãn Premium",
            category = "Thời trang",
            price = 210000L,
            stock = 64,
            soldCount = 84,
            imageRes = R.drawable.img_product_tshirt
        ),
        Product(
            id = "p-2",
            sku = "VD-TN02",
            name = "Tai Nghe Chống Ồn Viễn Đông ANC",
            category = "Thiết bị điện tử",
            price = 1220000L,
            stock = 18,
            soldCount = 39,
            imageRes = R.drawable.img_product_electronics
        ),
        Product(
            id = "p-3",
            sku = "VD-HB03",
            name = "Hub USB-C Đa Năng 7-in-1",
            category = "Phụ kiện",
            price = 820000L,
            stock = 8,
            soldCount = 27,
            imageRes = R.drawable.img_product_electronics
        ),
        Product(
            id = "p-4",
            sku = "VD-PL04",
            name = "Áo Polo Đồng Phục Doanh Nghiệp",
            category = "Thời trang",
            price = 420000L,
            stock = 112,
            soldCount = 45,
            imageRes = R.drawable.img_product_tshirt
        ),
        Product(
            id = "p-5",
            sku = "VD-CS05",
            name = "Củ Sạc Nhanh GaN 65W Chính Hãng",
            category = "Phụ kiện",
            price = 325000L,
            stock = 6,
            soldCount = 52,
            imageRes = R.drawable.img_product_electronics
        ),
        Product(
            id = "p-6",
            sku = "VD-TB06",
            name = "Bộ Chia Mạng Gigabit B2B Pro",
            category = "Thiết bị điện tử",
            price = 950000L,
            stock = 40,
            soldCount = 19,
            imageRes = R.drawable.img_product_electronics
        )
    )

    companion object {
        const val TODAY_DAY = 17
    }
}
