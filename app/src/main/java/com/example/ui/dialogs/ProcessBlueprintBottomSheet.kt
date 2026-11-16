package com.example.ui.dialogs

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.example.databinding.DialogProcessBlueprintBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class ProcessBlueprintBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogProcessBlueprintBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogProcessBlueprintBinding.inflate(inflater, container, false)
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

        binding.btnCloseBlueprint.setOnClickListener { dismiss() }
        binding.btnBlueprintDone.setOnClickListener { dismiss() }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
