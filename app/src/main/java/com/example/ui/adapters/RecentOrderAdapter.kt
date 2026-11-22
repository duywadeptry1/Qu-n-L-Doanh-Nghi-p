package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemRecentOrderBinding
import com.example.model.AppClock
import com.example.model.CurrencyFormatter
import com.example.model.Order
import com.example.model.OrderStatus

class RecentOrderAdapter(
    private val onOrderClick: (Order) -> Unit
) : RecyclerView.Adapter<RecentOrderAdapter.RecentOrderViewHolder>() {

    private var orders: List<Order> = emptyList()

    fun submitList(list: List<Order>) {
        orders = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecentOrderViewHolder {
        val binding = ItemRecentOrderBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return RecentOrderViewHolder(binding)
    }

    override fun onBindViewHolder(holder: RecentOrderViewHolder, position: Int) {
        holder.bind(orders[position])
    }

    override fun getItemCount(): Int = orders.size

    inner class RecentOrderViewHolder(
        private val binding: ItemRecentOrderBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(order: Order) {
            val ctx = binding.root.context
            binding.tvCustomerName.text = "${order.customerName} (#${order.id})"
            binding.tvTimeAgo.text = AppClock.orderDisplayTime(order)
            binding.tvCustomerPhone.text = order.customerPhone
            binding.tvCustomerAddress.text = order.address
            binding.tvOrderAmount.text = CurrencyFormatter.formatVnd(order.total)
            binding.tvStatusBadge.text = order.status.label

            when (order.status) {
                OrderStatus.PLACED -> {
                    binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_blue)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
                }
                OrderStatus.PREPARING -> {
                    binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_blue)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.indigo_primary))
                }
                OrderStatus.DELIVERING -> {
                    binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_amber)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.amber_text))
                }
                OrderStatus.DELIVERED -> {
                    binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_green)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
                }
                OrderStatus.CANCELLED -> {
                    binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_red)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.red_primary))
                }
            }

            binding.root.setOnClickListener { onOrderClick(order) }
        }
    }
}
