package com.example.ui.dialogs

import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.example.R
import com.example.databinding.DialogAddProductBinding
import com.example.model.Product
import com.example.utils.ImageUtils
import com.example.viewmodel.SalesViewModel
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

class AddProductBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogAddProductBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SalesViewModel by activityViewModels()

    private var encodedBase64Image: String? = null
    private var editingProductId: String? = null

    private val categories = listOf("Thiết bị điện tử", "Phụ kiện")

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            binding.ivProductPreview.setImageURI(uri)
            binding.tvImageUriHint.text = "⏳ Đang nén & chuẩn bị ảnh để tải lên DB..."
            binding.tvImageUriHint.setTextColor(resources.getColor(R.color.primary_blue, null))

            viewLifecycleOwner.lifecycleScope.launch {
                val base64 = ImageUtils.compressUriToBase64(requireContext(), uri)
                if (_binding == null) return@launch

                if (base64 != null) {
                    encodedBase64Image = base64
                    binding.etProductImageUrl.setText("")
                    binding.btnRemoveImage.visibility = View.VISIBLE
                    val approxKb = base64.length * 3 / 4 / 1024
                    binding.tvImageUriHint.text = "✅ Đã nén thành công (~$approxKb KB) • Sẵn sàng tải lên MongoDB!"
                    binding.tvImageUriHint.setTextColor(resources.getColor(R.color.green_primary, null))
                } else {
                    binding.tvImageUriHint.text = "⚠️ Không thể đọc file ảnh này, vui lòng chọn ảnh khác"
                    binding.tvImageUriHint.setTextColor(resources.getColor(R.color.red_primary, null))
                }
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogAddProductBinding.inflate(inflater, container, false)
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

        editingProductId = arguments?.getString(ARG_PRODUCT_ID)

        binding.spinnerProductCategory.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            categories
        )

        binding.btnCloseAddProduct.setOnClickListener { dismiss() }

        binding.btnPickGalleryImage.setOnClickListener {
            pickImageLauncher.launch("image/*")
        }

        binding.btnRemoveImage.setOnClickListener {
            encodedBase64Image = ""
            binding.etProductImageUrl.setText("")
            binding.ivProductPreview.setImageResource(R.drawable.img_product_electronics)
            binding.tvImageUriHint.text = "Đã bỏ ảnh (dùng biểu tượng mặc định)"
            binding.tvImageUriHint.setTextColor(resources.getColor(R.color.text_muted, null))
            binding.btnRemoveImage.visibility = View.GONE
        }

        binding.btnSwitchToBulkAdd.setOnClickListener {
            val fm = parentFragmentManager
            dismiss()
            BulkAddProductBottomSheet.newInstance(startWithQuickText = false)
                .show(fm, "bulk_add_product")
        }

        val existingProduct = editingProductId?.let { id ->
            viewModel.products.value.find { it.id == id }
        }

        if (existingProduct != null) {
            binding.btnSwitchToBulkAdd.visibility = View.GONE
            binding.btnSaveAndContinue.visibility = View.GONE
            binding.btnDeleteProduct.visibility = View.VISIBLE
            binding.tvDialogTitle.text = "Chỉnh Sửa Sản Phẩm #${existingProduct.sku}"
            binding.btnSubmitProduct.text = "Cập nhật vào MongoDB & Kho"
            binding.etProductName.setText(existingProduct.name)
            binding.etProductPrice.setText(existingProduct.price.toString())
            binding.etProductStock.setText(existingProduct.stock.toString())
            binding.etProductDescription.setText(existingProduct.description)

            val catIndex = categories.indexOf(existingProduct.category).coerceAtLeast(0)
            binding.spinnerProductCategory.setSelection(catIndex)

            if (existingProduct.imageUrl.isNotBlank()) {
                encodedBase64Image = existingProduct.imageUrl
                ImageUtils.loadProductImage(
                    binding.ivProductPreview,
                    existingProduct.imageUrl,
                    existingProduct.imageRes
                )
                binding.btnRemoveImage.visibility = View.VISIBLE
                binding.tvImageUriHint.text = "Sản phẩm đã có ảnh trên Database"
                binding.tvImageUriHint.setTextColor(resources.getColor(R.color.green_primary, null))
            } else {
                binding.ivProductPreview.setImageResource(existingProduct.imageRes)
                binding.tvImageUriHint.text = "Chưa có ảnh riêng (đang dùng icon mặc định)"
            }

            binding.btnDeleteProduct.setOnClickListener {
                MaterialAlertDialogBuilder(requireContext())
                    .setTitle("Xác nhận xoá sản phẩm")
                    .setMessage("Bạn có chắc chắn muốn xoá vĩnh viễn '${existingProduct.name}' khỏi kho hàng và cơ sở dữ liệu MongoDB?")
                    .setPositiveButton("Xoá vĩnh viễn") { _, _ ->
                        viewModel.deleteProduct(existingProduct.id)
                        Toast.makeText(requireContext(), "Đã xoá '${existingProduct.name}'", Toast.LENGTH_SHORT).show()
                        dismiss()
                    }
                    .setNegativeButton("Huỷ", null)
                    .show()
            }
        }

        fun submitForm(closeAfterSave: Boolean) {
            val name = binding.etProductName.text?.toString()?.trim().orEmpty()
            val price = binding.etProductPrice.text?.toString()?.toLongOrNull() ?: 0L
            val stock = binding.etProductStock.text?.toString()?.toIntOrNull() ?: 0
            val category = categories[binding.spinnerProductCategory.selectedItemPosition]
            val description = binding.etProductDescription.text?.toString()?.trim().orEmpty()

            val typedUrl = binding.etProductImageUrl.text?.toString()?.trim().orEmpty()
            val finalImageUrl = when {
                !encodedBase64Image.isNullOrBlank() -> encodedBase64Image.orEmpty()
                typedUrl.isNotBlank() -> typedUrl
                existingProduct != null && encodedBase64Image == "" -> "" // explicitly removed
                existingProduct != null -> existingProduct.imageUrl
                else -> ""
            }

            if (name.isEmpty() || price <= 0L) {
                Toast.makeText(
                    requireContext(),
                    "Vui lòng nhập tên sản phẩm và giá bán hợp lệ",
                    Toast.LENGTH_SHORT
                ).show()
                return
            }

            if (existingProduct != null) {
                viewModel.updateProduct(
                    productId = existingProduct.id,
                    name = name,
                    category = category,
                    price = price,
                    stock = stock.coerceAtLeast(0),
                    description = description,
                    imageUrl = finalImageUrl
                )
                Toast.makeText(requireContext(), "Đã cập nhật sản phẩm & ảnh lên MongoDB!", Toast.LENGTH_SHORT).show()
                dismiss()
            } else {
                viewModel.addProduct(
                    name = name,
                    category = category,
                    price = price,
                    stock = stock.coerceAtLeast(0),
                    description = description,
                    imageUrl = finalImageUrl
                )
                if (closeAfterSave) {
                    Toast.makeText(requireContext(), "Đã lưu sản phẩm & ảnh mới lên MongoDB!", Toast.LENGTH_SHORT).show()
                    dismiss()
                } else {
                    Toast.makeText(requireContext(), "Đã lưu '$name'! Nhập tiếp sản phẩm mới.", Toast.LENGTH_SHORT).show()
                    binding.etProductName.setText("")
                    binding.etProductPrice.setText("")
                    binding.etProductStock.setText("10")
                    binding.etProductDescription.setText("")
                    binding.etProductImageUrl.setText("")
                    encodedBase64Image = null
                    binding.ivProductPreview.setImageResource(R.drawable.img_product_electronics)
                    binding.tvImageUriHint.text = "Chưa chọn ảnh bộ sưu tập"
                    binding.tvImageUriHint.setTextColor(resources.getColor(R.color.text_muted, null))
                    binding.btnRemoveImage.visibility = View.GONE
                    binding.etProductName.requestFocus()
                }
            }
        }

        binding.btnSubmitProduct.setOnClickListener { submitForm(closeAfterSave = true) }
        binding.btnSaveAndContinue.setOnClickListener { submitForm(closeAfterSave = false) }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }

    companion object {
        private const val ARG_PRODUCT_ID = "arg_product_id"

        fun newInstance(productId: String? = null): AddProductBottomSheet {
            return AddProductBottomSheet().apply {
                arguments = Bundle().apply {
                    if (productId != null) {
                        putString(ARG_PRODUCT_ID, productId)
                    }
                }
            }
        }
    }
}
