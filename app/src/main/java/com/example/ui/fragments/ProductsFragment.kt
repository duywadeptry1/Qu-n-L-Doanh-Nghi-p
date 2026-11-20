package com.example.ui.fragments

import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.R
import com.example.databinding.FragmentProductsBinding
import com.example.model.Product
import com.example.ui.adapters.ProductAdapter
import com.example.ui.dialogs.AddProductBottomSheet
import com.example.ui.dialogs.BulkAddProductBottomSheet
import com.example.viewmodel.SalesViewModel
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class ProductsFragment : Fragment() {

    private var _binding: FragmentProductsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private lateinit var productAdapter: ProductAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProductsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        productAdapter = ProductAdapter(
            onRestockClick = { product ->
                showRestockDialog(product)
            },
            onEditClick = { product ->
                AddProductBottomSheet.newInstance(product.id)
                    .show(parentFragmentManager, "edit_product")
            }
        )

        binding.rvProducts.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = productAdapter
        }

        setupListeners()
        observeViewModel()
    }

    private fun setupListeners() {
        binding.chipCatAll.setOnClickListener { viewModel.selectProductCategory("Tất cả") }
        binding.chipCatElectronics.setOnClickListener { viewModel.selectProductCategory("Thiết bị điện tử") }
        binding.chipCatAccessories.setOnClickListener { viewModel.selectProductCategory("Phụ kiện") }

        binding.btnAddProduct.setOnClickListener {
            AddProductBottomSheet().show(parentFragmentManager, "add_product")
        }

        binding.btnBulkAddProduct.setOnClickListener {
            BulkAddProductBottomSheet.newInstance(startWithQuickText = false)
                .show(parentFragmentManager, "bulk_add_product")
        }

        binding.etProductsSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                viewModel.updateProductSearch(s?.toString().orEmpty())
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                combine(
                    viewModel.products,
                    viewModel.productCategory,
                    viewModel.productSearch
                ) { products, category, query ->
                    Triple(products, category, query)
                }.collect { (products, category, query) ->
                    updateCategoryChips(category)

                    val totalStock = products.sumOf { it.stock }
                    val totalSold = products.sumOf { it.soldCount }
                    val lowStock = products.count { it.stock <= 10 }

                    binding.tvProductsCountBadge.text = "${products.size} Sản phẩm"
                    binding.tvTotalStock.text = "$totalStock sp"
                    binding.tvTotalSold.text = "$totalSold sp"
                    binding.tvLowStockCount.text = "$lowStock mã"

                    val q = query.trim().lowercase()
                    val filtered = products.filter { item ->
                        val matchesCat = category == "Tất cả" || item.category == category
                        val matchesQ = q.isEmpty() ||
                            item.name.lowercase().contains(q) ||
                            item.sku.lowercase().contains(q)
                        matchesCat && matchesQ
                    }
                    productAdapter.submitList(filtered)
                    binding.rvProducts.visibility = if (filtered.isEmpty()) View.GONE else View.VISIBLE
                    binding.layoutProductsEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
                }
            }
        }
    }

    private fun showRestockDialog(product: Product) {
        val options = arrayOf("+10 cái", "+20 cái", "+50 cái", "+100 cái", "Nhập số lượng khác...")
        val amounts = intArrayOf(10, 20, 50, 100)

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Nhập thêm hàng: ${product.name}")
            .setItems(options) { _, which ->
                if (which < amounts.size) {
                    val qty = amounts[which]
                    viewModel.restockProduct(product.id, qty)
                    Toast.makeText(
                        requireContext(),
                        "Đã nhập thêm +$qty ${product.name} (Tồn mới: ${product.stock + qty})",
                        Toast.LENGTH_SHORT
                    ).show()
                } else {
                    showCustomRestockDialog(product)
                }
            }
            .setNegativeButton("Huỷ", null)
            .show()
    }

    private fun showCustomRestockDialog(product: Product) {
        val input = EditText(requireContext()).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            hint = "Nhập số lượng nhập thêm"
            setPadding(48, 32, 48, 16)
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Nhập thêm kho")
            .setMessage("${product.name}\n(Tồn kho hiện tại: ${product.stock} sp)")
            .setView(input)
            .setPositiveButton("Xác nhận") { _, _ ->
                val qty = input.text.toString().trim().toIntOrNull()
                if (qty != null && qty > 0) {
                    viewModel.restockProduct(product.id, qty)
                    Toast.makeText(
                        requireContext(),
                        "Đã nhập thêm +$qty ${product.name} (Tồn mới: ${product.stock + qty})",
                        Toast.LENGTH_SHORT
                    ).show()
                } else {
                    Toast.makeText(requireContext(), "Số lượng không hợp lệ", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Huỷ", null)
            .show()
    }

    private fun updateCategoryChips(selected: String) {
        val map = mapOf(
            "Tất cả" to binding.chipCatAll,
            "Thiết bị điện tử" to binding.chipCatElectronics,
            "Phụ kiện" to binding.chipCatAccessories
        )
        val ctx = requireContext()
        map.forEach { (label, chip: TextView) ->
            if (label == selected) {
                chip.setBackgroundResource(R.drawable.bg_pill_solid_blue)
                chip.setTextColor(ContextCompat.getColor(ctx, R.color.white))
            } else {
                chip.setBackgroundResource(R.drawable.bg_pill_gray)
                chip.setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
