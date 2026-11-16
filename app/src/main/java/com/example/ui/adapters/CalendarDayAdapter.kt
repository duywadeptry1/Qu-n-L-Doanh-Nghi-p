package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemCalendarDayBinding
import com.example.model.CalendarDaySummary

class CalendarDayAdapter(
    private val onDaySelected: (CalendarDaySummary) -> Unit
) : RecyclerView.Adapter<CalendarDayAdapter.DayViewHolder>() {

    private var days: List<CalendarDaySummary> = emptyList()
    private var selectedDayNumber: Int = 15

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
            binding.tvMonthLabel.text = item.monthLabel
            binding.tvDayNumber.text = item.dayNumber.toString()

            if (isSelected) {
                binding.containerDay.setBackgroundResource(R.drawable.bg_calendar_day_selected)
                binding.tvMonthLabel.setTextColor(ContextCompat.getColor(ctx, R.color.blue_icon_bg))
                binding.tvDayNumber.setTextColor(ContextCompat.getColor(ctx, R.color.white))
            } else {
                binding.containerDay.setBackgroundResource(R.drawable.bg_calendar_day_normal)
                binding.tvMonthLabel.setTextColor(ContextCompat.getColor(ctx, R.color.text_hint))
                binding.tvDayNumber.setTextColor(ContextCompat.getColor(ctx, R.color.text_primary))
            }

            binding.containerDay.setOnClickListener {
                onDaySelected(item)
            }
        }
    }
}
