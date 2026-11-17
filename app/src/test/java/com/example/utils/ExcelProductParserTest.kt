package com.example.utils

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExcelProductParserTest {

    @Test
    fun `writeSampleXlsx and parseXlsxStream round-trip succeeds`() {
        val out = ByteArrayOutputStream()
        ExcelProductParser.writeSampleXlsx(out)

        val result = ExcelProductParser.parseXlsxStream(ByteArrayInputStream(out.toByteArray()))
        assertNull(result.fileError)
        assertTrue(result.errors.isEmpty())
        assertEquals(3, result.items.size)

        assertEquals("Chuột Không Dây Logitech M331", result.items[0].name)
        assertEquals(350000L, result.items[0].price)
        assertEquals(50, result.items[0].stock)
        assertEquals("Phụ kiện", result.items[0].category)
        assertEquals("VD-CH01", result.items[0].sku)

        assertEquals("Bàn Phím Cơ Bluetooth K8 Pro", result.items[1].name)
        assertEquals(1290000L, result.items[1].price)
        assertEquals("Thiết bị điện tử", result.items[1].category)
    }

    @Test
    fun `parseXlsxStream handles 100 rows with sparse columns and inline strings`() {
        val sheetRows = StringBuilder()
        sheetRows.append("""<row r="1"><c r="A1" t="inlineStr"><is><t>Mã SKU</t></is></c><c r="B1" t="inlineStr"><is><t>Tên sản phẩm</t></is></c><c r="C1" t="inlineStr"><is><t>Giá bán</t></is></c><c r="E1" t="inlineStr"><is><t>Tồn kho</t></is></c></row>""")
        for (i in 1..100) {
            val rowNum = i + 1
            // Notice column D is skipped intentionally to verify column ref mapping!
            sheetRows.append(
                """<row r="$rowNum"><c r="A$rowNum" t="inlineStr"><is><t>SKU-$i</t></is></c><c r="B$rowNum" t="inlineStr"><is><t>Sản phẩm hàng loạt $i</t></is></c><c r="C$rowNum"><v>${i * 10000}.0</v></c><c r="E$rowNum"><v>${i + 5}</v></c></row>"""
            )
        }

        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zos ->
            fun put(name: String, content: String) {
                zos.putNextEntry(ZipEntry(name))
                zos.write(content.toByteArray(Charsets.UTF_8))
                zos.closeEntry()
            }
            put("xl/workbook.xml", """<?xml version="1.0" encoding="UTF-8"?><workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>""")
            put("xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>""")
            put("xl/worksheets/sheet1.xml", """<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>$sheetRows</sheetData></worksheet>""")
        }

        val result = ExcelProductParser.parseXlsxStream(ByteArrayInputStream(out.toByteArray()), defaultCategory = "Phụ kiện")
        assertNull(result.fileError)
        assertTrue(result.errors.isEmpty())
        assertEquals(100, result.items.size)
        assertEquals("SKU-1", result.items.first().sku)
        assertEquals("Sản phẩm hàng loạt 100", result.items.last().name)
        assertEquals(1000000L, result.items.last().price)
        assertEquals(105, result.items.last().stock)
        assertEquals("Phụ kiện", result.items.last().category)
    }

    @Test
    fun `parseCsvText supports UTF-8 BOM, semicolon delimiter, and reordered columns`() {
        val csv = "\uFEFF" + """
            Mã SKU;Tên sản phẩm;Số lượng;Giá bán;Danh mục
            SP-A1;"Áo Polo; Mẫu mới";25;210.000đ;Thời trang
            SP-A2;Cáp sạc Type-C;;95000;Phụ kiện
        """.trimIndent()

        val result = ExcelProductParser.parseCsvText(csv, defaultStock = 15)
        assertNull(result.fileError)
        assertTrue(result.errors.isEmpty())
        assertEquals(2, result.items.size)
        assertEquals("SP-A1", result.items[0].sku)
        assertEquals("Áo Polo; Mẫu mới", result.items[0].name)
        assertEquals(25, result.items[0].stock)
        assertEquals(210000L, result.items[0].price)
        assertEquals("Thời trang", result.items[0].category)

        assertEquals(15, result.items[1].stock)
        assertEquals(95000L, result.items[1].price)
    }

    @Test
    fun `parseQuickText parses 100 lines and reports invalid lines cleanly`() {
        val lines = buildString {
            for (i in 1..100) {
                appendLine("Sản phẩm nhanh $i | ${i * 15000} | ${i * 2} | Thiết bị điện tử")
            }
            appendLine("Sản phẩm thiếu giá | abc")
        }

        val result = ExcelProductParser.parseQuickText(lines)
        assertEquals(100, result.items.size)
        assertEquals(1, result.errors.size)
        assertEquals("Sản phẩm nhanh 100", result.items.last().name)
        assertEquals(1500000L, result.items.last().price)
        assertEquals(200, result.items.last().stock)
    }

    @Test
    fun `generate and verify sample xlsx files with 10 and 100 products`() {
        val sampleDir = listOf(java.io.File("sample-data"), java.io.File("../sample-data"))
            .firstOrNull { it.exists() && it.isDirectory }
            ?: java.io.File("../sample-data").apply { mkdirs() }

        val csvFile = java.io.File(sampleDir, "mau_san_pham_100.csv")
        val csvResult = ExcelProductParser.parseCsvText(csvFile.readText(Charsets.UTF_8))
        assertNull(csvResult.fileError)
        assertEquals(100, csvResult.items.size)

        val rows100 = csvResult.items.map { item ->
            listOf(item.name, item.price.toString(), item.stock.toString(), item.category, item.sku, item.description)
        }

        val xlsx100 = java.io.File(sampleDir, "mau_san_pham_100.xlsx")
        xlsx100.outputStream().use { ExcelProductParser.writeXlsx(it, rows100) }

        val xlsx10 = java.io.File(sampleDir, "mau_san_pham_10.xlsx")
        xlsx10.outputStream().use { ExcelProductParser.writeXlsx(it, rows100.take(10)) }

        val parsed100 = xlsx100.inputStream().use { ExcelProductParser.parseXlsxStream(it) }
        assertNull(parsed100.fileError)
        assertTrue(parsed100.errors.isEmpty())
        assertEquals(100, parsed100.items.size)
        assertEquals("VD-EX001", parsed100.items.first().sku)
        assertEquals("VD-EX100", parsed100.items.last().sku)

        val parsed10 = xlsx10.inputStream().use { ExcelProductParser.parseXlsxStream(it) }
        assertNull(parsed10.fileError)
        assertEquals(10, parsed10.items.size)
    }
}
