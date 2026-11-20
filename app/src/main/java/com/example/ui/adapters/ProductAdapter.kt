package com.example.ui.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.ItemProductCardBinding
import com.example.model.CurrencyFormatter
import com.example.model.Product
import com.example.utils.ImageUtils

class ProductAdapter(
    private val onRestockClick: (Product) -> Unit,
    private val onEditClick: (Product) -> Unit = {}
) : RecyclerView.Adapter<ProductAdapter.ProductViewHolder>() {

    private var products: List<Product> = emptyList()

    fun submitList(list: List<Product>) {
        products = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ProductViewHolder {
        val binding = ItemProductCardBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ProductViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ProductViewHolder, position: Int) {
        holder.bind(products[position])
    }

    override fun getItemCount(): Int = products.size

    inner class ProductViewHolder(
        private val binding: ItemProductCardBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(product: Product) {
            val ctx = binding.root.context

            ImageUtils.loadProductImage(
                imageView = binding.ivProductThumb,
                imageUrl = product.imageUrl,
                fallbackRes = product.imageRes
            )

            binding.tvProductSku.text = "SKU: ${product.sku}"
            binding.tvProductName.text = product.name
            binding.tvProductPrice.text = CurrencyFormatter.formatVnd(product.price)
            binding.tvProductSold.text = "Đã bán: ${product.soldCount}"
            binding.tvProductCategory.text = "Danh mục: ${product.category}"
            binding.tvProductStockCount.text = "Tồn kho: ${product.stock}"

            if (product.description.isNotBlank()) {
                binding.tvProductDescription.visibility = View.VISIBLE
                binding.tvProductDescription.text = product.description
            } else {
                binding.tvProductDescription.visibility = View.GONE
            }

            when {
                product.stock == 0 -> {
                    binding.tvStockStatusBadge.text = "Hết hàng"
                    binding.tvStockStatusBadge.setBackgroundResource(R.drawable.bg_pill_red)
                    binding.tvStockStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.red_primary))
                }
                product.stock <= 10 -> {
                    binding.tvStockStatusBadge.text = "Sắp hết (${product.stock})"
                    binding.tvStockStatusBadge.setBackgroundResource(R.drawable.bg_pill_amber)
                    binding.tvStockStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.amber_text))
                }
                else -> {
                    binding.tvStockStatusBadge.text = "Còn hàng"
                    binding.tvStockStatusBadge.setBackgroundResource(R.drawable.bg_pill_green)
                    binding.tvStockStatusBadge.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
                }
            }

            binding.btnRestockProduct.text = "+ Nhập kho"
            binding.btnRestockProduct.setOnClickListener { onRestockClick(product) }
            binding.btnEditProduct.setOnClickListener { onEditClick(product) }
            binding.root.setOnClickListener { onEditClick(product) }
        }
    }
}
