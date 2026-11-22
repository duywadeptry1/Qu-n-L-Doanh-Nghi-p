package com.example.ui.dialogs

import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.R
import com.example.databinding.DialogBulkAddProductBinding
import com.example.databinding.ItemBulkProductPreviewBinding
import com.example.model.BulkProductInput
import com.example.model.CurrencyFormatter
import com.example.utils.ExcelProductParser
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class BulkAddProductBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogBulkAddProductBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private val categories = listOf("Thiết bị điện tử", "Phụ kiện")
    private var isExcelMode = true
    private var lastExcelUri: Uri? = null
    private var parsedItems: List<BulkProductInput> = emptyList()
    private val previewAdapter = BulkPreviewAdapter()

    private val pickExcelLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            lastExcelUri = uri
            parseSelectedExcelFile(uri)
        }
    }

    private val createSampleExcelLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ) { uri: Uri? ->
        if (uri != null) {
            viewLifecycleOwner.lifecycleScope.launch {
                val ok = withContext(Dispatchers.IO) {
                    runCatching {
                        requireContext().contentResolver.openOutputStream(uri)?.use { out ->
                            ExcelProductParser.writeSampleXlsx(out)
                        } ?: error("Không thể ghi vào vị trí đã chọn")
                    }.isSuccess
                }
                if (_binding == null) return@launch
                if (ok) {
                    Toast.makeText(
                        requireContext(),
                        "Đã lưu file Excel mẫu! Bạn có thể mở và thêm 100+ sản phẩm vào đó.",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Toast.makeText(requireContext(), "Không thể lưu file mẫu", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogBulkAddProductBinding.inflate(inflater, container, false)
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

        binding.spinnerBulkDefaultCategory.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            categories
        )

        binding.rvBulkPreview.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = previewAdapter
        }

        setupListeners()
        switchMode(excelMode = arguments?.getBoolean(ARG_START_QUICK_TEXT, false)?.not() ?: true)
    }

    private fun setupListeners() {
        binding.btnCloseBulkAdd.setOnClickListener { dismiss() }

        binding.tabModeExcel.setOnClickListener { switchMode(excelMode = true) }
        binding.tabModeQuickText.setOnClickListener { switchMode(excelMode = false) }

        binding.btnPickExcelFile.setOnClickListener {
            pickExcelLauncher.launch(arrayOf("*/*"))
        }

        binding.btnDownloadSampleExcel.setOnClickListener {
            createSampleExcelLauncher.launch("mau_san_pham_viendong.xlsx")
        }

        binding.btnInsertQuickSample.setOnClickListener {
            val sample = buildString {
                appendLine("Chuột Không Dây Logitech M331 | 350000 | 50 | Phụ kiện | VD-CH01")
                appendLine("Bàn Phím Cơ Bluetooth K8 Pro | 1290000 | 25 | Thiết bị điện tử | VD-BP02")
                appendLine("Cáp Sạc Nhanh Type-C 100W 2m | 145000 | 120 | Phụ kiện | VD-CS03")
                appendLine("Bộ Chia Mạng Gigabit 8 Cổng | 550000 | 35 | Thiết bị điện tử | VD-CM04")
                append("Giá Đỡ Laptop Nhôm Tản Nhiệt | 420000 | 40 | Phụ kiện | VD-GD05")
            }
            binding.etBulkQuickText.setText(sample)
        }

        binding.btnClearQuickText.setOnClickListener {
            binding.etBulkQuickText.setText("")
        }

        val reparseWatcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                if (!isExcelMode) {
                    parseQuickTextInput()
                } else {
                    lastExcelUri?.let { parseSelectedExcelFile(it) }
                }
            }
            override fun afterTextChanged(s: Editable?) = Unit
        }

        binding.etBulkQuickText.addTextChangedListener(reparseWatcher)
        binding.etBulkDefaultStock.addTextChangedListener(reparseWatcher)

        binding.spinnerBulkDefaultCategory.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (!isExcelMode) {
                    parseQuickTextInput()
                } else {
                    lastExcelUri?.let { parseSelectedExcelFile(it) }
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        binding.btnSubmitBulkProducts.setOnClickListener {
            if (parsedItems.isEmpty()) return@setOnClickListener
            val itemsToSave = parsedItems
            setSubmitting(true, itemsToSave.size)
            viewLifecycleOwner.lifecycleScope.launch {
                val outcome = viewModel.addProductsBulk(itemsToSave)
                if (_binding == null) return@launch
                setSubmitting(false, itemsToSave.size)
                Toast.makeText(requireContext(), outcome.message, Toast.LENGTH_LONG).show()
                if (outcome.success) {
                    dismiss()
                }
            }
        }
    }

    private fun switchMode(excelMode: Boolean) {
        isExcelMode = excelMode
        val ctx = requireContext()
        if (excelMode) {
            binding.tabModeExcel.setBackgroundResource(R.drawable.bg_pill_white)
            binding.tabModeExcel.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
            binding.tabModeQuickText.background = null
            binding.tabModeQuickText.setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))

            binding.layoutExcelMode.visibility = View.VISIBLE
            binding.layoutQuickTextMode.visibility = View.GONE

            val uri = lastExcelUri
            if (uri != null) {
                parseSelectedExcelFile(uri)
            } else {
                applyParseResult(ExcelProductParser.ParseResult(emptyList(), emptyList()), showEmptyStatus = false)
            }
        } else {
            binding.tabModeQuickText.setBackgroundResource(R.drawable.bg_pill_white)
            binding.tabModeQuickText.setTextColor(ContextCompat.getColor(ctx, R.color.primary_blue))
            binding.tabModeExcel.background = null
            binding.tabModeExcel.setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))

            binding.layoutExcelMode.visibility = View.GONE
            binding.layoutQuickTextMode.visibility = View.VISIBLE
            parseQuickTextInput()
        }
    }

    private fun selectedDefaultCategory(): String {
        return categories.getOrElse(binding.spinnerBulkDefaultCategory.selectedItemPosition) {
            "Thiết bị điện tử"
        }
    }

    private fun selectedDefaultStock(): Int {
        return binding.etBulkDefaultStock.text?.toString()?.toIntOrNull()?.coerceAtLeast(0) ?: 10
    }

    private fun parseSelectedExcelFile(uri: Uri) {
        val defaultCat = selectedDefaultCategory()
        val defaultStock = selectedDefaultStock()
        val fileName = ExcelProductParser.getDisplayName(requireContext(), uri)
        binding.tvSelectedExcelName.text = "⏳ Đang đọc file: $fileName..."

        viewLifecycleOwner.lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                ExcelProductParser.parseUri(requireContext(), uri, defaultCat, defaultStock)
            }
            if (_binding == null || !isExcelMode) return@launch
            binding.tvSelectedExcelName.text = "📄 Đã chọn: $fileName"
            applyParseResult(result, showEmptyStatus = true)
        }
    }

    private fun parseQuickTextInput() {
        val raw = binding.etBulkQuickText.text?.toString().orEmpty()
        if (raw.isBlank()) {
            applyParseResult(ExcelProductParser.ParseResult(emptyList(), emptyList()), showEmptyStatus = false)
            return
        }
        val result = ExcelProductParser.parseQuickText(
            rawText = raw,
            defaultCategory = selectedDefaultCategory(),
            defaultStock = selectedDefaultStock()
        )
        applyParseResult(result, showEmptyStatus = true)
    }

    private fun applyParseResult(result: ExcelProductParser.ParseResult, showEmptyStatus: Boolean) {
        parsedItems = result.items
        previewAdapter.submitList(result.items)

        if (!showEmptyStatus && result.items.isEmpty() && result.errors.isEmpty() && result.fileError == null) {
            binding.layoutParseStatus.visibility = View.GONE
            binding.rvBulkPreview.visibility = View.GONE
            binding.btnSubmitBulkProducts.isEnabled = false
            binding.btnSubmitBulkProducts.alpha = 0.55f
            binding.btnSubmitBulkProducts.text = "Chọn file hoặc nhập sản phẩm để lưu"
            return
        }

        binding.layoutParseStatus.visibility = View.VISIBLE
        val ctx = requireContext()

        if (result.fileError != null) {
            binding.tvBulkSummaryStatus.text = "❌ ${result.fileError}"
            binding.tvBulkSummaryStatus.setTextColor(ContextCompat.getColor(ctx, R.color.red_primary))
            binding.tvBulkErrorDetail.visibility = View.GONE
            binding.rvBulkPreview.visibility = View.GONE
        } else {
            val count = result.items.size
            if (count > 0) {
                binding.tvBulkSummaryStatus.text = "✅ Nhận diện $count sản phẩm hợp lệ"
                binding.tvBulkSummaryStatus.setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
                binding.rvBulkPreview.visibility = View.VISIBLE
            } else {
                binding.tvBulkSummaryStatus.text = "⚠️ Chưa có sản phẩm hợp lệ nào"
                binding.tvBulkSummaryStatus.setTextColor(ContextCompat.getColor(ctx, R.color.amber_text))
                binding.rvBulkPreview.visibility = View.GONE
            }

            if (result.errors.isNotEmpty()) {
                val firstFew = result.errors.take(3).joinToString("\n") {
                    "• Dòng ${it.rowNumber}: ${it.reason}"
                }
                val more = if (result.errors.size > 3) "\n...và ${result.errors.size - 3} dòng lỗi khác" else ""
                binding.tvBulkErrorDetail.text = "⚠️ Bỏ qua ${result.errors.size} dòng chưa hợp lệ:\n$firstFew$more"
                binding.tvBulkErrorDetail.visibility = View.VISIBLE
            } else {
                binding.tvBulkErrorDetail.visibility = View.GONE
            }
        }

        val canSubmit = result.items.isNotEmpty()
        binding.btnSubmitBulkProducts.isEnabled = canSubmit
        binding.btnSubmitBulkProducts.alpha = if (canSubmit) 1f else 0.55f
        binding.btnSubmitBulkProducts.text = if (canSubmit) {
            "Lưu ${result.items.size} sản phẩm vào MongoDB"
        } else {
            "Chưa có sản phẩm hợp lệ để lưu"
        }
    }

    private fun setSubmitting(submitting: Boolean, count: Int) {
        binding.btnSubmitBulkProducts.isEnabled = !submitting
        binding.btnSubmitBulkProducts.alpha = if (submitting) 0.7f else 1f
        binding.btnSubmitBulkProducts.text = if (submitting) {
            "⏳ Đang lưu $count sản phẩm..."
        } else {
            "Lưu $count sản phẩm vào MongoDB"
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }

    private class BulkPreviewAdapter : RecyclerView.Adapter<BulkPreviewAdapter.ViewHolder>() {
        private var items: List<BulkProductInput> = emptyList()

        fun submitList(list: List<BulkProductInput>) {
            items = list
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemBulkProductPreviewBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(position + 1, items[position])
        }

        override fun getItemCount(): Int = items.size

        class ViewHolder(
            private val binding: ItemBulkProductPreviewBinding
        ) : RecyclerView.ViewHolder(binding.root) {
            fun bind(index: Int, item: BulkProductInput) {
                binding.tvPreviewIndex.text = index.toString()
                binding.tvPreviewName.text = item.name
                val skuPart = if (item.sku.isNotBlank()) " • SKU: ${item.sku}" else ""
                val importPart = if (item.importPrice > 0L) " • Nhập: ${CurrencyFormatter.formatVnd(item.importPrice)}" else ""
                binding.tvPreviewMeta.text = "${item.category} • Tồn: ${item.stock}$importPart$skuPart"
                binding.tvPreviewPrice.text = "Xuất: ${CurrencyFormatter.formatVnd(item.price)}"
            }
        }
    }

    companion object {
        private const val ARG_START_QUICK_TEXT = "arg_start_quick_text"

        fun newInstance(startWithQuickText: Boolean = false): BulkAddProductBottomSheet {
            return BulkAddProductBottomSheet().apply {
                arguments = Bundle().apply {
                    putBoolean(ARG_START_QUICK_TEXT, startWithQuickText)
                }
            }
        }
    }
}
