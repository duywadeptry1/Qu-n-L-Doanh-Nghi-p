package com.example.ui.dialogs

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.databinding.DialogNotificationsBinding
import com.example.ui.adapters.NotificationAdapter
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

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

        val adapter = NotificationAdapter()
        binding.rvNotifications.layoutManager = LinearLayoutManager(requireContext())
        binding.rvNotifications.adapter = adapter
        adapter.submitList(viewModel.notifications.value)

        viewModel.markNotificationsRead()

        binding.btnCloseNotif.setOnClickListener { dismiss() }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
