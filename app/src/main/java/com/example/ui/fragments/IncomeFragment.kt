package com.example.ui.fragments

import android.os.Bundle
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
import com.example.databinding.FragmentIncomeBinding
import com.example.model.IncomePeriod
import com.example.model.PaymentType
import com.example.ui.adapters.TransactionAdapter
import com.example.ui.dialogs.OrderDetailBottomSheet
import com.example.viewmodel.SalesViewModel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class IncomeFragment : Fragment() {

    private var _binding: FragmentIncomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private lateinit var txAdapter: TransactionAdapter

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

        binding.tabPeriodWeek.setOnClickListener { viewModel.selectIncomePeriod(IncomePeriod.WEEK) }
        binding.tabPeriodMonth.setOnClickListener { viewModel.selectIncomePeriod(IncomePeriod.MONTH) }
        binding.tabPeriodYear.setOnClickListener { viewModel.selectIncomePeriod(IncomePeriod.YEAR) }

        binding.btnFilterTxType.setOnClickListener {
            viewModel.cycleTransactionFilter()
        }

        observeViewModel()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.incomePeriod.collect { period ->
                        updatePeriodTabs(period)
                        val data = viewModel.getIncomeData(period)
                        binding.tvIncomeHeroLabel.text = data.heroLabel
                        binding.tvIncomeTotal.text = data.totalFormatted
                        binding.tvIncomeGrowth.text = data.growthPercent
                        binding.tvIncomeCod.text = data.codFormatted
                        binding.tvIncomeBank.text = data.bankFormatted
                        binding.tvChartAvg.text = data.avgFormatted
                        binding.tvChartPeak.text = data.peakText
                        binding.incomeBarChart.setData(data.bars, data.maxAxisValue, initialSelection = 0)
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

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
