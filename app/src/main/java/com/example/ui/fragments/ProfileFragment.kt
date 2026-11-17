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
import androidx.lifecycle.lifecycleScope
import com.example.api.RetrofitClient
import com.example.databinding.FragmentProfileBinding
import com.example.ui.dialogs.ProcessBlueprintBottomSheet
import com.example.viewmodel.SalesViewModel
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

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

        checkAndDisplayStatus()

        binding.btnCopyShortName.setOnClickListener {
            copyText("Tên doanh nghiệp", "Cty TNHH Viễn Đông")
        }
        binding.btnCopyTaxId.setOnClickListener {
            copyText("Mã số thuế", "0318492015")
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

    private fun updateServerUrlText(statusLine: String? = null) {
        val base = "URL kết nối hiện tại:\n${RetrofitClient.getBaseUrl()}"
        binding.tvCurrentServerUrl.text = if (statusLine != null) "$base\n$statusLine" else base
    }

    private fun showServerIpDialog() {
        val context = requireContext()
        val presets = arrayOf(
            "1. Cáp USB (127.0.0.1:5000 – tự động qua adb reverse)",
            "2. Wi-Fi LAN (192.168.0.101:5000 – cùng mạng Wi-Fi)",
            "3. Android Emulator (10.0.2.2:5000)",
            "4. Tự nhập IP khác..."
        )

        MaterialAlertDialogBuilder(context)
            .setTitle("Chọn IP Backend Server (MongoDB)")
            .setItems(presets) { _, which ->
                when (which) {
                    0 -> applyServerUrl(RetrofitClient.USB_LOCALHOST_URL)
                    1 -> applyServerUrl(RetrofitClient.LAN_FALLBACK_URL)
                    2 -> applyServerUrl(RetrofitClient.EMULATOR_URL)
                    else -> showCustomIpInputDialog()
                }
            }
            .setNegativeButton("Hủy", null)
            .show()
    }

    private fun applyServerUrl(hostOrUrl: String) {
        viewModel.updateServerIp(hostOrUrl)
        onServerUrlChanged()
    }

    /** Refreshes the label and pings /api/health so the user gets immediate feedback. */
    private fun onServerUrlChanged() {
        val url = RetrofitClient.getBaseUrl()
        Toast.makeText(requireContext(), "Đang kiểm tra kết nối tới $url ...", Toast.LENGTH_SHORT).show()
        checkAndDisplayStatus(showToast = true)
    }

    private fun checkAndDisplayStatus(showToast: Boolean = false) {
        updateServerUrlText("⏳ Đang kiểm tra kết nối...")
        viewLifecycleOwner.lifecycleScope.launch {
            val (ok, message) = viewModel.checkBackendConnection()
            if (_binding == null) return@launch
            val statusLine = if (ok) {
                "✅ Đã kết nối Backend ($message)"
            } else {
                "❌ Lỗi kết nối: $message"
            }
            updateServerUrlText(statusLine)
            if (showToast) {
                val ctx = context ?: return@launch
                Toast.makeText(ctx, statusLine, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showCustomIpInputDialog() {
        val context = requireContext()
        val input = EditText(context).apply {
            setText(RetrofitClient.getBaseUrl())
            setSelection(text.length)
            hint = "Ví dụ: 192.168.0.101:5000"
        }

        MaterialAlertDialogBuilder(context)
            .setTitle("Nhập IP tùy chỉnh")
            .setMessage("Nhập IP LAN của máy tính đang chạy backend (xem dòng 📱 trong log của npm run dev):")
            .setView(input)
            .setPositiveButton("Lưu & Kết nối") { dialog, _ ->
                val newIp = input.text.toString().trim()
                if (newIp.isNotBlank()) {
                    applyServerUrl(newIp)
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
