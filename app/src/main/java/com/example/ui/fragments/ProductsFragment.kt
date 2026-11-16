package com.example.ui.fragments

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
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
import com.example.ui.adapters.ProductAdapter
import com.example.ui.dialogs.AddProductBottomSheet
import com.example.viewmodel.SalesViewModel
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
                viewModel.restockProduct(product.id, 10)
                Toast.makeText(
                    requireContext(),
                    "Đã nhập thêm +10 ${product.name} vào kho",
                    Toast.LENGTH_SHORT
                ).show()
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
        binding.chipCatFashion.setOnClickListener { viewModel.selectProductCategory("Thời trang") }
        binding.chipCatElectronics.setOnClickListener { viewModel.selectProductCategory("Thiết bị điện tử") }
        binding.chipCatAccessories.setOnClickListener { viewModel.selectProductCategory("Phụ kiện") }

        binding.btnAddProduct.setOnClickListener {
            AddProductBottomSheet().show(parentFragmentManager, "add_product")
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
                }
            }
        }
    }

    private fun updateCategoryChips(selected: String) {
        val map = mapOf(
            "Tất cả" to binding.chipCatAll,
            "Thời trang" to binding.chipCatFashion,
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
