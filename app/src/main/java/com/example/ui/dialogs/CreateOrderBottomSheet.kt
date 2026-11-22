package com.example.ui.dialogs

import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.example.R
import com.example.databinding.DialogCreateOrderBinding
import com.example.model.CreateOrderResult
import com.example.model.CurrencyFormatter
import com.example.model.PaymentType
import com.example.model.Product
import com.example.model.SalesChannel
import com.example.model.VipTier
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

class CreateOrderBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogCreateOrderBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private var selectedChannel: SalesChannel = SalesChannel.B2C
    private var products: List<Product> = emptyList()
    private var selectedProductId: String? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogCreateOrderBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        dialog?.setOnShowListener { dialogInterface ->
            val sheet = (dialogInterface as? BottomSheetDialog)?.findViewById<View>(
                com.google.android.material.R.id.design_bottom_sheet
            )
            sheet?.let {
                it.setBackgroundColor(Color.TRANSPARENT)
                BottomSheetBehavior.from(it).apply {
                    state = BottomSheetBehavior.STATE_EXPANDED
                    skipCollapsed = true
                }
            }
        }

        val paymentOptions = listOf(
            "COD (Shipper thu hộ)",
            "Chuyển khoản (VCB)",
            "Ví điện tử MoMo"
        )
        binding.spinnerPaymentMethod.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            paymentOptions
        )

        binding.btnCloseCreateOrder.setOnClickListener { dismiss() }

        binding.btnChannelB2b.setOnClickListener {
            selectedChannel = SalesChannel.B2B
            updateChannelPills()
        }
        binding.btnChannelB2c.setOnClickListener {
            selectedChannel = SalesChannel.B2C
            updateChannelPills()
        }
        updateChannelPills()

        binding.btnPickVipCustomer.setOnClickListener { showVipCustomerPicker() }

        val previewWatcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                updatePricingAndLockPreview()
            }
            override fun afterTextChanged(s: Editable?) = Unit
        }
        binding.etNewCustomerPhone.addTextChangedListener(previewWatcher)
        binding.etNewCustomerName.addTextChangedListener(previewWatcher)
        binding.etNewQuantity.addTextChangedListener(previewWatcher)

        binding.spinnerSelectProduct.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, v: View?, position: Int, id: Long) {
                selectedProductId = products.getOrNull(position)?.id
                updatePricingAndLockPreview()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        binding.btnUseMaxStock.setOnClickListener {
            val product = currentSelectedProduct() ?: return@setOnClickListener
            if (product.stock > 0) {
                binding.etNewQuantity.setText(product.stock.toString())
                binding.etNewQuantity.setSelection(binding.etNewQuantity.text?.length ?: 0)
            }
        }

        binding.btnQuickRestock.setOnClickListener {
            val product = currentSelectedProduct() ?: return@setOnClickListener
            val qty = binding.etNewQuantity.text?.toString()?.toIntOrNull() ?: 1
            val shortage = (qty - product.stock).coerceAtLeast(10)
            val restockAmount = ((shortage + 9) / 10) * 10
            viewModel.restockProduct(product.id, restockAmount)
            Toast.makeText(
                requireContext(),
                "🔓 Đã nhập thêm +$restockAmount \"${product.name}\" và mở khóa giao dịch!",
                Toast.LENGTH_SHORT
            ).show()
        }

        // Observe live product inventory so stock changes / restocks immediately update lock state
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.products.collect { liveProducts ->
                    bindProductSpinner(liveProducts)
                }
            }
        }

        binding.btnSubmitNewOrder.setOnClickListener {
            val name = binding.etNewCustomerName.text?.toString()?.trim().orEmpty()
            val phone = binding.etNewCustomerPhone.text?.toString()?.trim().orEmpty()
            val address = binding.etNewCustomerAddress.text?.toString()?.trim().orEmpty()
            val qty = binding.etNewQuantity.text?.toString()?.toIntOrNull() ?: 0

            val selectedProduct = currentSelectedProduct() ?: return@setOnClickListener
            val lockStatus = viewModel.checkTradeLock(selectedProduct, qty)
            if (lockStatus.isLocked) {
                Toast.makeText(requireContext(), lockStatus.message, Toast.LENGTH_LONG).show()
                updatePricingAndLockPreview()
                return@setOnClickListener
            }

            if (name.isEmpty() || phone.isEmpty() || address.isEmpty()) {
                Toast.makeText(
                    requireContext(),
                    "Vui lòng nhập đầy đủ tên, SĐT và địa chỉ khách hàng",
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }

            val paymentType = when (binding.spinnerPaymentMethod.selectedItemPosition) {
                1 -> PaymentType.BANK
                2 -> PaymentType.WALLET
                else -> PaymentType.COD
            }

            when (
                val result = viewModel.tryCreateOrder(
                    customerName = name,
                    customerPhone = phone,
                    address = address,
                    product = selectedProduct,
                    quantity = qty,
                    paymentType = paymentType,
                    salesChannel = selectedChannel
                )
            ) {
                is CreateOrderResult.TradeLocked -> {
                    Toast.makeText(requireContext(), result.lockStatus.message, Toast.LENGTH_LONG).show()
                    updatePricingAndLockPreview()
                }
                is CreateOrderResult.Success -> {
                    val created = result.order
                    val vipNote = if (created.vipTierAtPurchase.isVip) " (${created.vipTierAtPurchase.badgeText})" else ""
                    Toast.makeText(
                        requireContext(),
                        "Đã tạo đơn ${created.salesChannel.badgeText} #${created.id}$vipNote!",
                        Toast.LENGTH_SHORT
                    ).show()
                    dismiss()
                }
            }
        }
    }

    private fun bindProductSpinner(liveProducts: List<Product>) {
        val previousId = selectedProductId
        products = liveProducts

        val productLabels = products.map { p ->
            val demoTag = if (p.isDemoProduct) " [⭐ DEMO]" else ""
            if (p.isTradeLocked) {
                "🔒 [KHÓA • HẾT HÀNG] ${p.name}$demoTag (Tồn: 0)"
            } else {
                "${p.name}$demoTag (${CurrencyFormatter.formatVnd(p.price)} • Tồn: ${p.stock})"
            }
        }

        binding.spinnerSelectProduct.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            productLabels
        )

        val targetIndex = when {
            previousId != null -> products.indexOfFirst { it.id == previousId }.takeIf { it >= 0 }
            else -> products.indexOfFirst { !it.isTradeLocked }.takeIf { it >= 0 }
        } ?: 0

        if (products.isNotEmpty()) {
            selectedProductId = products[targetIndex].id
            binding.spinnerSelectProduct.setSelection(targetIndex)
        }
        updatePricingAndLockPreview()
    }

    private fun currentSelectedProduct(): Product? {
        return products.getOrNull(binding.spinnerSelectProduct.selectedItemPosition)
            ?: products.firstOrNull()
    }

    private fun showVipCustomerPicker() {
        val profiles = viewModel.getCustomerProfiles()
        if (profiles.isEmpty()) {
            Toast.makeText(requireContext(), "Chưa có dữ liệu khách hàng", Toast.LENGTH_SHORT).show()
            return
        }
        val labels = profiles.map { p ->
            "${p.vipTier.badgeText} • ${p.customerName} (${p.customerPhone}) — ${p.orderCount} đơn • ${p.primaryChannel.badgeText}"
        }.toTypedArray()

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Chọn khách hàng / Đại diện")
            .setItems(labels) { _, which ->
                val chosen = profiles[which]
                binding.etNewCustomerName.setText(chosen.customerName)
                binding.etNewCustomerPhone.setText(chosen.customerPhone)
                val lastAddress = viewModel.orders.value
                    .find { it.customerPhone.replace(" ", "") == chosen.customerPhone.replace(" ", "") }
                    ?.address
                if (!lastAddress.isNullOrBlank()) {
                    binding.etNewCustomerAddress.setText(lastAddress)
                }
                selectedChannel = chosen.primaryChannel
                updateChannelPills()
                updatePricingAndLockPreview()
            }
            .setNegativeButton("Đóng", null)
            .show()
    }

    private fun updateChannelPills() {
        val ctx = context ?: return
        if (selectedChannel == SalesChannel.B2B) {
            binding.btnChannelB2b.setBackgroundResource(R.drawable.bg_pill_solid_blue)
            binding.btnChannelB2b.setTextColor(ContextCompat.getColor(ctx, R.color.white))
            binding.btnChannelB2c.setBackgroundResource(R.drawable.bg_pill_gray)
            binding.btnChannelB2c.setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
        } else {
            binding.btnChannelB2c.setBackgroundResource(R.drawable.bg_pill_solid_blue)
            binding.btnChannelB2c.setTextColor(ContextCompat.getColor(ctx, R.color.white))
            binding.btnChannelB2b.setBackgroundResource(R.drawable.bg_pill_gray)
            binding.btnChannelB2b.setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
        }
    }

    private fun updatePricingAndLockPreview() {
        val ctx = context ?: return
        val product = currentSelectedProduct()
        if (product == null) {
            binding.cardTradeLockWarning.visibility = View.VISIBLE
            binding.tvTradeLockTitle.text = "🔒 Đã khóa giao dịch — Kho hàng trống"
            binding.tvTradeLockMessage.text = "Chưa có sản phẩm nào trong kho. Vui lòng thêm sản phẩm trước khi tạo đơn."
            binding.btnUseMaxStock.visibility = View.GONE
            binding.btnQuickRestock.visibility = View.GONE
            binding.btnSubmitNewOrder.isEnabled = false
            binding.btnSubmitNewOrder.alpha = 0.6f
            binding.btnSubmitNewOrder.backgroundTintList =
                ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.red_primary))
            binding.btnSubmitNewOrder.text = "🔒 Khóa giao dịch (Kho trống)"
            return
        }

        val rawQty = binding.etNewQuantity.text?.toString()?.toIntOrNull() ?: 0
        val previewQty = rawQty.coerceAtLeast(1)
        val phone = binding.etNewCustomerPhone.text?.toString().orEmpty()
        val name = binding.etNewCustomerName.text?.toString().orEmpty()

        val pricing = viewModel.previewOrderPricing(phone, name, product, previewQty)

        if (pricing.tier.isVip) {
            binding.cardVipPreview.setBackgroundResource(R.drawable.bg_card_amber_tint)
            binding.tvOrderVipStatus.setTextColor(ContextCompat.getColor(ctx, R.color.amber_text))
            binding.tvOrderVipStatus.text =
                "${pricing.tier.badgeText} (${pricing.existingOrderCount} đơn đã mua) • Đang áp dụng quyền lợi VIP"
        } else {
            binding.cardVipPreview.setBackgroundResource(R.drawable.bg_card_blue_tint)
            binding.tvOrderVipStatus.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
            val remaining = (VipTier.VIP_SILVER.minOrders - pricing.existingOrderCount).coerceAtLeast(1)
            binding.tvOrderVipStatus.text =
                "Khách thường (${pricing.existingOrderCount} đơn) • Thêm $remaining đơn để lên ⭐ VIP Bạc"
        }

        val benefitLines = mutableListOf<String>()
        if (pricing.vipProductDiscount > 0L) {
            benefitLines.add(
                "• Giảm ${pricing.tier.demoDiscountPercent}% SP Demo: -${CurrencyFormatter.formatVnd(pricing.vipProductDiscount)}"
            )
        } else if (pricing.tier.isVip && !product.isDemoProduct) {
            benefitLines.add(
                "• Ưu đãi -${pricing.tier.demoDiscountPercent}% chỉ áp dụng cho sản phẩm gắn nhãn ⭐ DEMO"
            )
        } else if (product.isDemoProduct && !pricing.tier.isVip) {
            benefitLines.add("• SP Demo: Khách VIP được giảm 10–20%")
        }

        if (pricing.shippingDiscount > 0L) {
            benefitLines.add(
                "• Phí ship VIP: ${CurrencyFormatter.formatVnd(pricing.baseShippingFee)} → ${CurrencyFormatter.formatVnd(pricing.finalShippingFee)} (Giảm ${CurrencyFormatter.formatVnd(pricing.shippingDiscount)}, giữ sàn giá vốn ≥ ${CurrencyFormatter.formatVnd(pricing.shippingCost)})"
            )
        } else {
            benefitLines.add(
                "• Phí ship tiêu chuẩn: ${CurrencyFormatter.formatVnd(pricing.finalShippingFee)} (Giá vốn ship: ${CurrencyFormatter.formatVnd(pricing.shippingCost)})"
            )
        }

        binding.tvOrderVipBenefits.text = benefitLines.joinToString("\n")
        binding.tvOrderTotalPreview.text =
            "Tổng thanh toán: ${CurrencyFormatter.formatVnd(pricing.totalPayment)} • Lãi dự kiến: +${CurrencyFormatter.formatVnd(pricing.estimatedProfit)}"

        // Enforce live inventory trade lock
        val lockStatus = viewModel.checkTradeLock(product, rawQty)
        if (lockStatus.isLocked) {
            binding.cardTradeLockWarning.visibility = View.VISIBLE
            binding.tvTradeLockTitle.text = lockStatus.title
            binding.tvTradeLockMessage.text = lockStatus.message

            if (lockStatus.availableStock > 0) {
                binding.btnUseMaxStock.visibility = View.VISIBLE
                binding.btnUseMaxStock.text = "Đặt tối đa (${lockStatus.availableStock})"
            } else {
                binding.btnUseMaxStock.visibility = View.GONE
            }
            val restockSuggestion = ((lockStatus.shortage.coerceAtLeast(10) + 9) / 10) * 10
            binding.btnQuickRestock.visibility = View.VISIBLE
            binding.btnQuickRestock.text = "🔓 +$restockSuggestion Nhập kho"

            binding.btnSubmitNewOrder.isEnabled = false
            binding.btnSubmitNewOrder.alpha = 0.6f
            binding.btnSubmitNewOrder.backgroundTintList =
                ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.red_primary))
            binding.btnSubmitNewOrder.text = if (lockStatus.availableStock <= 0) {
                "🔒 Khóa giao dịch (Hết tồn kho)"
            } else {
                "🔒 Khóa giao dịch (Chỉ còn ${lockStatus.availableStock} sp)"
            }
        } else {
            binding.cardTradeLockWarning.visibility = View.GONE
            binding.btnSubmitNewOrder.isEnabled = true
            binding.btnSubmitNewOrder.alpha = 1f
            binding.btnSubmitNewOrder.backgroundTintList =
                ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.primary_blue))
            binding.btnSubmitNewOrder.text = "Xác nhận & Tạo đơn hàng"
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
