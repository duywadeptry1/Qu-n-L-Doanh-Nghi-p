package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemOrderCardBinding
import com.example.model.CurrencyFormatter
import com.example.model.Order
import com.example.model.OrderStatus

class OrderCardAdapter(
    private val onOrderClick: (Order) -> Unit
) : RecyclerView.Adapter<OrderCardAdapter.OrderViewHolder>() {

    private var orders: List<Order> = emptyList()

    fun submitList(list: List<Order>) {
        orders = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): OrderViewHolder {
        val binding = ItemOrderCardBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return OrderViewHolder(binding)
    }

    override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
        holder.bind(orders[position])
    }

    override fun getItemCount(): Int = orders.size

    inner class OrderViewHolder(
        private val binding: ItemOrderCardBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(order: Order) {
            val ctx = binding.root.context
            binding.tvOrderCode.text = order.id
            binding.tvOrderTime.text = "(${order.timeAgo})"
            binding.tvOrderCustomerName.text = order.customerName
            binding.tvOrderCustomerPhone.text = " - ${order.customerPhone}"
            binding.tvOrderAddress.text = order.address
            binding.tvOrderTotal.text = CurrencyFormatter.formatVnd(order.total)
            binding.tvOrderStatusBadge.text = order.status.label

            when (order.status) {
                OrderStatus.PLACED -> {
                    binding.tvOrderStatusBadge.setBackgroundResource(R.drawable.bg_pill_blue)
                    binding.tvOrderStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
                }
                OrderStatus.DELIVERING -> {
                    binding.tvOrderStatusBadge.setBackgroundResource(R.drawable.bg_pill_amber)
                    binding.tvOrderStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.amber_text))
                }
                OrderStatus.DELIVERED -> {
                    binding.tvOrderStatusBadge.setBackgroundResource(R.drawable.bg_pill_green)
                    binding.tvOrderStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
                }
                OrderStatus.CANCELLED -> {
                    binding.tvOrderStatusBadge.setBackgroundResource(R.drawable.bg_pill_red)
                    binding.tvOrderStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.red_primary))
                }
            }

            binding.root.setOnClickListener { onOrderClick(order) }
        }
    }
}
