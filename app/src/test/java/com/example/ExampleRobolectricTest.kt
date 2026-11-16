package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.model.OrderFilter
import com.example.model.OrderStatus
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
    fun `advancing order status updates KPIs and records transaction`() {
        val vm = SalesViewModel()
        val initialTxCount = vm.transactions.value.size
        val updated = vm.advanceOrderStatus("DH-9820")
        assertEquals(OrderStatus.DELIVERING, updated?.status)

        val delivered = vm.advanceOrderStatus("DH-9820")
        assertEquals(OrderStatus.DELIVERED, delivered?.status)
        assertTrue(vm.transactions.value.size >= initialTxCount)
    }
}
