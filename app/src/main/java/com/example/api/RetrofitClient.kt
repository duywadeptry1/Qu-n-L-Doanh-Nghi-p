package com.example.api

import android.content.Context
import android.content.SharedPreferences
import com.example.BuildConfig
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
    private const val KEY_DEFAULT_SNAPSHOT = "default_url_snapshot"

    const val USB_LOCALHOST_URL = "http://127.0.0.1:5000/api/"
    const val LAN_FALLBACK_URL = "http://192.168.0.101:5000/api/"
    const val EMULATOR_URL = "http://10.0.2.2:5000/api/"

    val defaultBaseUrl: String = normalizeApiUrl(BuildConfig.BACKEND_URL)

    private var currentBaseUrl = defaultBaseUrl
    private var sharedPreferences: SharedPreferences? = null

    private val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        // Use a fast 3s connect timeout for local/LAN IPs so unreachable subnets fail fast,
        // while keeping 30s for cloud hosts (e.g. Render cold start).
        .addInterceptor { chain ->
            val host = chain.request().url.host
            val isLocal = host == "localhost" ||
                host == "127.0.0.1" ||
                host == "10.0.2.2" ||
                host.startsWith("192.168.") ||
                host.startsWith("10.")
            val connectTimeoutSec = if (isLocal) 3 else 30
            chain.withConnectTimeout(connectTimeoutSec, TimeUnit.SECONDS)
                .proceed(chain.request())
        }
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
        })
        .build()

    private var _apiService: ApiService? = null

    fun init(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        sharedPreferences = prefs

        // When the build-time default (BACKEND_URL in .env) changes, drop any stale manual override
        // so a fresh build always talks to the newly configured server.
        if (prefs.getString(KEY_DEFAULT_SNAPSHOT, null) != defaultBaseUrl) {
            prefs.edit()
                .remove(KEY_BASE_URL)
                .putString(KEY_DEFAULT_SNAPSHOT, defaultBaseUrl)
                .apply()
        }

        val savedUrl = prefs.getString(KEY_BASE_URL, null)
        currentBaseUrl = if (savedUrl.isNullOrBlank()) defaultBaseUrl else normalizeApiUrl(savedUrl)
        _apiService = null
    }

    val apiService: ApiService
        get() {
            if (_apiService == null) {
                _apiService = createApiService(currentBaseUrl)
            }
            return _apiService!!
        }

    fun updateBaseUrl(newUrl: String) {
        currentBaseUrl = normalizeApiUrl(newUrl)
        sharedPreferences?.edit()?.putString(KEY_BASE_URL, currentBaseUrl)?.apply()
        _apiService = createApiService(currentBaseUrl)
    }

    /** Switches the active URL in memory (used by auto-fallback when probing USB vs LAN). */
    fun switchActiveUrl(url: String) {
        currentBaseUrl = normalizeApiUrl(url)
        _apiService = createApiService(currentBaseUrl)
    }

    /** Removes the manual override and goes back to BuildConfig.BACKEND_URL. */
    fun resetToDefault() {
        currentBaseUrl = defaultBaseUrl
        sharedPreferences?.edit()?.remove(KEY_BASE_URL)?.apply()
        _apiService = createApiService(currentBaseUrl)
    }

    fun getBaseUrl(): String = currentBaseUrl

    /** Candidate URLs in priority order for automatic connection recovery. */
    fun candidateUrls(): List<String> = listOf(
        currentBaseUrl,
        USB_LOCALHOST_URL,
        LAN_FALLBACK_URL,
        defaultBaseUrl,
        EMULATOR_URL
    ).map { normalizeApiUrl(it) }.distinct()

    fun createTempApiService(url: String): ApiService = createApiService(normalizeApiUrl(url))

    private fun normalizeApiUrl(url: String): String {
        val withSlash = url.trim().let { if (it.endsWith("/")) it else "$it/" }
        return if (withSlash.endsWith("api/")) withSlash else "${withSlash}api/"
    }

    private fun createApiService(url: String): ApiService {
        return Retrofit.Builder()
            .baseUrl(url)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(ApiService::class.java)
    }
}
