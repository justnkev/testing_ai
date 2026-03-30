'use client';

/**
 * Client-side invoice PDF generation using jsPDF.
 * Generates a professional invoice with business branding, line items, and totals.
 */

interface InvoicePDFData {
    invoiceNumber: string;
    status: string;
    createdAt: string;
    dueDate: string | null;
    notes: string | null;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    markupPct: number;
    lineItems: {
        description: string;
        quantity: number;
        unit_price: number;
        amount: number;
        is_passthrough?: boolean;
    }[];
    customer: {
        name: string;
        email?: string;
        address?: string;
        city?: string;
        state?: string;
        zip_code?: string;
    };
    business: {
        name: string;
        email?: string;
        phone?: string;
        logo_url?: string;
    };
    jobTitle: string;
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // ── Header: Business Name ──────────────────────────────────
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(data.business.name || 'Invoice', 14, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    if (data.business.email) doc.text(data.business.email, 14, 28);
    if (data.business.phone) doc.text(data.business.phone, 14, 33);

    // ── Invoice Number & Status (right side) ────────────────────
    doc.setFontSize(28);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth - 14, 22, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${data.invoiceNumber}`, pageWidth - 14, 30, { align: 'right' });
    doc.text(`Status: ${data.status.toUpperCase()}`, pageWidth - 14, 36, { align: 'right' });

    // ── Separator ───────────────────────────────────────────────
    doc.setDrawColor(200);
    doc.line(14, 40, pageWidth - 14, 40);

    // ── Bill To & Invoice Details ───────────────────────────────
    let y = 48;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('BILL TO', 14, y);
    doc.text('DETAILS', pageWidth / 2 + 10, y);

    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(data.customer.name, 14, y);
    doc.setFont('helvetica', 'normal');

    // Customer address
    doc.setFontSize(9);
    doc.setTextColor(80);
    if (data.customer.email) { y += 5; doc.text(data.customer.email, 14, y); }
    if (data.customer.address) { y += 5; doc.text(data.customer.address, 14, y); }
    const cityLine = [data.customer.city, data.customer.state, data.customer.zip_code].filter(Boolean).join(', ');
    if (cityLine) { y += 5; doc.text(cityLine, 14, y); }

    // Invoice details (right column)
    const detailsX = pageWidth / 2 + 10;
    let dy = 54;
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(`Date: ${new Date(data.createdAt).toLocaleDateString()}`, detailsX, dy);
    dy += 5;
    if (data.dueDate) doc.text(`Due: ${new Date(data.dueDate).toLocaleDateString()}`, detailsX, dy);
    dy += 5;
    doc.text(`Job: ${data.jobTitle}`, detailsX, dy);
    dy += 5;
    if (data.markupPct > 0) doc.text(`Markup: ${data.markupPct}%`, detailsX, dy);

    // ── Line Items Table ────────────────────────────────────────
    const tableStartY = Math.max(y, dy) + 12;

    const headers = ['Description', 'Qty', 'Unit Price', 'Amount'];
    const rows = data.lineItems.map((item) => [
        item.description + (item.is_passthrough ? ' ⓟ' : ''),
        item.quantity.toString(),
        `$${item.unit_price.toFixed(2)}`,
        `$${item.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: tableStartY,
        theme: 'striped',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
    });

    // ── Totals ──────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 30;
    let ty = finalY + 8;
    const totalsX = pageWidth - 70;

    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text('Subtotal:', totalsX, ty);
    doc.text(`$${data.totalAmount.toFixed(2)}`, pageWidth - 14, ty, { align: 'right' });

    if (data.amountPaid > 0) {
        ty += 6;
        doc.text('Amount Paid:', totalsX, ty);
        doc.setTextColor(0, 128, 0);
        doc.text(`-$${data.amountPaid.toFixed(2)}`, pageWidth - 14, ty, { align: 'right' });
    }

    ty += 8;
    doc.setDrawColor(200);
    doc.line(totalsX, ty - 2, pageWidth - 14, ty - 2);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Balance Due:', totalsX, ty + 4);
    doc.text(`$${data.balanceDue.toFixed(2)}`, pageWidth - 14, ty + 4, { align: 'right' });

    // ── Notes ───────────────────────────────────────────────────
    if (data.notes) {
        ty += 20;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('NOTES / TERMS', 14, ty);
        ty += 5;
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');

        const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 28);
        doc.text(splitNotes, 14, ty);
    }

    // ── Footer ──────────────────────────────────────────────────
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleDateString()} · ${data.business.name}`, 14, pageHeight - 10);

    // Save
    doc.save(`${data.invoiceNumber}.pdf`);
}
