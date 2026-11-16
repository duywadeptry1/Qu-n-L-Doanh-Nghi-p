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
import com.example.model.OrderStatus
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
                1 -> ProcessBlueprintBottomSheet().show(parentFragmentManager, "process_blueprint")
                2 -> {
                    viewModel.selectOrderFilter(OrderFilter.DELIVERING)
                    (activity as? MainActivity)?.navigateToTab(R.id.nav_orders)
                }
                3 -> (activity as? MainActivity)?.navigateToTab(R.id.nav_income)
            }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.orders.collect { orders ->
                        val kpis = viewModel.computeKpis(orders)
                        binding.tvKpiPlacedCount.text = kpis.placedCount.toString()
                        binding.tvKpiDeliveringCount.text = kpis.deliveringCount.toString()
                        binding.tvKpiDeliveredCount.text = kpis.deliveredCount.toString()
                        binding.tvKpiCancelledCount.text = kpis.cancelledCount.toString()

                        val placed = orders.count { it.status == OrderStatus.PLACED }
                        val delivering = orders.count { it.status == OrderStatus.DELIVERING }
                        val delivered = orders.count { it.status == OrderStatus.DELIVERED }
                        binding.salesPipelineView.setStages(
                            placed = placed,
                            packing = placed + 1,
                            delivering = delivering,
                            settled = delivered
                        )

                        recentOrderAdapter.submitList(orders.take(3))
                    }
                }

                launch {
                    combine(viewModel.calendarDays, viewModel.selectedDayNumber) { days, selected ->
                        days to selected
                    }.collect { (days, selectedDay) ->
                        calendarAdapter.submitList(days, selectedDay)
                        val active = days.find { it.dayNumber == selectedDay } ?: days.first()
                        binding.tvSelectedDateLabel.text = active.fullDate
                        binding.tvSelectedDateOrders.text = "${active.totalOrders} đơn"
                        binding.tvSelectedDateCompleted.text = "${active.completedOrders} Đã hoàn thành"
                        binding.tvSelectedDateDelivering.text = "${active.deliveringOrders} Đang vận chuyển"
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
