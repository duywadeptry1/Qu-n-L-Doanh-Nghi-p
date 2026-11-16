package com.example.ui.fragments

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.R
import com.example.databinding.FragmentOrdersBinding
import com.example.model.OrderFilter
import com.example.model.OrderStatus
import com.example.ui.adapters.OrderCardAdapter
import com.example.ui.dialogs.CreateOrderBottomSheet
import com.example.ui.dialogs.OrderDetailBottomSheet
import com.example.viewmodel.SalesViewModel
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

        orderAdapter = OrderCardAdapter { order ->
            OrderDetailBottomSheet.newInstance(order.id)
                .show(parentFragmentManager, "order_detail")
        }
        binding.rvOrders.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = orderAdapter
        }

        setupListeners()
        observeViewModel()
    }

    private fun setupListeners() {
        binding.chipFilterAll.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.ALL) }
        binding.chipFilterPlaced.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.PLACED) }
        binding.chipFilterDelivering.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.DELIVERING) }
        binding.chipFilterDelivered.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.DELIVERED) }
        binding.chipFilterCancelled.setOnClickListener { viewModel.selectOrderFilter(OrderFilter.CANCELLED) }

        binding.btnCreateOrder.setOnClickListener {
            CreateOrderBottomSheet().show(parentFragmentManager, "create_order")
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
