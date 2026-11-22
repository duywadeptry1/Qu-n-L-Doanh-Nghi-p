package com.example

import com.example.model.CreateOrderResult
import com.example.model.IncomeChartMetric
import com.example.model.IncomePeriod
import com.example.model.InsufficientStockException
import com.example.model.PaymentType
import com.example.model.SalesChannel
import com.example.model.VipTier
import com.example.viewmodel.SalesViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class SalesBusinessLogicTest {

    @Test
    fun `VIP shipping discount never goes below shipping cost floor`() {
        val diamond = VipTier.calculatePricing(
            unitPrice = 1_000_000L,
            importPrice = 700_000L,
            quantity = 1,
            isDemoProduct = true,
            existingOrderCount = 10,
            baseShippingFee = 30_000L
        )
        assertEquals(VipTier.VIP_DIAMOND, diamond.tier)
        assertEquals(15_000L, diamond.shippingDiscount)
        assertEquals(VipTier.SHIPPING_BASE_COST, diamond.finalShippingFee)
        assertTrue(diamond.finalShippingFee >= diamond.shippingCost)

        // Even if base shipping fee is already close to cost, discount is capped at cost floor
        val tightShipping = VipTier.calculatePricing(
            unitPrice = 1_000_000L,
            importPrice = 700_000L,
            quantity = 1,
            isDemoProduct = false,
            existingOrderCount = 10,
            baseShippingFee = 18_000L
        )
        assertEquals(3_000L, tightShipping.shippingDiscount)
        assertEquals(15_000L, tightShipping.finalShippingFee)
    }

    @Test
    fun `VIP demo product discount applies only on demo products and never below import cost`() {
        val nonDemo = VipTier.calculatePricing(
            unitPrice = 1_000_000L,
            importPrice = 700_000L,
            quantity = 1,
            isDemoProduct = false,
            existingOrderCount = 5
        )
        assertEquals(VipTier.VIP_GOLD, nonDemo.tier)
        assertEquals(0L, nonDemo.vipProductDiscount)

        // Demo product with thin margin: 20% would be 200k, capped at 50k (export - import)
        val thinMarginDemo = VipTier.calculatePricing(
            unitPrice = 1_000_000L,
            importPrice = 950_000L,
            quantity = 1,
            isDemoProduct = true,
            existingOrderCount = 6
        )
        assertEquals(50_000L, thinMarginDemo.vipProductDiscount)
        assertTrue(thinMarginDemo.estimatedProfit >= 0L)
    }

    @Test
    fun `SalesViewModel computes revenue, profit, B2B vs B2C stats and VIP profiles`() {
        val vm = SalesViewModel()
        val revenueData = vm.getIncomeData(IncomePeriod.MONTH, metric = IncomeChartMetric.REVENUE)
        val profitData = vm.getIncomeData(IncomePeriod.MONTH, metric = IncomeChartMetric.PROFIT)

        assertTrue(revenueData.b2bStats.orderCount > 0)
        assertTrue(revenueData.b2cStats.orderCount > 0)
        assertEquals(100, revenueData.b2bStats.sharePercent + revenueData.b2cStats.sharePercent)
        assertTrue(revenueData.b2bStats.profit > 0L)
        assertTrue(revenueData.b2cStats.profit > 0L)
        assertEquals(IncomeChartMetric.PROFIT, profitData.metric)

        val profiles = vm.getCustomerProfiles()
        val topRep = profiles.first()
        assertEquals(SalesChannel.B2B, topRep.primaryChannel)
        assertTrue(topRep.vipTier.isVip)
        assertTrue(topRep.orderCount >= 4)
    }

    @Test
    fun `trades are locked when requested quantity exceeds inventory and unlocked after restock`() {
        val vm = SalesViewModel()
        // Pick a product with low stock (p-5 has stock = 6)
        val lowStockProduct = vm.products.value.first { it.id == "p-5" }
        assertEquals(6, lowStockProduct.stock)
        val initialOrderCount = vm.orders.value.size

        // 1. Requesting more than available stock locks the trade without mutating state
        val overRequest = vm.tryCreateOrder(
            customerName = "Khách B2B",
            customerPhone = "0900 111 333",
            address = "10 Lê Duẩn, Q.1, TP.HCM",
            product = lowStockProduct,
            quantity = 10,
            paymentType = PaymentType.BANK,
            salesChannel = SalesChannel.B2B
        )
        assertTrue(overRequest is CreateOrderResult.TradeLocked)
        val lockInfo = (overRequest as CreateOrderResult.TradeLocked).lockStatus
        assertTrue(lockInfo.isLocked)
        assertEquals(6, lockInfo.availableStock)
        assertEquals(10, lockInfo.requestedQuantity)
        assertEquals(4, lockInfo.shortage)
        assertEquals(initialOrderCount, vm.orders.value.size)
        assertEquals(6, vm.products.value.first { it.id == "p-5" }.stock)

        // 2. Ordering exact remaining stock (6) succeeds and drops stock to 0
        val exactOrder = vm.tryCreateOrder(
            customerName = "Khách B2B",
            customerPhone = "0900 111 333",
            address = "10 Lê Duẩn, Q.1, TP.HCM",
            product = lowStockProduct,
            quantity = 6,
            paymentType = PaymentType.BANK,
            salesChannel = SalesChannel.B2B
        )
        assertTrue(exactOrder is CreateOrderResult.Success)
        val depleted = vm.products.value.first { it.id == "p-5" }
        assertEquals(0, depleted.stock)
        assertTrue(depleted.isTradeLocked)
        assertTrue(vm.notifications.value.any { it.id == "notif-trade-locked" })

        // 3. Any subsequent trade on depleted product is locked (both tryCreateOrder & createOrder)
        val blockedWhenZero = vm.tryCreateOrder(
            customerName = "Khách Lẻ",
            customerPhone = "0911 222 333",
            address = "20 Hai Bà Trưng, Q.1",
            product = depleted,
            quantity = 1,
            paymentType = PaymentType.COD
        )
        assertTrue(blockedWhenZero is CreateOrderResult.TradeLocked)
        try {
            vm.createOrder(
                customerName = "Khách Lẻ",
                customerPhone = "0911 222 333",
                address = "20 Hai Bà Trưng, Q.1",
                product = depleted,
                quantity = 1,
                paymentType = PaymentType.COD
            )
            fail("Expected InsufficientStockException when product stock is 0")
        } catch (expected: InsufficientStockException) {
            assertTrue(expected.lockStatus.isLocked)
            assertEquals(0, expected.lockStatus.availableStock)
        }

        // 4. Restocking automatically unlocks trades
        vm.restockProduct("p-5", 10)
        val restocked = vm.products.value.first { it.id == "p-5" }
        assertEquals(10, restocked.stock)
        assertFalse(restocked.isTradeLocked)
        val unlockedOrder = vm.tryCreateOrder(
            customerName = "Khách Lẻ",
            customerPhone = "0911 222 333",
            address = "20 Hai Bà Trưng, Q.1",
            product = restocked,
            quantity = 3,
            paymentType = PaymentType.COD
        )
        assertTrue(unlockedOrder is CreateOrderResult.Success)
        assertEquals(7, vm.products.value.first { it.id == "p-5" }.stock)
    }
}
