package com.example.ui.dialogs

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.activityViewModels
import com.example.databinding.DialogCreateOrderBinding
import com.example.model.CurrencyFormatter
import com.example.model.PaymentType
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class CreateOrderBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogCreateOrderBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

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

        val products = viewModel.products.value
        val productLabels = products.map { "${it.name} (${CurrencyFormatter.formatVnd(it.price)})" }
        binding.spinnerSelectProduct.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            productLabels
        )

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

        binding.btnSubmitNewOrder.setOnClickListener {
            val name = binding.etNewCustomerName.text?.toString()?.trim().orEmpty()
            val phone = binding.etNewCustomerPhone.text?.toString()?.trim().orEmpty()
            val address = binding.etNewCustomerAddress.text?.toString()?.trim().orEmpty()
            val qty = binding.etNewQuantity.text?.toString()?.toIntOrNull()?.coerceAtLeast(1) ?: 1

            if (name.isEmpty() || phone.isEmpty() || address.isEmpty()) {
                Toast.makeText(
                    requireContext(),
                    "Vui lòng nhập đầy đủ tên, SĐT và địa chỉ khách hàng",
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }

            val selectedProduct = products.getOrNull(binding.spinnerSelectProduct.selectedItemPosition)
                ?: products.first()
            val paymentType = when (binding.spinnerPaymentMethod.selectedItemPosition) {
                1 -> PaymentType.BANK
                2 -> PaymentType.WALLET
                else -> PaymentType.COD
            }

            val created = viewModel.createOrder(
                customerName = name,
                customerPhone = phone,
                address = address,
                product = selectedProduct,
                quantity = qty,
                paymentType = paymentType
            )
            Toast.makeText(
                requireContext(),
                "Đã tạo đơn hàng #${created.id} thành công!",
                Toast.LENGTH_SHORT
            ).show()
            dismiss()
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
