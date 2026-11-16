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

data class DashboardKpis(
    val placedCount: Int,
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

    private val _calendarDays = MutableStateFlow(seedCalendarDays())
    val calendarDays: StateFlow<List<CalendarDaySummary>> = _calendarDays.asStateFlow()

    private val _selectedDayNumber = MutableStateFlow(15)
    val selectedDayNumber: StateFlow<Int> = _selectedDayNumber.asStateFlow()

    private val _incomePeriod = MutableStateFlow(IncomePeriod.WEEK)
    val incomePeriod: StateFlow<IncomePeriod> = _incomePeriod.asStateFlow()

    private val _txTypeFilter = MutableStateFlow(PaymentType.ALL)
    val txTypeFilter: StateFlow<PaymentType> = _txTypeFilter.asStateFlow()

    private val _transactions = MutableStateFlow(seedTransactions())
    val transactions: StateFlow<List<PaymentTransaction>> = _transactions.asStateFlow()

    private val _notifications = MutableStateFlow(seedNotifications())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()

    private val _hasUnreadNotifications = MutableStateFlow(true)
    val hasUnreadNotifications: StateFlow<Boolean> = _hasUnreadNotifications.asStateFlow()

    init {
        loadDataFromBackend()
    }

    fun refreshBackendData() {
        loadDataFromBackend()
    }

    private fun loadDataFromBackend() {
        viewModelScope.launch {
            val backendOrders = repository.fetchOrders()
            if (!backendOrders.isNullOrEmpty()) {
                _orders.value = backendOrders
            }

            val backendProducts = repository.fetchProducts()
            if (!backendProducts.isNullOrEmpty()) {
                _products.value = backendProducts
            }

            val backendTx = repository.fetchTransactions()
            if (!backendTx.isNullOrEmpty()) {
                _transactions.value = backendTx
            }

            val backendNotifs = repository.fetchNotifications()
            if (!backendNotifs.isNullOrEmpty()) {
                _notifications.value = backendNotifs
            }

            val backendCalendar = repository.fetchCalendarDays()
            if (!backendCalendar.isNullOrEmpty()) {
                _calendarDays.value = backendCalendar
            }
        }
    }

    fun computeKpis(currentOrders: List<Order>): DashboardKpis {
        val basePlaced = 47
        val baseDelivering = 13
        val baseDelivered = 126
        val baseCancelled = 2

        val placed = basePlaced + currentOrders.count { it.status == OrderStatus.PLACED }
        val delivering = baseDelivering + currentOrders.count { it.status == OrderStatus.DELIVERING }
        val delivered = baseDelivered + currentOrders.count { it.status == OrderStatus.DELIVERED }
        val cancelled = baseCancelled + currentOrders.count { it.status == OrderStatus.CANCELLED }

        return DashboardKpis(placed, delivering, delivered, cancelled)
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

    fun advanceOrderStatus(orderId: String): Order? {
        var updatedOrder: Order? = null
        _orders.update { list ->
            list.map { order ->
                if (order.id == orderId) {
                    val nextStatus = when (order.status) {
                        OrderStatus.PLACED -> OrderStatus.DELIVERING
                        OrderStatus.DELIVERING -> OrderStatus.DELIVERED
                        OrderStatus.DELIVERED -> OrderStatus.DELIVERED
                        OrderStatus.CANCELLED -> OrderStatus.CANCELLED
                    }
                    val nextOrder = order.copy(
                        status = nextStatus,
                        etaMinutes = if (nextStatus == OrderStatus.DELIVERED) 0 else order.etaMinutes
                    )
                    updatedOrder = nextOrder
                    nextOrder
                } else {
                    order
                }
            }
        }

        viewModelScope.launch {
            val backendResult = repository.advanceOrderStatus(orderId)
            if (backendResult != null) {
                _orders.update { list -> list.map { if (it.id == orderId) backendResult else it } }
            }
            refreshBackendData()
        }

        updatedOrder?.let { order ->
            if (order.status == OrderStatus.DELIVERED) {
                val txExists = _transactions.value.any { it.orderCode == "#${order.id}" }
                if (!txExists) {
                    val newTx = PaymentTransaction(
                        id = "tx-${order.id}",
                        orderCode = "#${order.id}",
                        methodTitle = "Đơn #${order.id} (${order.paymentType.label})",
                        subtitle = "15/11/2026 - Vừa đối soát thành công",
                        amount = order.total,
                        paymentType = order.paymentType
                    )
                    _transactions.update { listOf(newTx) + it }
                }
            }
        }
        return updatedOrder
    }

    fun updateOrderStatus(orderId: String, targetStatus: OrderStatus): Order? {
        var updatedOrder: Order? = null
        _orders.update { list ->
            list.map { order ->
                if (order.id == orderId) {
                    val nextOrder = order.copy(
                        status = targetStatus,
                        etaMinutes = if (targetStatus == OrderStatus.DELIVERED) 0 else order.etaMinutes
                    )
                    updatedOrder = nextOrder
                    nextOrder
                } else {
                    order
                }
            }
        }

        viewModelScope.launch {
            val backendResult = repository.updateOrderStatus(orderId, targetStatus)
            if (backendResult != null) {
                _orders.update { list -> list.map { if (it.id == orderId) backendResult else it } }
            }
            refreshBackendData()
        }

        updatedOrder?.let { order ->
            if (order.status == OrderStatus.DELIVERED) {
                val txExists = _transactions.value.any { it.orderCode == "#${order.id}" }
                if (!txExists) {
                    val newTx = PaymentTransaction(
                        id = "tx-${order.id}",
                        orderCode = "#${order.id}",
                        methodTitle = "Đơn #${order.id} (${order.paymentType.label})",
                        subtitle = "15/11/2026 - Vừa đối soát thành công",
                        amount = order.total,
                        paymentType = order.paymentType
                    )
                    _transactions.update { listOf(newTx) + it }
                }
            }
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

    fun createOrder(
        customerName: String,
        customerPhone: String,
        address: String,
        product: Product,
        quantity: Int,
        paymentType: PaymentType
    ): Order {
        val nextNum = 9822 + (_orders.value.size - 5).coerceAtLeast(0)
        val newId = "DH-$nextNum"
        val paymentLabel = when (paymentType) {
            PaymentType.COD -> "Thanh toán khi nhận hàng (COD)"
            PaymentType.BANK -> "Chuyển khoản ngân hàng (VCB)"
            PaymentType.WALLET -> "Ví điện tử MoMo"
            PaymentType.ALL -> "Thanh toán khi nhận hàng (COD)"
        }
        val newOrder = Order(
            id = newId,
            timeAgo = "Vừa xong",
            customerName = customerName,
            customerPhone = customerPhone,
            address = address,
            status = OrderStatus.PLACED,
            items = listOf(OrderItem(product.name, quantity, product.price)),
            shippingFee = 30000L,
            paymentMethodLabel = paymentLabel,
            paymentType = paymentType
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
        _notifications.update {
            listOf(
                NotificationItem(
                    id = "notif-$newId",
                    title = "Đơn hàng mới #$newId",
                    message = "$customerName vừa đặt ${quantity}x ${product.name}.",
                    timeAgo = "Vừa xong"
                )
            ) + it
        }
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

        viewModelScope.launch {
            repository.createProduct(name, category, price, stock, description, imageUrl)
            refreshBackendData()
        }
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
        viewModelScope.launch {
            repository.updateProduct(productId, name, category, price, stock, description, imageUrl)
            refreshBackendData()
        }
    }

    fun getIncomeData(period: IncomePeriod): IncomePeriodData {
        return when (period) {
            IncomePeriod.WEEK -> IncomePeriodData(
                period = IncomePeriod.WEEK,
                heroLabel = "DÒNG THU NHẬP TUẦN NÀY",
                totalFormatted = "34.850.000 VNĐ",
                growthPercent = "+14.2%",
                codFormatted = "21.400.000đ",
                bankFormatted = "13.450.000đ",
                avgFormatted = "4.970.000đ",
                peakText = "Đỉnh điểm: 8.5tr (Thứ 6)",
                maxAxisValue = 9f,
                bars = listOf(
                    IncomeBarPoint("T2", 4.2f, "4,2TR"),
                    IncomeBarPoint("T3", 3.8f, "3,8TR"),
                    IncomeBarPoint("T4", 5.1f, "5,1TR"),
                    IncomeBarPoint("T5", 4.6f, "4,6TR"),
                    IncomeBarPoint("T6", 8.5f, "8,5TR"),
                    IncomeBarPoint("T7", 6.2f, "6,2TR"),
                    IncomeBarPoint("CN", 2.45f, "2,5TR")
                )
            )
            IncomePeriod.MONTH -> IncomePeriodData(
                period = IncomePeriod.MONTH,
                heroLabel = "DÒNG THU NHẬP THÁNG 11",
                totalFormatted = "142.600.000 VNĐ",
                growthPercent = "+18.6%",
                codFormatted = "84.200.000đ",
                bankFormatted = "58.400.000đ",
                avgFormatted = "35.650.000đ",
                peakText = "Đỉnh điểm: 42.5tr (Tuần 3)",
                maxAxisValue = 45f,
                bars = listOf(
                    IncomeBarPoint("T.42", 28.4f, "28,4TR"),
                    IncomeBarPoint("T.43", 36.8f, "36,8TR"),
                    IncomeBarPoint("T.44", 42.5f, "42,5TR"),
                    IncomeBarPoint("T.45", 34.9f, "34,9TR")
                )
            )
            IncomePeriod.YEAR -> IncomePeriodData(
                period = IncomePeriod.YEAR,
                heroLabel = "DÒNG THU NHẬP NĂM 2026",
                totalFormatted = "1.480.000.000 VNĐ",
                growthPercent = "+24.8%",
                codFormatted = "860.000.000đ",
                bankFormatted = "620.000.000đ",
                avgFormatted = "123.300.000đ",
                peakText = "Đỉnh điểm: 185tr (T11)",
                maxAxisValue = 200f,
                bars = listOf(
                    IncomeBarPoint("T6", 98f, "98TR"),
                    IncomeBarPoint("T7", 112f, "112TR"),
                    IncomeBarPoint("T8", 125f, "125TR"),
                    IncomeBarPoint("T9", 140f, "140TR"),
                    IncomeBarPoint("T10", 162f, "162TR"),
                    IncomeBarPoint("T11", 185f, "185TR")
                )
            )
        }
    }

    private fun seedOrders(): List<Order> = listOf(
        Order(
            id = "DH-9821",
            timeAgo = "10 phút trước",
            customerName = "Nguyễn Văn An",
            customerPhone = "0988 123 456",
            address = "45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM",
            status = OrderStatus.DELIVERING,
            items = listOf(OrderItem("Áo Thun Nam Co Giãn Premium", 2, 210000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
            paymentType = PaymentType.COD,
            etaMinutes = 12,
            distanceKm = 2.4
        ),
        Order(
            id = "DH-9820",
            timeAgo = "25 phút trước",
            customerName = "Trần Thị Mai",
            customerPhone = "0912 999 888",
            address = "102 Võ Văn Tần, Q.3, TP.HCM",
            status = OrderStatus.PLACED,
            items = listOf(OrderItem("Tai Nghe Chống Ồn Viễn Đông ANC", 1, 1220000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Chuyển khoản ngân hàng (VCB)",
            paymentType = PaymentType.BANK,
            etaMinutes = 25,
            distanceKm = 3.1
        ),
        Order(
            id = "DH-9819",
            timeAgo = "2 giờ trước",
            customerName = "Lê Hoàng Long",
            customerPhone = "0933 444 555",
            address = "78 Nguyễn Thị Minh Khai, Q.1, TP.HCM",
            status = OrderStatus.DELIVERED,
            items = listOf(OrderItem("Hub USB-C Đa Năng 7-in-1", 1, 820000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Ví điện tử MoMo",
            paymentType = PaymentType.WALLET,
            etaMinutes = 0,
            distanceKm = 1.2
        ),
        Order(
            id = "DH-9818",
            timeAgo = "Hôm qua",
            customerName = "Phạm Quốc Bảo",
            customerPhone = "0977 111 222",
            address = "12 Đường số 5, Q.7, TP.HCM",
            status = OrderStatus.CANCELLED,
            items = listOf(OrderItem("Combo Áo Polo Doanh Nghiệp", 5, 420000L)),
            shippingFee = 0L,
            paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
            paymentType = PaymentType.COD,
            etaMinutes = 0,
            distanceKm = 6.5
        ),
        Order(
            id = "DH-9817",
            timeAgo = "Hôm qua",
            customerName = "Đặng Thu Thảo",
            customerPhone = "0908 777 666",
            address = "55 Điện Biên Phủ, Bình Thạnh, TP.HCM",
            status = OrderStatus.DELIVERED,
            items = listOf(OrderItem("Củ Sạc Nhanh GaN 65W Viễn Đông", 2, 325000L)),
            shippingFee = 30000L,
            paymentMethodLabel = "Thanh toán khi nhận hàng (COD)",
            paymentType = PaymentType.COD,
            etaMinutes = 0,
            distanceKm = 3.8
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

    private fun seedCalendarDays(): List<CalendarDaySummary> = listOf(
        CalendarDaySummary(11, "Thg 11", "Ngày 11/11/2026", 18, 18, 0),
        CalendarDaySummary(12, "Thg 11", "Ngày 12/11/2026", 9, 9, 0),
        CalendarDaySummary(13, "Thg 11", "Ngày 13/11/2026", 14, 14, 0),
        CalendarDaySummary(14, "Thg 11", "Ngày 14/11/2026", 11, 10, 1),
        CalendarDaySummary(15, "Thg 11", "Ngày 15/11/2026", 12, 10, 2),
        CalendarDaySummary(16, "Thg 11", "Ngày 16/11/2026", 7, 5, 2),
        CalendarDaySummary(17, "Thg 11", "Ngày 17/11/2026", 5, 3, 2)
    )

    private fun seedTransactions(): List<PaymentTransaction> = listOf(
        PaymentTransaction(
            id = "tx-1",
            orderCode = "#DH-9821",
            methodTitle = "Đơn #DH-9821 (COD)",
            subtitle = "15/11/2026 - Thu bởi Shipper",
            amount = 450000L,
            paymentType = PaymentType.COD
        ),
        PaymentTransaction(
            id = "tx-2",
            orderCode = "#DH-9820",
            methodTitle = "Đơn #DH-9820 (Chuyển khoản)",
            subtitle = "15/11/2026 - Ngân hàng Vietcombank",
            amount = 1250000L,
            paymentType = PaymentType.BANK
        ),
        PaymentTransaction(
            id = "tx-3",
            orderCode = "#DH-9819",
            methodTitle = "Đơn #DH-9819 (Ví MoMo)",
            subtitle = "15/11/2026 - Ví điện tử",
            amount = 850000L,
            paymentType = PaymentType.WALLET
        )
    )

    private fun seedNotifications(): List<NotificationItem> = listOf(
        NotificationItem(
            id = "n-1",
            title = "Shipper đang giao #DH-9821",
            message = "Đơn hàng của Nguyễn Văn An đang trên đường Lê Văn Sỹ, dự kiến giao sau 12 phút.",
            timeAgo = "10 phút trước",
            isAlert = true
        ),
        NotificationItem(
            id = "n-2",
            title = "Đơn mới #DH-9820 đã thanh toán VCB",
            message = "Trần Thị Mai đã chuyển khoản 1.250.000đ. Chờ xuất kho đóng gói.",
            timeAgo = "25 phút trước"
        ),
        NotificationItem(
            id = "n-3",
            title = "Cảnh báo tồn kho thấp",
            message = "Hub USB-C 7-in-1 (còn 8) và Củ Sạc GaN 65W (còn 6) cần nhập thêm.",
            timeAgo = "1 giờ trước",
            isAlert = true
        )
    )
}
