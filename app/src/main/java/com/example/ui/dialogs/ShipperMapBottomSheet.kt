package com.example.ui.dialogs

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.activityViewModels
import com.example.databinding.DialogShipperMapBinding
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlin.math.roundToInt

class ShipperMapBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogShipperMapBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogShipperMapBinding.inflate(inflater, container, false)
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

        val orderId = arguments?.getString(ARG_ORDER_ID).orEmpty()
        val order = viewModel.getOrderById(orderId)

        if (order != null) {
            binding.tvMapSubtitle.text = "Đơn #${order.id} • Giao tới ${order.address}"
            binding.tvShipperName.text = "Shipper: ${order.shipperName} • ${order.shipperPlate}"
            binding.tvMapEta.text = if (order.etaMinutes > 0) {
                "Đang di chuyển trên lộ trình • Còn ${order.etaMinutes} phút (${order.distanceKm} km)"
            } else {
                "Đã đến điểm giao hàng tại ${order.address}"
            }
        }

        binding.btnSimulateRoute.setOnClickListener {
            binding.shipperMapCanvas.simulateMovement { progress ->
                val remainMin = ((1f - progress) * 14f).roundToInt().coerceAtLeast(1)
                val remainKm = String.format("%.1f", (1f - progress) * 2.6f)
                _binding?.tvMapEta?.text = if (progress >= 0.95f) {
                    "Shipper đã tới điểm giao hàng!"
                } else {
                    "Đang di chuyển trực tiếp • Còn $remainMin phút ($remainKm km)"
                }
            }
        }

        binding.btnCloseMap.setOnClickListener { dismiss() }
        binding.btnMapDone.setOnClickListener { dismiss() }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }

    companion object {
        private const val ARG_ORDER_ID = "arg_order_id"

        fun newInstance(orderId: String): ShipperMapBottomSheet {
            return ShipperMapBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_ORDER_ID, orderId)
                }
            }
        }
    }
}
