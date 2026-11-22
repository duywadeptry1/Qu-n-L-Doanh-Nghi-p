package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemVipCustomerBinding
import com.example.model.CurrencyFormatter
import com.example.model.CustomerVipProfile
import com.example.model.SalesChannel
import com.example.model.VipTier

class VipCustomerAdapter : RecyclerView.Adapter<VipCustomerAdapter.VipViewHolder>() {

    private var profiles: List<CustomerVipProfile> = emptyList()

    fun submitList(list: List<CustomerVipProfile>) {
        profiles = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VipViewHolder {
        val binding = ItemVipCustomerBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return VipViewHolder(binding)
    }

    override fun onBindViewHolder(holder: VipViewHolder, position: Int) {
        holder.bind(profiles[position])
    }

    override fun getItemCount(): Int = profiles.size

    class VipViewHolder(
        private val binding: ItemVipCustomerBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(profile: CustomerVipProfile) {
            val ctx = binding.root.context
            binding.tvVipChannelSymbol.text = profile.primaryChannel.badgeText
            if (profile.primaryChannel == SalesChannel.B2B) {
                binding.tvVipChannelSymbol.setBackgroundResource(R.drawable.bg_pill_blue)
                binding.tvVipChannelSymbol.setTextColor(ContextCompat.getColor(ctx, R.color.indigo_primary))
            } else {
                binding.tvVipChannelSymbol.setBackgroundResource(R.drawable.bg_pill_green)
                binding.tvVipChannelSymbol.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
            }

            binding.tvVipName.text = profile.customerName
            binding.tvVipTierBadge.text = profile.vipTier.badgeText
            binding.tvVipFrequency.text = "${profile.customerPhone} • Tần suất: ${profile.orderCount} đơn"
            binding.tvVipTotalSpent.text = CurrencyFormatter.formatVnd(profile.totalSpent)

            when (profile.vipTier) {
                VipTier.VIP_DIAMOND -> {
                    binding.tvVipTierBadge.setBackgroundResource(R.drawable.bg_pill_blue)
                    binding.tvVipTierBadge.setTextColor(ContextCompat.getColor(ctx, R.color.indigo_primary))
                }
                VipTier.VIP_GOLD -> {
                    binding.tvVipTierBadge.setBackgroundResource(R.drawable.bg_pill_amber)
                    binding.tvVipTierBadge.setTextColor(ContextCompat.getColor(ctx, R.color.amber_text))
                }
                VipTier.VIP_SILVER -> {
                    binding.tvVipTierBadge.setBackgroundResource(R.drawable.bg_pill_green)
                    binding.tvVipTierBadge.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
                }
                VipTier.STANDARD -> {
                    binding.tvVipTierBadge.setBackgroundResource(R.drawable.bg_pill_gray)
                    binding.tvVipTierBadge.setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
                }
            }

            if (profile.vipTier.isVip) {
                val savingsPart = if (profile.totalVipSavings > 0L) {
                    " • Đã tiết kiệm ${CurrencyFormatter.formatVnd(profile.totalVipSavings)}"
                } else ""
                binding.tvVipBenefitsLine.text =
                    "✓ Quyền lợi: -${profile.vipTier.demoDiscountPercent}% SP Demo • -${CurrencyFormatter.formatVnd(profile.vipTier.shippingDiscountAmount)} ship (≥ giá vốn 15K)$savingsPart"
                binding.tvVipBenefitsLine.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
            } else {
                val needed = (VipTier.VIP_SILVER.minOrders - profile.orderCount).coerceAtLeast(1)
                binding.tvVipBenefitsLine.text =
                    "Cần thêm $needed đơn để mở khóa ⭐ VIP Bạc (-10% SP Demo & giảm phí ship)"
                binding.tvVipBenefitsLine.setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
            }
        }
    }
}
