package com.example.ui.dialogs

import android.os.Bundle
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

/**
 * Đã loại bỏ tính năng định vị Shipper GPS theo lộ trình mới 4 bước.
 */
class ShipperMapBottomSheet : BottomSheetDialogFragment() {
    companion object {
        fun newInstance(orderId: String): ShipperMapBottomSheet = ShipperMapBottomSheet()
    }
}
