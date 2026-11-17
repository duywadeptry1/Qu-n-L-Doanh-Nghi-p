package com.example.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.MainActivity
import com.example.R
import com.example.databinding.FragmentHomeBinding
import com.example.model.OrderFilter
import com.example.ui.adapters.CalendarDayAdapter
import com.example.ui.adapters.RecentOrderAdapter
import com.example.ui.dialogs.NotificationsBottomSheet
import com.example.ui.dialogs.OrderDetailBottomSheet
import com.example.ui.dialogs.ProcessBlueprintBottomSheet
import com.example.viewmodel.SalesViewModel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private lateinit var calendarAdapter: CalendarDayAdapter
    private lateinit var recentOrderAdapter: RecentOrderAdapter
    private var hasScrolledToToday = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerViews()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupRecyclerViews() {
        calendarAdapter = CalendarDayAdapter { day ->
            viewModel.selectCalendarDay(day.dayNumber)
        }
        binding.rvCalendarDays.apply {
            layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
            adapter = calendarAdapter
        }

        recentOrderAdapter = RecentOrderAdapter { order ->
            OrderDetailBottomSheet.newInstance(order.id)
                .show(parentFragmentManager, "order_detail")
        }
        binding.rvRecentOrders.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = recentOrderAdapter
        }
    }

    private fun setupClickListeners() {
        val openProfile: (View) -> Unit = {
            (activity as? MainActivity)?.navigateToTab(R.id.nav_profile)
        }
        binding.btnCompanyAvatar.setOnClickListener(openProfile)
        binding.layoutCompanyHeader.setOnClickListener(openProfile)

        binding.btnNotifications.setOnClickListener {
            NotificationsBottomSheet().show(parentFragmentManager, "notifications")
        }

        binding.cardKpiPlaced.setOnClickListener {
            viewModel.selectOrderFilter(OrderFilter.PLACED)
            (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
        }
        binding.cardKpiDelivering.setOnClickListener {
            viewModel.selectOrderFilter(OrderFilter.DELIVERING)
            (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
        }
        binding.cardKpiDelivered.setOnClickListener {
            viewModel.selectOrderFilter(OrderFilter.DELIVERED)
            (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
        }
        binding.cardKpiCancelled.setOnClickListener {
            viewModel.selectOrderFilter(OrderFilter.CANCELLED)
            (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
        }

        binding.tvViewAllOrders.setOnClickListener {
            viewModel.selectOrderFilter(OrderFilter.ALL)
            (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
        }

        binding.cardSalesPipeline.setOnClickListener {
            ProcessBlueprintBottomSheet().show(parentFragmentManager, "process_blueprint")
        }

        binding.salesPipelineView.setOnStageClickListener { stageIndex ->
            when (stageIndex) {
                0 -> {
                    viewModel.selectOrderFilter(OrderFilter.PLACED)
                    (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
                }
                1 -> {
                    viewModel.selectOrderFilter(OrderFilter.PREPARING)
                    (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
                }
                2 -> {
                    viewModel.selectOrderFilter(OrderFilter.DELIVERING)
                    (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
                }
                3 -> {
                    viewModel.selectOrderFilter(OrderFilter.DELIVERED)
                    (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
                }
            }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    combine(
                        viewModel.orders,
                        viewModel.calendarDays,
                        viewModel.selectedDayNumber
                    ) { orders, days, selectedDay ->
                        Triple(orders, days, selectedDay)
                    }.collect { (orders, days, selectedDay) ->
                        val kpis = viewModel.computeKpis(orders)
                        binding.tvKpiPlacedCount.text = (kpis.placedCount + kpis.preparingCount).toString()
                        binding.tvKpiDeliveringCount.text = kpis.deliveringCount.toString()
                        binding.tvKpiDeliveredCount.text = kpis.deliveredCount.toString()
                        binding.tvKpiCancelledCount.text = kpis.cancelledCount.toString()

                        binding.salesPipelineView.setStages(
                            placed = kpis.placedCount,
                            packing = kpis.preparingCount,
                            delivering = kpis.deliveringCount,
                            settled = kpis.deliveredCount
                        )

                        calendarAdapter.submitList(days, selectedDay)
                        if (!hasScrolledToToday && days.isNotEmpty()) {
                            hasScrolledToToday = true
                            val targetIdx = (selectedDay - 3).coerceAtLeast(0)
                            binding.rvCalendarDays.post {
                                _binding?.rvCalendarDays?.scrollToPosition(targetIdx)
                            }
                        }

                        val active = days.find { it.dayNumber == selectedDay } ?: days.firstOrNull()
                        if (active != null) {
                            binding.tvSelectedDateLabel.text = active.fullDate
                            if (active.isFuture) {
                                binding.tvSelectedDateOrders.text = "-- (Chưa tới ngày)"
                                binding.tvSelectedDateCompleted.text = "Chưa có dữ liệu"
                                binding.tvSelectedDateDelivering.text = "Ngày chưa tới"
                            } else {
                                binding.tvSelectedDateOrders.text = "${active.totalOrders} đơn thực tế"
                                binding.tvSelectedDateCompleted.text = "${active.completedOrders} Đã đến tay KH"
                                binding.tvSelectedDateDelivering.text = "${active.deliveringOrders} Đang xử lý / giao"
                            }
                        }

                        val dayOrders = viewModel.getOrdersForDay(selectedDay, orders)
                        val displayOrders = if (dayOrders.isNotEmpty()) {
                            dayOrders
                        } else if (selectedDay <= SalesViewModel.TODAY_DAY) {
                            orders.take(4)
                        } else {
                            emptyList()
                        }
                        recentOrderAdapter.submitList(displayOrders)
                    }
                }

                launch {
                    viewModel.hasUnreadNotifications.collect { hasUnread ->
                        binding.viewUnreadDot.visibility = if (hasUnread) View.VISIBLE else View.GONE
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
