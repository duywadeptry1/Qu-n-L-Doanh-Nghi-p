package com.example.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.R
import com.example.databinding.FragmentIncomeBinding
import com.example.model.CurrencyFormatter
import com.example.model.IncomeChartMetric
import com.example.model.IncomePeriod
import com.example.model.PaymentType
import com.example.ui.adapters.TransactionAdapter
import com.example.ui.adapters.VipCustomerAdapter
import com.example.ui.dialogs.OrderDetailBottomSheet
import com.example.viewmodel.SalesViewModel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class IncomeFragment : Fragment() {

    private var _binding: FragmentIncomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private lateinit var txAdapter: TransactionAdapter
    private lateinit var vipAdapter: VipCustomerAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentIncomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        txAdapter = TransactionAdapter { tx ->
            val orderId = tx.orderCode.removePrefix("#")
            if (viewModel.getOrderById(orderId) != null) {
                OrderDetailBottomSheet.newInstance(orderId)
                    .show(parentFragmentManager, "order_detail")
            }
        }
        binding.rvTransactions.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = txAdapter
        }

        vipAdapter = VipCustomerAdapter()
        binding.rvVipCustomers.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = vipAdapter
        }

        binding.tabPeriodWeek.setOnClickListener { viewModel.selectIncomePeriod(IncomePeriod.WEEK) }
        binding.tabPeriodMonth.setOnClickListener { viewModel.selectIncomePeriod(IncomePeriod.MONTH) }
        binding.tabPeriodYear.setOnClickListener { viewModel.selectIncomePeriod(IncomePeriod.YEAR) }

        binding.tabMetricRevenue.setOnClickListener { viewModel.selectIncomeChartMetric(IncomeChartMetric.REVENUE) }
        binding.tabMetricProfit.setOnClickListener { viewModel.selectIncomeChartMetric(IncomeChartMetric.PROFIT) }

        binding.btnFilterTxType.setOnClickListener {
            viewModel.cycleTransactionFilter()
        }

        observeViewModel()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    combine(
                        viewModel.incomePeriod,
                        viewModel.incomeChartMetric,
                        viewModel.orders,
                        viewModel.products
                    ) { period, metric, orders, products ->
                        listOf(period, metric, orders, products)
                    }.collect { combined ->
                        val period = combined[0] as IncomePeriod
                        val metric = combined[1] as IncomeChartMetric
                        @Suppress("UNCHECKED_CAST")
                        val orders = combined[2] as List<com.example.model.Order>
                        @Suppress("UNCHECKED_CAST")
                        val products = combined[3] as List<com.example.model.Product>

                        updatePeriodTabs(period)
                        updateMetricTabs(metric)

                        val data = viewModel.getIncomeData(period, orders, metric, products)
                        binding.tvIncomeHeroLabel.text = data.heroLabel
                        binding.tvIncomeTotal.text = data.totalFormatted
                        binding.tvIncomeProfit.text = data.totalProfitFormatted
                        binding.tvIncomeCost.text = data.totalCostFormatted
                        binding.tvProfitMargin.text = "Biên ${data.profitMarginFormatted}"
                        binding.tvIncomeGrowth.text = data.growthPercent
                        binding.tvIncomeCod.text = data.codFormatted
                        binding.tvIncomeBank.text = data.bankFormatted
                        binding.tvChartAvg.text = data.avgFormatted
                        binding.tvChartPeak.text = data.peakText

                        binding.tvChartTitle.text = if (metric == IncomeChartMetric.PROFIT) {
                            "BIỂU ĐỒ LỢI NHUẬN"
                        } else {
                            "BIỂU ĐỒ DOANH THU"
                        }

                        binding.incomeBarChart.setData(
                            points = data.bars,
                            maxVal = data.maxAxisValue,
                            initialSelection = data.defaultSelectedIndex,
                            profitMode = metric == IncomeChartMetric.PROFIT
                        )

                        // B2B vs B2C stats
                        val b2b = data.b2bStats
                        val b2c = data.b2cStats
                        binding.tvChannelRatioBadge.text =
                            "${b2b.channel.symbol} ${b2b.sharePercent}% • ${b2c.channel.symbol} ${b2c.sharePercent}%"
                        binding.tvB2bShare.text = "${b2b.sharePercent}%"
                        binding.tvB2bRevenue.text = CurrencyFormatter.formatVnd(b2b.revenue)
                        binding.tvB2bProfit.text = "Lãi: +${CurrencyFormatter.formatVnd(b2b.profit)}"
                        binding.tvB2bOrders.text = "${b2b.orderCount} đơn doanh nghiệp"

                        binding.tvB2cShare.text = "${b2c.sharePercent}%"
                        binding.tvB2cRevenue.text = CurrencyFormatter.formatVnd(b2c.revenue)
                        binding.tvB2cProfit.text = "Lãi: +${CurrencyFormatter.formatVnd(b2c.profit)}"
                        binding.tvB2cOrders.text = "${b2c.orderCount} đơn bán lẻ"

                        val b2bWeight = if (b2b.revenue + b2c.revenue == 0L) 50f else b2b.sharePercent.coerceIn(5, 95).toFloat()
                        val b2cWeight = 100f - b2bWeight
                        (binding.barB2bShare.layoutParams as? LinearLayout.LayoutParams)?.let { lp ->
                            lp.weight = b2bWeight
                            binding.barB2bShare.layoutParams = lp
                        }
                        (binding.barB2cShare.layoutParams as? LinearLayout.LayoutParams)?.let { lp ->
                            lp.weight = b2cWeight
                            binding.barB2cShare.layoutParams = lp
                        }

                        // VIP Customers / Representatives list
                        binding.tvVipSavingsBadge.text = "Đã ưu đãi: ${data.totalVipSavingsFormatted}"
                        val profiles = viewModel.getCustomerProfiles(orders)
                        vipAdapter.submitList(profiles)
                    }
                }

                launch {
                    combine(viewModel.transactions, viewModel.txTypeFilter) { list, filter ->
                        list to filter
                    }.collect { (list, filter) ->
                        binding.btnFilterTxType.text = when (filter) {
                            PaymentType.ALL -> getString(R.string.income_tx_filter)
                            else -> "Lọc: ${filter.label}"
                        }
                        val filtered = if (filter == PaymentType.ALL) {
                            list
                        } else {
                            list.filter { it.paymentType == filter }
                        }
                        txAdapter.submitList(filtered)
                    }
                }
            }
        }
    }

    private fun updatePeriodTabs(selected: IncomePeriod) {
        val map = mapOf(
            IncomePeriod.WEEK to binding.tabPeriodWeek,
            IncomePeriod.MONTH to binding.tabPeriodMonth,
            IncomePeriod.YEAR to binding.tabPeriodYear
        )
        val ctx = requireContext()
        map.forEach { (period, tab: TextView) ->
            if (period == selected) {
                tab.setBackgroundResource(R.drawable.bg_pill_white)
                tab.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
            } else {
                tab.background = null
                tab.setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
            }
        }
    }

    private fun updateMetricTabs(selected: IncomeChartMetric) {
        val ctx = requireContext()
        if (selected == IncomeChartMetric.REVENUE) {
            binding.tabMetricRevenue.setBackgroundResource(R.drawable.bg_pill_white)
            binding.tabMetricRevenue.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
            binding.tabMetricProfit.background = null
            binding.tabMetricProfit.setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
        } else {
            binding.tabMetricProfit.setBackgroundResource(R.drawable.bg_pill_white)
            binding.tabMetricProfit.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
            binding.tabMetricRevenue.background = null
            binding.tabMetricRevenue.setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
