package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemCalendarDayBinding
import com.example.model.AppClock
import com.example.model.CalendarDaySummary

class CalendarDayAdapter(
    private val onDaySelected: (CalendarDaySummary) -> Unit
) : RecyclerView.Adapter<CalendarDayAdapter.DayViewHolder>() {

    private var days: List<CalendarDaySummary> = emptyList()
    private var selectedDayNumber: Int = AppClock.todayDayOfMonth()

    fun submitList(newDays: List<CalendarDaySummary>, selectedDay: Int) {
        days = newDays
        selectedDayNumber = selectedDay
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): DayViewHolder {
        val binding = ItemCalendarDayBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return DayViewHolder(binding)
    }

    override fun onBindViewHolder(holder: DayViewHolder, position: Int) {
        holder.bind(days[position], days[position].dayNumber == selectedDayNumber)
    }

    override fun getItemCount(): Int = days.size

    inner class DayViewHolder(
        private val binding: ItemCalendarDayBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: CalendarDaySummary, isSelected: Boolean) {
            val ctx = binding.root.context
            val isToday = item.dayNumber == AppClock.todayDayOfMonth()
            binding.tvMonthLabel.text = if (isToday) "Hôm nay" else item.monthLabel
            binding.tvDayNumber.text = String.format("%02d", item.dayNumber)

            binding.tvDayBadge.text = when {
                item.isFuture -> "--"
                item.totalOrders > 0 -> "${item.totalOrders} đơn"
                else -> "0 đơn"
            }

            binding.containerDay.alpha = if (item.isFuture && !isSelected) 0.55f else 1.0f

            if (isSelected) {
                binding.containerDay.setBackgroundResource(R.drawable.bg_calendar_day_selected)
                binding.tvMonthLabel.setTextColor(ContextCompat.getColor(ctx, R.color.blue_icon_bg))
                binding.tvDayNumber.setTextColor(ContextCompat.getColor(ctx, R.color.white))
                binding.tvDayBadge.setTextColor(ContextCompat.getColor(ctx, R.color.white))
            } else {
                binding.containerDay.setBackgroundResource(R.drawable.bg_calendar_day_normal)
                binding.tvMonthLabel.setTextColor(
                    ContextCompat.getColor(
                        ctx,
                        if (isToday) R.color.primary_blue else R.color.text_hint
                    )
                )
                binding.tvDayNumber.setTextColor(
                    ContextCompat.getColor(
                        ctx,
                        if (item.isFuture) R.color.text_hint else R.color.text_primary
                    )
                )
                binding.tvDayBadge.setTextColor(
                    ContextCompat.getColor(
                        ctx,
                        when {
                            item.isFuture -> R.color.text_hint
                            item.totalOrders > 0 -> R.color.primary_blue
                            else -> R.color.text_muted
                        }
                    )
                )
            }

            binding.containerDay.setOnClickListener {
                onDaySelected(item)
            }
        }
    }
}
