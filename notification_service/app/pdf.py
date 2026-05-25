import os
import tempfile
from datetime import datetime

from reportlab.graphics.barcode import code128
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas import OrderPaidData

PAPER_BG = colors.HexColor('#fdfbf7')
INK = colors.HexColor('#1f2937')
MUTED = colors.HexColor('#4b5563')
DASH = colors.HexColor('#d1d5db')
TOTAL_BG = colors.HexColor('#f3efe9')

RECEIPT_WIDTH = 86 * mm
RECEIPT_HEIGHT = 180 * mm


def _format_amount(value: float) -> str:
    amount = float(value)
    if amount.is_integer():
        return f'{int(amount):,}'
    return f'{amount:,.2f}'


def _draw_jagged_edge(canvas: Canvas, width: float, y: float, *, inverted: bool = False, step: float = 6.0, depth: float = 4.0) -> None:
    x = 0.0
    canvas.saveState()
    canvas.setFillColor(PAPER_BG)
    path = canvas.beginPath()
    path.moveTo(0, y)
    while x < width:
        mid_x = min(x + step / 2.0, width)
        end_x = min(x + step, width)
        tip_y = y - depth if inverted else y + depth
        path.lineTo(mid_x, tip_y)
        path.lineTo(end_x, y)
        x += step
    path.lineTo(width, y - (depth if inverted else -depth))
    path.lineTo(0, y - (depth if inverted else -depth))
    path.close()
    canvas.drawPath(path, fill=1, stroke=0)
    canvas.restoreState()


def _draw_receipt_background(canvas: Canvas, doc: SimpleDocTemplate) -> None:
    width, height = doc.pagesize
    canvas.saveState()
    canvas.setFillColor(PAPER_BG)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    _draw_jagged_edge(canvas, width, height - 2.5)
    _draw_jagged_edge(canvas, width, 2.5, inverted=True)
    canvas.restoreState()


def generate_invoice_pdf(order: OrderPaidData) -> str:
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, f'invoice_{order.order_id}.pdf')

    doc = SimpleDocTemplate(
        file_path,
        pagesize=(RECEIPT_WIDTH, RECEIPT_HEIGHT),
        leftMargin=8 * mm,
        rightMargin=8 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
        title=f"Champ's Closet Receipt {order.order_id}",
    )

    base_styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ReceiptTitle',
        parent=base_styles['Heading1'],
        fontName='Courier-Bold',
        fontSize=14,
        leading=16,
        alignment=1,
        textColor=INK,
    )
    tiny_style = ParagraphStyle(
        'ReceiptTiny',
        parent=base_styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=9,
        textColor=MUTED,
        alignment=1,
    )
    label_style = ParagraphStyle(
        'ReceiptLabel',
        parent=base_styles['Normal'],
        fontName='Courier-Bold',
        fontSize=8,
        leading=10,
        textColor=INK,
    )
    value_style = ParagraphStyle(
        'ReceiptValue',
        parent=base_styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=INK,
        alignment=2,
    )
    item_style = ParagraphStyle(
        'ReceiptItem',
        parent=base_styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=INK,
    )
    item_meta_style = ParagraphStyle(
        'ReceiptItemMeta',
        parent=base_styles['Normal'],
        fontName='Courier',
        fontSize=7,
        leading=9,
        textColor=MUTED,
    )
    total_style = ParagraphStyle(
        'ReceiptTotal',
        parent=base_styles['Normal'],
        fontName='Courier-Bold',
        fontSize=11,
        leading=13,
        textColor=INK,
    )

    now = datetime.now()
    order_number = f'CH-{str(order.order_id).zfill(5)}'
    delivery_fee = float(order.delivery.fee if order.delivery else 0)
    subtotal = float(sum(item.quantity * item.price for item in order.items))
    delivery_label = order.delivery.label if order.delivery and order.delivery.label else 'Store pickup'

    content = []

    content.append(Paragraph("CHAMP'S CLOSET", title_style))
    content.append(Spacer(1, 1.5 * mm))
    content.append(Paragraph('Champs closet,Club Enkare', tiny_style))
    content.append(Paragraph('Kitengela, Kenya', tiny_style))
    content.append(Paragraph('Tel: +254 722606526', tiny_style))
    content.append(Spacer(1, 3 * mm))

    meta_rows = [
        [Paragraph('DATE', label_style), Paragraph(now.strftime('%d/%m/%Y'), value_style)],
        [Paragraph('TIME', label_style), Paragraph(now.strftime('%H:%M:%S'), value_style)],
        [Paragraph('ORDER NO', label_style), Paragraph(order_number, value_style)],
        [Paragraph('PHONE', label_style), Paragraph(order.phone, value_style)],
    ]
    meta_table = Table(meta_rows, colWidths=[26 * mm, 38 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
                ('LINEBELOW', (0, -1), (-1, -1), 0.6, DASH),
            ]
        )
    )
    content.append(meta_table)
    content.append(Spacer(1, 2.5 * mm))

    header_table = Table(
        [[Paragraph('QTY ITEM', label_style), Paragraph('AMT', label_style)]],
        colWidths=[44 * mm, 20 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ('LINEBELOW', (0, 0), (-1, -1), 0.8, DASH),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]
        )
    )
    content.append(header_table)
    content.append(Spacer(1, 1.5 * mm))

    for item in order.items:
        line_total = float(item.price) * int(item.quantity)
        left_block = Paragraph(
            f"{item.quantity}x {item.name}<br/><font size='7' color='#4b5563'>Size: {item.size or '-'}</font>",
            item_style,
        )
        right_block = Paragraph(f"{_format_amount(line_total)} Ksh", value_style)
        row_table = Table([[left_block, right_block]], colWidths=[44 * mm, 20 * mm])
        row_table.setStyle(
            TableStyle(
                [
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ]
            )
        )
        content.append(row_table)

    content.append(Spacer(1, 2 * mm))

    totals_rows = [
        [Paragraph('SUBTOTAL', label_style), Paragraph(f"{_format_amount(subtotal)} Ksh", value_style)],
        [
            Paragraph('DELIVERY', label_style),
            Paragraph('FREE' if delivery_fee == 0 else f"{_format_amount(delivery_fee)} Ksh", value_style),
        ],
        [Paragraph('DELIVERY TYPE', label_style), Paragraph((order.delivery.type if order.delivery else 'pickup').upper(), value_style)],
        [Paragraph('LOCATION', label_style), Paragraph(delivery_label, value_style)],
        [Paragraph('PAID VIA', label_style), Paragraph('M-PESA', value_style)],
    ]
    totals_table = Table(totals_rows, colWidths=[28 * mm, 36 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ('LINEABOVE', (0, 0), (-1, 0), 0.8, DASH),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]
        )
    )
    content.append(totals_table)
    content.append(Spacer(1, 1.5 * mm))

    total_banner = Table(
        [[Paragraph('TOTAL', total_style), Paragraph(f"{_format_amount(order.amount)} Ksh", total_style)]],
        colWidths=[30 * mm, 34 * mm],
    )
    total_banner.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, -1), TOTAL_BG),
                ('BOX', (0, 0), (-1, -1), 0.8, DASH),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]
        )
    )
    content.append(total_banner)
    content.append(Spacer(1, 4 * mm))

    content.append(Paragraph('*** THANK YOU ***', tiny_style))
    barcode_value = f"{str(order.order_id).zfill(5)}0001234"
    barcode = code128.Code128(barcode_value, barHeight=9 * mm, barWidth=0.45)
    content.append(Spacer(1, 1 * mm))
    content.append(barcode)
    content.append(Spacer(1, 1 * mm))
    content.append(Paragraph(barcode_value, tiny_style))

    doc.build(content, onFirstPage=_draw_receipt_background, onLaterPages=_draw_receipt_background)
    return file_path
