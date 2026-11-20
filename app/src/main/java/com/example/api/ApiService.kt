package com.example.api

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {

    @GET("health")
    suspend fun health(): ApiHealth

    @GET("orders")
    suspend fun getOrders(
        @Query("filter") filter: String? = null,
        @Query("search") search: String? = null
    ): List<ApiOrder>

    @GET("orders/{id}")
    suspend fun getOrderById(@Path("id") id: String): ApiOrder

    @POST("orders")
    suspend fun createOrder(@Body request: CreateOrderRequest): ApiOrder

    @PATCH("orders/{id}/status")
    suspend fun advanceOrderStatus(@Path("id") id: String): ApiOrder

    @PATCH("orders/{id}/status")
    suspend fun updateOrderStatus(
        @Path("id") id: String,
        @Body request: Map<String, String>
    ): ApiOrder

    @GET("products")
    suspend fun getProducts(
        @Query("category") category: String? = null,
        @Query("search") search: String? = null
    ): List<ApiProduct>

    @POST("products")
    suspend fun createProduct(@Body request: CreateProductRequest): ApiProduct

    @POST("products/bulk")
    suspend fun bulkCreateProducts(@Body request: BulkCreateProductsRequest): BulkCreateProductsResponse

    @retrofit2.http.PUT("products/{id}")
    suspend fun updateProduct(
        @Path("id") id: String,
        @Body request: CreateProductRequest
    ): ApiProduct

    @PATCH("products/{id}/restock")
    suspend fun restockProduct(
        @Path("id") id: String,
        @Body request: RestockRequest = RestockRequest(10)
    ): ApiProduct

    @retrofit2.http.DELETE("products/{id}")
    suspend fun deleteProduct(
        @Path("id") id: String
    ): retrofit2.Response<Unit>

    @GET("transactions")
    suspend fun getTransactions(
        @Query("type") type: String? = null
    ): List<ApiTransaction>

    @GET("notifications")
    suspend fun getNotifications(): List<ApiNotification>

    @GET("calendar")
    suspend fun getCalendarDays(): List<ApiCalendarDay>

    @GET("dashboard/kpis")
    suspend fun getDashboardKpis(): ApiDashboardKpis
}
