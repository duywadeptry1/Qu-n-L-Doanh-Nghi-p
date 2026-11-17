package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.model.OrderStatus
import com.example.model.PaymentType
import com.example.viewmodel.SalesViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

    @Test
    fun `read string from context`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val appName = context.getString(R.string.app_name)
        assertEquals("Viễn Đông", appName)
    }

    @Test
    fun `advancing order status through 4 stages updates KPIs and records transaction`() {
        val vm = SalesViewModel()
        val initialTxCount = vm.transactions.value.size
        val product = vm.products.value.first()

        // Step 1: Khách hàng đặt hàng (PLACED)
        val created = vm.createOrder(
            customerName = "Khách Test",
            customerPhone = "0909 111 222",
            address = "123 Lê Lợi, Q.1, TP.HCM",
            product = product,
            quantity = 1,
            paymentType = PaymentType.COD
        )
        assertEquals(OrderStatus.PLACED, created.status)

        // Step 2: Duyệt đơn và chuẩn bị hàng (PREPARING)
        val preparing = vm.advanceOrderStatus(created.id)
        assertEquals(OrderStatus.PREPARING, preparing?.status)

        // Step 3: Giao cho đơn vị vận chuyển (DELIVERING)
        val delivering = vm.advanceOrderStatus(created.id)
        assertEquals(OrderStatus.DELIVERING, delivering?.status)

        // Step 4: Đơn hàng đã đến tay khách hàng (DELIVERED)
        val delivered = vm.advanceOrderStatus(created.id)
        assertEquals(OrderStatus.DELIVERED, delivered?.status)
        assertTrue(vm.transactions.value.size > initialTxCount)
    }
}
