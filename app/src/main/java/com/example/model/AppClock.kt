package com.example.model

import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Real-time date helpers pinned to the business time zone (Vietnam), matching the backend's
 * `dateUtils.js`. Uses java.util APIs because minSdk is 24 (no java.time without desugaring).
 */
object AppClock {
    val zone: TimeZone = TimeZone.getTimeZone("Asia/Ho_Chi_Minh")

    /** Calendar-day key (month is 1-based). */
    data class Day(val year: Int, val month: Int, val day: Int)

    fun now(): Calendar = Calendar.getInstance(zone)

    fun today(): Day = now().toDay()

    fun todayDayOfMonth(): Int = today().day

    fun daysInCurrentMonth(): Int = now().getActualMaximum(Calendar.DAY_OF_MONTH)

    /** Day [offset] days from today (negative = past). */
    fun dayOffsetFromToday(offset: Int): Day = now().apply { add(Calendar.DAY_OF_MONTH, offset) }.toDay()

    /** Year/month [offset] months from the current month (negative = past). */
    fun monthOffsetFromCurrent(offset: Int): Pair<Int, Int> {
        val cal = now().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            add(Calendar.MONTH, offset)
        }
        return cal.get(Calendar.YEAR) to (cal.get(Calendar.MONTH) + 1)
    }

    fun Calendar.toDay(): Day =
        Day(get(Calendar.YEAR), get(Calendar.MONTH) + 1, get(Calendar.DAY_OF_MONTH))

    private fun formatter(pattern: String) = SimpleDateFormat(pattern, Locale.US).apply { timeZone = zone }

    /** "dd/MM/yyyy" */
    fun formatDate(date: Date = Date()): String = formatter("dd/MM/yyyy").format(date)

    /** "dd/MM/yyyy" for a calendar-day key */
    fun formatDay(day: Day): String = String.format(Locale.US, "%02d/%02d/%04d", day.day, day.month, day.year)

    /** "dd/MM/yyyy • HH:mm" (same format the backend stores in Order.timeAgo) */
    fun formatOrderTime(date: Date = Date()): String = formatter("dd/MM/yyyy • HH:mm").format(date)

    /** ISO-8601 with offset, e.g. 2026-11-22T12:30:00+07:00 */
    fun toIso(date: Date = Date()): String = formatter("yyyy-MM-dd'T'HH:mm:ssXXX").format(date)

    /** Parses backend/local ISO-8601 timestamps (with or without millis, `Z` or `+07:00`). */
    fun parseIso(value: String): Date? {
        if (value.isBlank()) return null
        val patterns = listOf("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX")
        for (pattern in patterns) {
            try {
                return formatter(pattern).parse(value)
            } catch (_: ParseException) {
                // try next pattern
            }
        }
        return null
    }

    private val dayLabelRegex = Regex("""(\d{1,2})/(\d{1,2})/(\d{4})""")

    /** Calendar day an order belongs to: from createdAt first, then the "dd/MM/yyyy" in timeAgo. */
    fun orderDay(order: Order): Day? {
        parseIso(order.createdAt)?.let { date ->
            return Calendar.getInstance(zone).apply { time = date }.toDay()
        }
        val match = dayLabelRegex.find(order.timeAgo) ?: return null
        val (d, m, y) = match.destructured
        return Day(y.toInt(), m.toInt(), d.toInt())
    }

    /** Human-readable time for an order, e.g. "22/11/2026 • 12:30". */
    fun orderDisplayTime(order: Order): String {
        if (dayLabelRegex.containsMatchIn(order.timeAgo)) return order.timeAgo
        return parseIso(order.createdAt)?.let { formatOrderTime(it) } ?: order.timeAgo
    }
}
