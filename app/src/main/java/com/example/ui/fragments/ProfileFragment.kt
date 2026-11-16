package com.example.ui.fragments

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.example.api.RetrofitClient
import com.example.databinding.FragmentProfileBinding
import com.example.ui.dialogs.ProcessBlueprintBottomSheet
import com.example.viewmodel.SalesViewModel
import com.google.android.material.dialog.MaterialAlertDialogBuilder

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        updateServerUrlText()

        binding.btnCopyShortName.setOnClickListener {
            copyText("Tên doanh nghiệp", "Cty TNHH Viễn Đông")
        }
        binding.btnCopyTaxId.setOnClickListener {
            copyText("Mã số thuế", "0318492015")
        }
        binding.btnCopyBizCode.setOnClickListener {
            copyText("Mã doanh nghiệp", "0318492015-001")
        }
        binding.btnCopyEmail.setOnClickListener {
            copyText("Email liên hệ", "seller@viendong.vn")
        }
        binding.btnCopyPhone.setOnClickListener {
            copyText("Số điện thoại", "0901 234 567")
        }
        binding.btnCopyAddress.setOnClickListener {
            copyText("Địa chỉ trụ sở", "123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh")
        }
        binding.btnCopyBankAccount.setOnClickListener {
            copyText("Số tài khoản Vietcombank", "1028374655")
        }

        binding.btnOpenProcessBlueprint.setOnClickListener {
            ProcessBlueprintBottomSheet().show(parentFragmentManager, "process_blueprint")
        }

        binding.btnConfigServerIp.setOnClickListener {
            showServerIpDialog()
        }
    }

    private fun updateServerUrlText() {
        binding.tvCurrentServerUrl.text = "URL kết nối hiện tại:\n${RetrofitClient.getBaseUrl()}"
    }

    private fun showServerIpDialog() {
        val context = requireContext()
        val presets = arrayOf(
            "1. 10.0.2.2:5000 (Android Emulator)",
            "2. 192.168.50.128:5000 (Wi-Fi máy tính)",
            "3. localhost:5000 (Localhost)",
            "4. Tự nhập IP khác..."
        )
        val presetUrls = arrayOf(
            "http://10.0.2.2:5000/api/",
            "http://192.168.50.128:5000/api/",
            "http://localhost:5000/api/",
            ""
        )

        MaterialAlertDialogBuilder(context)
            .setTitle("Chọn IP Backend Server (MongoDB)")
            .setItems(presets) { _, which ->
                if (which == 3) {
                    showCustomIpInputDialog()
                } else {
                    val url = presetUrls[which]
                    viewModel.updateServerIp(url)
                    updateServerUrlText()
                    Toast.makeText(context, "Đã lưu & chuyển sang: $url", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Hủy", null)
            .show()
    }

    private fun showCustomIpInputDialog() {
        val context = requireContext()
        val input = EditText(context).apply {
            setText(RetrofitClient.getBaseUrl())
            setSelection(text.length)
            hint = "Ví dụ: 192.168.1.100:5000"
        }

        MaterialAlertDialogBuilder(context)
            .setTitle("Nhập IP tùy chỉnh")
            .setMessage("Nhập địa chỉ IP máy tính đang chạy start-backend.bat:")
            .setView(input)
            .setPositiveButton("Lưu & Kết nối") { dialog, _ ->
                val newIp = input.text.toString().trim()
                if (newIp.isNotBlank()) {
                    viewModel.updateServerIp(newIp)
                    updateServerUrlText()
                    Toast.makeText(context, "Đã cập nhật Server IP: $newIp", Toast.LENGTH_SHORT).show()
                }
                dialog.dismiss()
            }
            .setNegativeButton("Hủy", null)
            .show()
    }

    private fun copyText(label: String, value: String) {
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
        Toast.makeText(requireContext(), "Đã sao chép $label: $value", Toast.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
