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
import com.example.databinding.FragmentOrdersBinding
import com.example.model.CurrencyFormatter
import com.example.model.Order
import com.example.model.OrderFilter
import com.example.model.OrderStatus
import com.example.ui.adapters.OrderCardAdapter
import com.example.ui.dialogs.CreateOrderBottomSheet
import com.example.ui.dialogs.OrderDetailBottomSheet
import com.example.viewmodel.SalesViewModel
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class OrdersFragment : Fragment() {

    private var _binding: FragmentOrdersBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private lateinit var orderAdapter: OrderCardAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOrdersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        orderAdapter = OrderCardAdapter(
            onOrderClick = { order ->
                OrderDetailBottomSheet.newInstance(order.id)
                    .show(parentFragmentManager, "order_detail")
            },
            onConfirmStatusClick = { order ->
                showQuickConfirmStatusDialog(order)
            }
        )
        binding.rvOrders.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = orderAdapter
        }

        setupListeners()
        observeViewModel()
    }

    private fun showQuickConfirmStatusDialog(order: Order) {
        val (title, message) = when (order.status) {
            OrderStatus.PLACED ->
                "Xác nhận Duyệt & Chuẩn bị hàng" to
                    "Xác nhận duyệt đơn #${order.id} (${order.customerName}) và chuyển sang bước Chuẩn bị hàng?"
            OrderStatus.PREPARING ->
                "Xác nhận Giao cho ĐVVC" to
                    "Xác nhận kiện hàng #${order.id} đã chuẩn bị xong và bàn giao cho đơn vị vận chuyển?"
            OrderStatus.DELIVERING ->
                "Xác nhận Đơn đã đến tay khách" to
                    "Xác nhận đơn hàng #${order.id} đã đến tay khách hàng thành công và cộng ${CurrencyFormatter.formatVnd(order.total)} vào thu nhập thực tế?"
            else -> return
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Xác nhận") { _, _ ->
                val updated = viewModel.advanceOrderStatus(order.id)
                if (updated != null) {
                    Toast.makeText(
                        requireContext(),
                        "Đã xác nhận đơn #${updated.id}: ${updated.status.label}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
            .setNegativeButton("Huỷ", null)
            .show()
    }

    private fun setupListeners() {
        binding.chipFilterAll.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.ALL) }
        binding.chipFilterPlaced.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.PLACED) }
        binding.chipFilterPreparing.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.PREPARING) }
        binding.chipFilterDelivering.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.DELIVERING) }
        binding.chipFilterDelivered.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.DELIVERED) }
        binding.chipFilterCancelled.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.CANCELLED) }

        binding.btnCreateOrder.setOnClickListener {
            if (!viewModel.hasTradableInventory()) {
                MaterialAlertDialogBuilder(requireContext())
                    .setTitle("🔒 Đã khóa tạo giao dịch")
                    .setMessage("Tất cả sản phẩm trong kho hiện đã hết hàng (tồn kho = 0). Vui lòng nhập thêm hàng tại mục Kho hàng để mở khóa giao dịch.")
                    .setPositiveButton("Đã hiểu", null)
                    .show()
            } else {
                CreateOrderBottomSheet().show(parentFragmentManager, "create_order")
            }
        }

        binding.etOrdersSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                viewModel.updateOrderSearch(s?.toString().orEmpty())
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                combine(
                    viewModel.orders,
                    viewModel.orderFilter,
                    viewModel.orderSearch
                ) { orders, filter, query ->
                    Triple(orders, filter, query)
                }.collect { (orders, filter, query) ->
                    updateFilterChipsUI(filter)

                    val filtered = orders.filter { order ->
                        val matchesFilter = when (filter) {
                            OrderFilter.ALL -> true
                            OrderFilter.PLACED -> order.status == OrderStatus.PLACED
                            OrderFilter.PREPARING -> order.status == OrderStatus.PREPARING
                            OrderFilter.DELIVERING -> order.status == OrderStatus.DELIVERING
                            OrderFilter.DELIVERED -> order.status == OrderStatus.DELIVERED
                            OrderFilter.CANCELLED -> order.status == OrderStatus.CANCELLED
                        }
                        val q = query.trim().lowercase()
                        val matchesQuery = q.isEmpty() ||
                            order.id.lowercase().contains(q) ||
                            order.customerName.lowercase().contains(q) ||
                            order.customerPhone.lowercase().contains(q)
                        matchesFilter && matchesQuery
                    }

                    binding.tvOrdersCountBadge.text = "${filtered.size} Đơn"
                    orderAdapter.submitList(filtered)

                    if (filtered.isEmpty()) {
                        binding.rvOrders.visibility = View.GONE
                        binding.layoutOrdersEmpty.visibility = View.VISIBLE
                    } else {
                        binding.rvOrders.visibility = View.VISIBLE
                        binding.layoutOrdersEmpty.visibility = View.GONE
                    }
                }
            }
        }
    }

    private fun updateFilterChipsUI(selected: OrderFilter) {
        val chipMap = mapOf(
            OrderFilter.ALL to binding.chipFilterAll,
            OrderFilter.PLACED to binding.chipFilterPlaced,
            OrderFilter.PREPARING to binding.chipFilterPreparing,
            OrderFilter.DELIVERING to binding.chipFilterDelivering,
            OrderFilter.DELIVERED to binding.chipFilterDelivered,
            OrderFilter.CANCELLED to binding.chipFilterCancelled
        )
        chipMap.forEach { (filter, view) ->
            styleChip(view, filter == selected)
        }
    }

    private fun styleChip(chip: TextView, isSelected: Boolean) {
        val ctx = requireContext()
        if (isSelected) {
            chip.setBackgroundResource(R.drawable.bg_pill_solid_blue)
            chip.setTextColor(ContextCompat.getColor(ctx, R.color.white))
        } else {
            chip.setBackgroundResource(R.drawable.bg_pill_gray)
            chip.setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
