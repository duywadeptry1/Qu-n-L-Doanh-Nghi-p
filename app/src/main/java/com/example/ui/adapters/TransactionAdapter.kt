package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemTransactionBinding
import com.example.model.CurrencyFormatter
import com.example.model.PaymentTransaction
import com.example.model.PaymentType

class TransactionAdapter(
    private val onTxClick: (PaymentTransaction) -> Unit
) : RecyclerView.Adapter<TransactionAdapter.TxViewHolder>() {

    private var items: List<PaymentTransaction> = emptyList()

    fun submitList(list: List<PaymentTransaction>) {
        items = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TxViewHolder {
        val binding = ItemTransactionBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return TxViewHolder(binding)
    }

    override fun onBindViewHolder(holder: TxViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class TxViewHolder(
        private val binding: ItemTransactionBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(tx: PaymentTransaction) {
            val ctx = binding.root.context
            binding.tvTxTitle.text = tx.methodTitle
            binding.tvTxSubtitle.text = tx.subtitle
            binding.tvTxAmount.text = "+${CurrencyFormatter.formatVnd(tx.amount)}"

            when (tx.paymentType) {
                PaymentType.COD, PaymentType.ALL -> {
                    binding.ivTxIcon.setImageResource(R.drawable.ic_cash)
                    binding.ivTxIcon.setBackgroundResource(R.drawable.bg_icon_square_green)
                    binding.ivTxIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.green_primary))
                    binding.tvTxAmount.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
                }
                PaymentType.BANK -> {
                    binding.ivTxIcon.setImageResource(R.drawable.ic_bank)
                    binding.ivTxIcon.setBackgroundResource(R.drawable.bg_icon_square_blue)
                    binding.ivTxIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.primary_blue))
                    binding.tvTxAmount.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
                }
                PaymentType.WALLET -> {
                    binding.ivTxIcon.setImageResource(R.drawable.ic_income)
                    binding.ivTxIcon.setBackgroundResource(R.drawable.bg_icon_square_indigo)
                    binding.ivTxIcon.setColorFilter(ContextCompat.getColor(ctx, R.color.indigo_primary))
                    binding.tvTxAmount.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
                }
            }

            binding.root.setOnClickListener { onTxClick(tx) }
        }
    }
}
