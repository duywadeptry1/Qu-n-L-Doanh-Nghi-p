package com.example.ui.dialogs

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.MainActivity
import com.example.R
import com.example.databinding.DialogNotificationsBinding
import com.example.ui.adapters.NotificationAdapter
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.launch

class NotificationsBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogNotificationsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogNotificationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        dialog?.setOnShowListener { dialogInterface ->
            val sheet = (dialogInterface as? BottomSheetDialog)?.findViewById<View>(
                com.google.android.material.R.id.design_bottom_sheet
            )
            sheet?.setBackgroundColor(Color.TRANSPARENT)
        }

        val adapter = NotificationAdapter { notif ->
            val orderRegex = Regex("(DH-\\d+)")
            val match = orderRegex.find(notif.title) ?: orderRegex.find(notif.message)
            if (match != null) {
                val orderId = match.groupValues[1]
                dismiss()
                OrderDetailBottomSheet.newInstance(orderId)
                    .show(parentFragmentManager, "order_detail")
            } else if (notif.isAlert) {
                dismiss()
                (activity as? MainActivity)?.navigateToTab(R.id.nav_products)
            }
        }
        binding.rvNotifications.layoutManager = LinearLayoutManager(requireContext())
        binding.rvNotifications.adapter = adapter

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.notifications.collect { list ->
                    adapter.submitList(list)
                }
            }
        }

        viewModel.markNotificationsRead()

        binding.btnCloseNotif.setOnClickListener { dismiss() }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
