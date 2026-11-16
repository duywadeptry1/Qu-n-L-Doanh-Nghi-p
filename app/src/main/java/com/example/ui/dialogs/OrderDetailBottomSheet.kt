package com.example.ui.dialogs

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.activityViewModels
import com.example.R
import com.example.databinding.DialogOrderDetailBinding
import com.example.databinding.ItemOrderedProductRowBinding
import com.example.model.CurrencyFormatter
import com.example.model.Order
import com.example.model.OrderStatus
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class OrderDetailBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogOrderDetailBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogOrderDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        dialog?.setOnShowListener { dialogInterface ->
            val bottomSheetDialog = dialogInterface as? BottomSheetDialog
            val sheet = bottomSheetDialog?.findViewById<View>(
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

        val orderId = arguments?.getString(ARG_ORDER_ID).orEmpty()
        val initialOrder = viewModel.getOrderById(orderId)
        if (initialOrder == null) {
            dismiss()
            return
        }

        bindOrder(initialOrder)

        binding.btnCloseX.setOnClickListener { dismiss() }
        binding.btnCloseBottom.setOnClickListener { dismiss() }

        binding.layoutDeliveryBanner.setOnClickListener {
            openMapForOrder(orderId)
        }
        binding.btnOpenMap.setOnClickListener {
            openMapForOrder(orderId)
        }

        binding.btnCallCustomer.setOnClickListener {
            val current = viewModel.getOrderById(orderId) ?: return@setOnClickListener
            val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${current.customerPhone.replace(" ", "")}"))
            runCatching { startActivity(dialIntent) }.onFailure {
                Toast.makeText(requireContext(), "SĐT khách hàng: ${current.customerPhone}", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnAdvanceOrderStatus.setOnClickListener {
            val updated = viewModel.advanceOrderStatus(orderId)
            if (updated != null) {
                bindOrder(updated)
                val msg = when (updated.status) {
                    OrderStatus.DELIVERING -> "Đã chuyển đơn #${updated.id} sang Đang giao hàng"
                    OrderStatus.DELIVERED -> "Đã hoàn tất giao hàng & ghi nhận doanh thu #${updated.id}"
                    else -> "Đã cập nhật trạng thái đơn hàng"
                }
                Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnEditStatus.setOnClickListener {
            val statusOptions = arrayOf(
                "Mới đặt (PLACED)",
                "Đang giao (DELIVERING)",
                "Đã giao (DELIVERED)",
                "Đã huỷ (CANCELLED)"
            )
            val statusValues = arrayOf(
                OrderStatus.PLACED,
                OrderStatus.DELIVERING,
                OrderStatus.DELIVERED,
                OrderStatus.CANCELLED
            )

            val currentOrder = viewModel.getOrderById(orderId)
            val selectedIndex = statusValues.indexOf(currentOrder?.status).coerceAtLeast(0)

            com.google.android.material.dialog.MaterialAlertDialogBuilder(requireContext())
                .setTitle("Chỉnh sửa trạng thái đơn #${orderId}")
                .setSingleChoiceItems(statusOptions, selectedIndex) { dialog, which ->
                    val chosenStatus = statusValues[which]
                    val updated = viewModel.updateOrderStatus(orderId, chosenStatus)
                    if (updated != null) {
                        bindOrder(updated)
                        Toast.makeText(
                            requireContext(),
                            "Đã cập nhật trạng thái đơn thành: ${chosenStatus.label}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    dialog.dismiss()
                }
                .setNegativeButton("Hủy", null)
                .show()
        }
    }

    private fun bindOrder(order: Order) {
        binding.tvDetailOrderCode.text = "#${order.id}"
        binding.tvDetailCustomerName.text = order.customerName
        binding.tvDetailCustomerPhone.text = order.customerPhone
        binding.tvDetailCustomerAddress.text = order.address
        binding.tvDetailSubtotal.text = CurrencyFormatter.formatVnd(order.subtotal)
        binding.tvDetailShipping.text = CurrencyFormatter.formatVnd(order.shippingFee)
        binding.tvDetailTotal.text = CurrencyFormatter.formatVnd(order.total)
        binding.tvDetailPaymentMethod.text = order.paymentMethodLabel

        binding.orderTimelineView.setStatus(order.status)

        // Banner styling & copy by status
        when (order.status) {
            OrderStatus.DELIVERING -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_amber)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_truck)
                binding.tvBannerTitle.text = getString(R.string.delivery_status_delivering)
                binding.tvBannerSubtitle.text = getString(R.string.delivery_status_delivering_sub)
                binding.btnAdvanceOrderStatus.visibility = View.VISIBLE
                binding.btnAdvanceOrderStatus.text = "Xác nhận Đã giao & Thu tiền"
            }
            OrderStatus.PLACED -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_blue)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_doc)
                binding.tvBannerTitle.text = "Đơn mới đặt • Chờ xuất kho"
                binding.tvBannerSubtitle.text = "Bấm vào đây để xem tuyến đường dự kiến"
                binding.btnAdvanceOrderStatus.visibility = View.VISIBLE
                binding.btnAdvanceOrderStatus.text = "Xuất kho & Giao cho Shipper"
            }
            OrderStatus.DELIVERED -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_green)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_check_circle)
                binding.tvBannerTitle.text = "Đã giao hàng thành công"
                binding.tvBannerSubtitle.text = "Bấm để xem lại lộ trình giao vận hoàn tất"
                binding.btnAdvanceOrderStatus.visibility = View.GONE
            }
            OrderStatus.CANCELLED -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_red)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_cancel_circle)
                binding.tvBannerTitle.text = "Đơn hàng đã huỷ"
                binding.tvBannerSubtitle.text = "Khách hàng yêu cầu huỷ trước khi xuất kho"
                binding.btnAdvanceOrderStatus.visibility = View.GONE
            }
        }

        // Populate ordered products
        binding.layoutOrderedItemsContainer.removeAllViews()
        val inflater = LayoutInflater.from(requireContext())
        order.items.forEach { item ->
            val row = ItemOrderedProductRowBinding.inflate(
                inflater,
                binding.layoutOrderedItemsContainer,
                false
            )
            row.tvItemProductName.text = item.productName
            row.tvItemProductQty.text = "Số lượng: x${item.quantity}"
            row.tvItemProductPrice.text = CurrencyFormatter.formatVnd(item.unitPrice)
            binding.layoutOrderedItemsContainer.addView(row.root)
        }
    }

    private fun openMapForOrder(orderId: String) {
        ShipperMapBottomSheet.newInstance(orderId)
            .show(parentFragmentManager, "shipper_map")
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }

    companion object {
        private const val ARG_ORDER_ID = "arg_order_id"

        fun newInstance(orderId: String): OrderDetailBottomSheet {
            return OrderDetailBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_ORDER_ID, orderId)
                }
            }
        }
    }
}
