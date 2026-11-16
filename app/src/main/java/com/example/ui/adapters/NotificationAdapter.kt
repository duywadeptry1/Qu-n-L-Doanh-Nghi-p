package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemNotificationBinding
import com.example.model.NotificationItem

class NotificationAdapter : RecyclerView.Adapter<NotificationAdapter.NotifViewHolder>() {

    private var items: List<NotificationItem> = emptyList()

    fun submitList(list: List<NotificationItem>) {
        items = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): NotifViewHolder {
        val binding = ItemNotificationBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return NotifViewHolder(binding)
    }

    override fun onBindViewHolder(holder: NotifViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class NotifViewHolder(
        private val binding: ItemNotificationBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: NotificationItem) {
            val ctx = binding.root.context
            binding.tvNotifTitle.text = item.title
            binding.tvNotifMessage.text = item.message
            binding.tvNotifTime.text = item.timeAgo

            if (item.isAlert) {
                binding.ivNotifIcon.setBackgroundResource(R.drawable.bg_icon_square_amber)
                binding.ivNotifIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.amber_text))
            } else {
                binding.ivNotifIcon.setBackgroundResource(R.drawable.bg_icon_square_blue)
                binding.ivNotifIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.primary_blue))
            }
        }
    }
}
