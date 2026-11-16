package com.example.api

import android.content.Context
import android.content.SharedPreferences
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    private const val PREFS_NAME = "backend_config"
    private const val KEY_BASE_URL = "base_url"

    private var currentBaseUrl = "http://10.0.2.2:5000/api/"
    private var sharedPreferences: SharedPreferences? = null

    private val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .build()

    private var _apiService: ApiService? = null

    fun init(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        sharedPreferences = prefs
        val savedUrl = prefs.getString(KEY_BASE_URL, null)
        if (!savedUrl.isNullOrBlank()) {
            currentBaseUrl = savedUrl
        }
    }

    val apiService: ApiService
        get() {
            if (_apiService == null) {
                _apiService = createApiService(currentBaseUrl)
            }
            return _apiService!!
        }

    fun updateBaseUrl(newUrl: String) {
        val formattedUrl = if (newUrl.endsWith("/")) newUrl else "$newUrl/"
        val fullApiUrl = if (formattedUrl.endsWith("api/")) formattedUrl else "${formattedUrl}api/"
        currentBaseUrl = fullApiUrl
        sharedPreferences?.edit()?.putString(KEY_BASE_URL, fullApiUrl)?.apply()
        _apiService = createApiService(currentBaseUrl)
    }

    fun getBaseUrl(): String = currentBaseUrl

    private fun createApiService(url: String): ApiService {
        return Retrofit.Builder()
            .baseUrl(url)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(ApiService::class.java)
    }
}
