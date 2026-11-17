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
import com.google.android.material.dialog.MaterialAlertDialogBuilder

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

        binding.btnCallCustomer.setOnClickListener {
            val current = viewModel.getOrderById(orderId) ?: return@setOnClickListener
            val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${current.customerPhone.replace(" ", "")}"))
            runCatching { startActivity(dialIntent) }.onFailure {
                Toast.makeText(requireContext(), "SĐT khách hàng: ${current.customerPhone}", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnAdvanceOrderStatus.setOnClickListener {
            val current = viewModel.getOrderById(orderId) ?: return@setOnClickListener
            val (nextTitle, nextMessage) = when (current.status) {
                OrderStatus.PLACED ->
                    "Xác nhận Duyệt & Chuẩn bị hàng" to
                        "Bạn xác nhận duyệt đơn #${current.id} của khách hàng ${current.customerName} và chuyển sang bước chuẩn bị hàng?"
                OrderStatus.PREPARING ->
                    "Xác nhận Giao cho ĐVVC" to
                        "Đơn hàng #${current.id} đã đóng gói xong và sẵn sàng bàn giao cho đơn vị vận chuyển?"
                OrderStatus.DELIVERING ->
                    "Xác nhận Đơn đã đến tay khách" to
                        "Xác nhận đơn hàng #${current.id} đã giao đến tay khách hàng thành công và ghi nhận doanh thu ${CurrencyFormatter.formatVnd(current.total)}?"
                else -> return@setOnClickListener
            }

            MaterialAlertDialogBuilder(requireContext())
                .setTitle(nextTitle)
                .setMessage(nextMessage)
                .setPositiveButton("Xác nhận") { _, _ ->
                    val updated = viewModel.advanceOrderStatus(orderId)
                    if (updated != null) {
                        bindOrder(updated)
                        val msg = when (updated.status) {
                            OrderStatus.PREPARING -> "Đã duyệt đơn #${updated.id} & chuyển sang Chuẩn bị hàng"
                            OrderStatus.DELIVERING -> "Đã bàn giao đơn #${updated.id} cho đơn vị vận chuyển"
                            OrderStatus.DELIVERED -> "Đơn #${updated.id} đã đến tay khách hàng • Đã ghi nhận thu nhập!"
                            else -> "Đã cập nhật trạng thái đơn hàng"
                        }
                        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Huỷ", null)
                .show()
        }

        binding.btnEditStatus.setOnClickListener {
            val statusOptions = arrayOf(
                "1. Khách hàng đặt hàng (PLACED)",
                "2. Duyệt đơn & Chuẩn bị hàng (PREPARING)",
                "3. Giao cho đơn vị vận chuyển (DELIVERING)",
                "4. Đơn hàng đã đến tay khách hàng (DELIVERED)",
                "5. Đã huỷ đơn (CANCELLED)"
            )
            val statusValues = arrayOf(
                OrderStatus.PLACED,
                OrderStatus.PREPARING,
                OrderStatus.DELIVERING,
                OrderStatus.DELIVERED,
                OrderStatus.CANCELLED
            )

            val currentOrder = viewModel.getOrderById(orderId)
            val selectedIndex = statusValues.indexOf(currentOrder?.status).coerceAtLeast(0)

            MaterialAlertDialogBuilder(requireContext())
                .setTitle("Xác nhận đổi trạng thái đơn #${orderId}")
                .setSingleChoiceItems(statusOptions, selectedIndex) { dialog, which ->
                    val chosenStatus = statusValues[which]
                    val updated = viewModel.updateOrderStatus(orderId, chosenStatus)
                    if (updated != null) {
                        bindOrder(updated)
                        Toast.makeText(
                            requireContext(),
                            "Đã xác nhận trạng thái đơn #${orderId}: ${chosenStatus.label}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    dialog.dismiss()
                }
                .setNegativeButton("Đóng", null)
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

        when (order.status) {
            OrderStatus.PLACED -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_blue)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_doc)
                binding.tvBannerTitle.text = "Bước 1: Khách hàng đặt hàng"
                binding.tvBannerSubtitle.text = "Đơn hàng mới tạo (${order.timeAgo}) • Chờ duyệt & chuẩn bị hàng"
                binding.btnAdvanceOrderStatus.visibility = View.VISIBLE
                binding.btnAdvanceOrderStatus.text = "Xác nhận: Duyệt đơn & Chuẩn bị hàng"
            }
            OrderStatus.PREPARING -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_blue)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_products)
                binding.tvBannerTitle.text = "Bước 2: Đang duyệt & chuẩn bị hàng"
                binding.tvBannerSubtitle.text = "Đang đóng gói sản phẩm tại kho • Sẵn sàng bàn giao ĐVVC"
                binding.btnAdvanceOrderStatus.visibility = View.VISIBLE
                binding.btnAdvanceOrderStatus.text = "Xác nhận: Giao cho đơn vị vận chuyển"
            }
            OrderStatus.DELIVERING -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_amber)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_truck)
                binding.tvBannerTitle.text = "Bước 3: Đã giao cho đơn vị vận chuyển"
                binding.tvBannerSubtitle.text = "Đơn vị vận chuyển đang giao hàng đến địa chỉ khách hàng"
                binding.btnAdvanceOrderStatus.visibility = View.VISIBLE
                binding.btnAdvanceOrderStatus.text = "Xác nhận: Đơn đã đến tay khách hàng"
            }
            OrderStatus.DELIVERED -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_green)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_check_circle)
                binding.tvBannerTitle.text = "Bước 4: Đơn hàng đã đến tay khách hàng"
                binding.tvBannerSubtitle.text = "Giao hàng thành công • Đã cộng vào thống kê thu nhập"
                binding.btnAdvanceOrderStatus.visibility = View.GONE
            }
            OrderStatus.CANCELLED -> {
                binding.layoutDeliveryBanner.setBackgroundResource(R.drawable.bg_delivery_banner_red)
                binding.ivBannerIcon.setImageResource(R.drawable.ic_cancel_circle)
                binding.tvBannerTitle.text = "Đơn hàng đã huỷ"
                binding.tvBannerSubtitle.text = "Đơn hàng đã bị huỷ • Không tính vào doanh thu"
                binding.btnAdvanceOrderStatus.visibility = View.GONE
            }
        }

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
