package com.example.utils

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.example.model.BulkProductInput
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

object ExcelProductParser {

    data class RowError(
        val rowNumber: Int,
        val reason: String
    )

    data class ParseResult(
        val items: List<BulkProductInput>,
        val errors: List<RowError>,
        val fileError: String? = null
    )

    fun getDisplayName(context: Context, uri: Uri): String {
        return runCatching {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) cursor.getString(idx) else null
                } else null
            }
        }.getOrNull() ?: uri.lastPathSegment ?: "file_san_pham"
    }

    fun parseUri(
        context: Context,
        uri: Uri,
        defaultCategory: String = "Thiết bị điện tử",
        defaultStock: Int = 10
    ): ParseResult {
        return try {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: return ParseResult(emptyList(), emptyList(), "Không thể đọc dữ liệu file đã chọn")

            if (bytes.isEmpty()) {
                return ParseResult(emptyList(), emptyList(), "File rỗng")
            }

            val isZip = bytes.size >= 4 && bytes[0] == 0x50.toByte() && bytes[1] == 0x4B.toByte()
            if (isZip) {
                parseXlsxBytes(bytes, defaultCategory, defaultStock)
            } else {
                val text = bytes.toString(StandardCharsets.UTF_8).removePrefix("\uFEFF")
                parseDelimitedText(text, defaultCategory, defaultStock)
            }
        } catch (e: Exception) {
            ParseResult(emptyList(), emptyList(), "Lỗi đọc file: ${e.message}")
        }
    }

    fun parseXlsxStream(
        inputStream: InputStream,
        defaultCategory: String = "Thiết bị điện tử",
        defaultStock: Int = 10
    ): ParseResult {
        return try {
            val bytes = inputStream.readBytes()
            parseXlsxBytes(bytes, defaultCategory, defaultStock)
        } catch (e: Exception) {
            ParseResult(emptyList(), emptyList(), "Lỗi đọc file Excel: ${e.message}")
        }
    }

    fun parseCsvText(
        csvText: String,
        defaultCategory: String = "Thiết bị điện tử",
        defaultStock: Int = 10
    ): ParseResult {
        return parseDelimitedText(csvText.removePrefix("\uFEFF"), defaultCategory, defaultStock)
    }

    fun parseQuickText(
        rawText: String,
        defaultCategory: String = "Thiết bị điện tử",
        defaultStock: Int = 10
    ): ParseResult {
        return parseDelimitedText(rawText, defaultCategory, defaultStock)
    }

    private fun parseDelimitedText(
        text: String,
        defaultCategory: String,
        defaultStock: Int
    ): ParseResult {
        val lines = text.lines()
        val rows = mutableListOf<Pair<Int, List<String>>>()
        lines.forEachIndexed { idx, rawLine ->
            val line = rawLine.trim()
            if (line.isNotEmpty() && !line.startsWith("#")) {
                val delimiter = detectDelimiter(line)
                rows.add((idx + 1) to splitCsvRow(line, delimiter))
            }
        }
        return convertRowsToProducts(rows, defaultCategory, defaultStock)
    }

    private fun detectDelimiter(line: String): Char {
        if (line.contains("|")) return '|'
        if (line.contains("\t")) return '\t'
        var inQuotes = false
        var semiCount = 0
        var commaCount = 0
        for (c in line) {
            when (c) {
                '"' -> inQuotes = !inQuotes
                ';' -> if (!inQuotes) semiCount++
                ',' -> if (!inQuotes) commaCount++
            }
        }
        return if (semiCount > commaCount) ';' else ','
    }

    private fun splitCsvRow(line: String, delimiter: Char): List<String> {
        if (delimiter == '|') {
            return line.split('|').map { it.trim() }
        }
        val result = mutableListOf<String>()
        val sb = StringBuilder()
        var inQuotes = false
        var i = 0
        while (i < line.length) {
            val c = line[i]
            when {
                c == '"' -> {
                    if (inQuotes && i + 1 < line.length && line[i + 1] == '"') {
                        sb.append('"')
                        i++
                    } else {
                        inQuotes = !inQuotes
                    }
                }
                c == delimiter && !inQuotes -> {
                    result.add(sb.toString().trim())
                    sb.clear()
                }
                else -> sb.append(c)
            }
            i++
        }
        result.add(sb.toString().trim())
        return result
    }

    private fun parseXlsxBytes(
        bytes: ByteArray,
        defaultCategory: String,
        defaultStock: Int
    ): ParseResult {
        val sharedStrings = mutableListOf<String>()
        var sheetXmlBytes: ByteArray? = null

        ZipInputStream(ByteArrayInputStream(bytes)).use { zis ->
            var entry: ZipEntry? = zis.nextEntry
            while (entry != null) {
                val name = entry.name
                when {
                    name.equals("xl/sharedStrings.xml", ignoreCase = true) -> {
                        sharedStrings.addAll(parseSharedStringsXml(zis.readBytes()))
                    }
                    sheetXmlBytes == null && name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml") -> {
                        sheetXmlBytes = zis.readBytes()
                    }
                }
                zis.closeEntry()
                entry = zis.nextEntry
            }
        }

        val sheetBytes = sheetXmlBytes
            ?: return ParseResult(emptyList(), emptyList(), "File Excel (.xlsx) không có sheet dữ liệu hợp lệ")

        val rows = parseSheetXml(sheetBytes, sharedStrings)
        return convertRowsToProducts(rows, defaultCategory, defaultStock)
    }

    private fun parseSharedStringsXml(xmlBytes: ByteArray): List<String> {
        val list = mutableListOf<String>()
        val parser = XmlPullParserFactory.newInstance().newPullParser()
        parser.setInput(ByteArrayInputStream(xmlBytes), "UTF-8")
        var event = parser.eventType
        var inSi = false
        val currentText = StringBuilder()
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    if (parser.name == "si") {
                        inSi = true
                        currentText.clear()
                    } else if (inSi && parser.name == "t") {
                        currentText.append(parser.nextText())
                    }
                }
                XmlPullParser.END_TAG -> {
                    if (parser.name == "si") {
                        list.add(currentText.toString())
                        inSi = false
                    }
                }
            }
            event = parser.next()
        }
        return list
    }

    private fun parseSheetXml(
        xmlBytes: ByteArray,
        sharedStrings: List<String>
    ): List<Pair<Int, List<String>>> {
        val rows = mutableListOf<Pair<Int, List<String>>>()
        val parser = XmlPullParserFactory.newInstance().newPullParser()
        parser.setInput(ByteArrayInputStream(xmlBytes), "UTF-8")

        var event = parser.eventType
        var currentRowNum = 0
        var currentCells = mutableMapOf<Int, String>()
        var currentColIdx = 0
        var currentCellType: String? = null
        var cellValue = ""

        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    when (parser.name) {
                        "row" -> {
                            currentRowNum = parser.getAttributeValue(null, "r")?.toIntOrNull()
                                ?: (currentRowNum + 1)
                            currentCells = mutableMapOf()
                        }
                        "c" -> {
                            val ref = parser.getAttributeValue(null, "r").orEmpty()
                            currentColIdx = colRefToIndex(ref, currentCells.size)
                            currentCellType = parser.getAttributeValue(null, "t")
                            cellValue = ""
                        }
                        "v", "t" -> {
                            cellValue += parser.nextText()
                        }
                    }
                }
                XmlPullParser.END_TAG -> {
                    when (parser.name) {
                        "c" -> {
                            val resolved = if (currentCellType == "s") {
                                val idx = cellValue.trim().toIntOrNull()
                                if (idx != null && idx in sharedStrings.indices) sharedStrings[idx] else cellValue
                            } else {
                                cellValue
                            }
                            currentCells[currentColIdx] = resolved.trim()
                        }
                        "row" -> {
                            if (currentCells.isNotEmpty()) {
                                val maxCol = currentCells.keys.maxOrNull() ?: 0
                                val rowList = (0..maxCol).map { currentCells[it].orEmpty() }
                                if (rowList.any { it.isNotBlank() }) {
                                    rows.add(currentRowNum to rowList)
                                }
                            }
                        }
                    }
                }
            }
            event = parser.next()
        }
        return rows
    }

    private fun colRefToIndex(cellRef: String, fallback: Int): Int {
        val letters = cellRef.takeWhile { it.isLetter() }.uppercase()
        if (letters.isEmpty()) return fallback
        var col = 0
        for (ch in letters) {
            col = col * 26 + (ch - 'A' + 1)
        }
        return (col - 1).coerceAtLeast(0)
    }

    private fun convertRowsToProducts(
        rows: List<Pair<Int, List<String>>>,
        defaultCategory: String,
        defaultStock: Int
    ): ParseResult {
        if (rows.isEmpty()) return ParseResult(emptyList(), emptyList())

        var colName = 0
        var colPrice = 1
        var colImportPrice = -1
        var colStock = 2
        var colCat = 3
        var colSku = 4
        var colDesc = 5
        var startIdx = 0

        val firstRow = rows.first().second.map { it.lowercase().trim() }
        val looksLikeHeader = firstRow.any {
            it.contains("tên") || it.contains("name") || it.contains("giá") ||
                it.contains("price") || it.contains("sku") || it.contains("danh mục")
        }
        if (looksLikeHeader) {
            startIdx = 1
            colName = -1
            colPrice = -1
            colImportPrice = -1
            colStock = -1
            colCat = -1
            colSku = -1
            colDesc = -1
            firstRow.forEachIndexed { idx, h ->
                when {
                    h.contains("tên") || h.contains("name") || h.contains("sản phẩm") -> colName = idx
                    h.contains("giá nhập") || h.contains("import") || h.contains("giá vốn") -> colImportPrice = idx
                    h.contains("giá") || h.contains("price") || h.contains("export") -> colPrice = idx
                    h.contains("tồn") || h.contains("kho") || h.contains("stock") || h.contains("sl") || h.contains("số lượng") -> colStock = idx
                    h.contains("danh mục") || h.contains("loại") || h.contains("category") -> colCat = idx
                    h.contains("sku") || h.contains("mã") -> colSku = idx
                    h.contains("mô tả") || h.contains("desc") || h.contains("ghi chú") -> colDesc = idx
                }
            }
            if (colName < 0) colName = 0
            if (colPrice < 0) colPrice = 1
        }

        val items = mutableListOf<BulkProductInput>()
        val errors = mutableListOf<RowError>()

        for (i in startIdx until rows.size) {
            val (rowNum, cols) = rows[i]
            val name = cols.getOrNull(colName)?.trim().orEmpty()
            val rawPrice = cols.getOrNull(colPrice)?.trim().orEmpty()
            val rawImportPrice = if (colImportPrice >= 0) cols.getOrNull(colImportPrice)?.trim().orEmpty() else ""
            val rawStock = if (colStock >= 0) cols.getOrNull(colStock)?.trim().orEmpty() else ""
            val rawCat = if (colCat >= 0) cols.getOrNull(colCat)?.trim().orEmpty() else ""
            val rawSku = if (colSku >= 0) cols.getOrNull(colSku)?.trim().orEmpty() else ""
            val rawDesc = if (colDesc >= 0) cols.getOrNull(colDesc)?.trim().orEmpty() else ""

            if (name.isBlank() && rawPrice.isBlank()) continue
            if (name.isBlank()) {
                errors.add(RowError(rowNum, "Thiếu tên sản phẩm"))
                continue
            }

            val price = parsePriceVnd(rawPrice)
            if (price == null || price <= 0L) {
                errors.add(RowError(rowNum, "Giá bán không hợp lệ ('$rawPrice')"))
                continue
            }

            val importPrice = parsePriceVnd(rawImportPrice)?.takeIf { it >= 0L } ?: ((price * 70L) / 100L)

            val stock = if (rawStock.isBlank()) {
                defaultStock
            } else {
                rawStock.substringBefore(".").replace(Regex("[^0-9-]"), "").toIntOrNull()?.coerceAtLeast(0) ?: defaultStock
            }

            val category = rawCat.ifBlank { defaultCategory }
            items.add(
                BulkProductInput(
                    name = name,
                    price = price,
                    importPrice = importPrice,
                    stock = stock,
                    category = category,
                    sku = rawSku,
                    description = rawDesc
                )
            )
        }

        return ParseResult(items, errors)
    }

    fun parsePriceVnd(raw: String): Long? {
        val s = raw.trim().lowercase().replace("vnd", "").replace("vnđ", "").replace("đ", "").trim()
        if (s.isEmpty()) return null

        return when {
            s.endsWith("tr") || s.endsWith("m") -> {
                val num = s.dropLast(if (s.endsWith("tr")) 2 else 1).trim().replace(",", ".").toDoubleOrNull()
                num?.let { (it * 1_000_000).toLong() }
            }
            s.endsWith("k") -> {
                val num = s.dropLast(1).trim().replace(",", ".").toDoubleOrNull()
                num?.let { (it * 1_000).toLong() }
            }
            else -> {
                val beforeDecimal = if (s.matches(Regex("^\\d+\\.\\d+$")) && s.substringAfter(".").length <= 2) {
                    s.substringBefore(".")
                } else {
                    s
                }
                val digits = beforeDecimal.replace(Regex("[^0-9]"), "")
                digits.toLongOrNull()
            }
        }
    }

    fun writeSampleXlsx(out: OutputStream) {
        val dataRows = listOf(
            listOf("Chuột Không Dây Logitech M331", "350000", "50", "Phụ kiện", "VD-CH01", "Chuột silent văn phòng"),
            listOf("Bàn Phím Cơ Bluetooth K8 Pro", "1290000", "25", "Thiết bị điện tử", "VD-BP02", "Bàn phím cơ không dây"),
            listOf("Áo Polo Đồng Phục Cao Cấp", "390000", "80", "Thời trang", "VD-AP03", "Chất liệu cotton thoáng mát")
        )
        writeXlsx(out, dataRows)
    }

    fun writeXlsx(out: OutputStream, dataRows: List<List<String>>) {
        val header = listOf("Tên sản phẩm", "Giá bán", "Tồn kho", "Danh mục", "SKU", "Mô tả")
        val allRows = listOf(header) + dataRows

        ZipOutputStream(out).use { zos ->
            fun putXml(path: String, content: String) {
                zos.putNextEntry(ZipEntry(path))
                zos.write(content.toByteArray(StandardCharsets.UTF_8))
                zos.closeEntry()
            }

            putXml(
                "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""
            )

            putXml(
                "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""
            )

            putXml(
                "xl/workbook.xml",
                """<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="SanPham" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""
            )

            putXml(
                "xl/_rels/workbook.xml.rels",
                """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""
            )

            val sheetXml = buildString {
                append("""<?xml version="1.0" encoding="UTF-8"?>""")
                append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>""")
                allRows.forEachIndexed { rIdx, row ->
                    val rNum = rIdx + 1
                    append("""<row r="$rNum">""")
                    row.forEachIndexed { cIdx, value ->
                        val colLetter = ('A' + cIdx)
                        val escaped = value
                            .replace("&", "&amp;")
                            .replace("<", "&lt;")
                            .replace(">", "&gt;")
                        append("""<c r="$colLetter$rNum" t="inlineStr"><is><t>$escaped</t></is></c>""")
                    }
                    append("""</row>""")
                }
                append("""</sheetData></worksheet>""")
            }
            putXml("xl/worksheets/sheet1.xml", sheetXml)
        }
    }
}
