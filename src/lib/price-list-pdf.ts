import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatPrice, serviceUnits, type Service, type ServiceCategory } from './price-list';

type PriceListPdfData = {
    services: Service[];
    categories: ServiceCategory[];
    author: string;
    contact: string;
};

const cleanText = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

// The embedded font keeps Ukrainian text selectable and readable on any device.
export function buildPriceListPdf(data: PriceListPdfData, fontBase64: string, issuedAt = new Date()) {
    if (!data.services.length) throw new Error('Cannot export an empty price list');
    const doc = new jsPDF({ format: 'a4', unit: 'mm', putOnlyUsedFonts: true, compress: true });
    doc.addFileToVFS('NotoSans-Regular.ttf', fontBase64);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.setFont('NotoSans', 'normal');
    doc.setProperties({ title: 'Прайс-лист послуг', author: cleanText(data.author), creator: 'Мій кошторис' });
    const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
    const date = [issuedAt.getDate(), issuedAt.getMonth() + 1, issuedAt.getFullYear()].map((part) => String(part).padStart(2, '0')).join('.');
    doc.setFontSize(11);
    const authorLines: string[] = doc.splitTextToSize(cleanText(data.author).slice(0, 160), 176);
    doc.setFontSize(9);
    const contactLines: string[] = data.contact.trim() ? doc.splitTextToSize(cleanText(data.contact).slice(0, 160), 176) : [];
    const tableTop = 39 + authorLines.length * 5 + contactLines.length * 4;
    autoTable(doc, {
        margin: { left: 17, right: 17, top: tableTop, bottom: 23 },
        startY: tableTop,
        head: [['Послуга', 'Категорія', 'Од.', 'Ціна, грн']],
        body: data.services.map((service) => [
            cleanText(service.name), cleanText(categoryNames.get(service.category_id) ?? 'Без категорії'),
            serviceUnits[service.unit], formatPrice(Number(service.price)).replace(/\u00a0/g, ' ').replace(' ₴', ''),
        ]),
        theme: 'striped',
        styles: { font: 'NotoSans', fontStyle: 'normal', fontSize: 9, cellPadding: 3, overflow: 'linebreak', textColor: [42, 43, 57], lineColor: [235, 235, 244] },
        headStyles: { fillColor: [97, 85, 219], textColor: 255, fontStyle: 'normal' },
        alternateRowStyles: { fillColor: [247, 247, 252] },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 47 }, 2: { cellWidth: 23 }, 3: { cellWidth: 36, halign: 'right' } },
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
    });
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setFont('NotoSans', 'normal');
        doc.setTextColor(35, 36, 52);
        doc.setFontSize(21);
        doc.text('Прайс-лист послуг', 17, 22);
        doc.setFontSize(11);
        doc.text(authorLines, 17, 31, { lineHeightFactor: 1.25 });
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 130);
        if (contactLines.length) doc.text(contactLines, 17, 32 + authorLines.length * 5, { lineHeightFactor: 1.2 });
        doc.setFontSize(8);
        doc.text(`Станом на ${date} · Ціни за одну одиницю`, 17, tableTop - 4);
        doc.setDrawColor(230, 230, 240);
        doc.line(17, 279, 193, 279);
        doc.setFontSize(8);
        doc.text('Мій кошторис · Прайс для ознайомлення', 17, 285);
        doc.text(`${page} / ${pages}`, 193, 285, { align: 'right' });
    }
    return doc;
}

let fontPromise: Promise<string> | null = null;
async function loadPdfFont() {
    if (!fontPromise) {
        fontPromise = (async () => {
            const response = await fetch('/fonts/NotoSans-Regular.ttf');
            if (!response.ok) throw new Error('Cannot load PDF font');
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length < 4 || bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) {
                throw new Error('Invalid PDF font response');
            }
            let binary = '';
            for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
            return btoa(binary);
        })().catch((error) => { fontPromise = null; throw error; });
    }
    return fontPromise;
}

export async function downloadPriceListPdf(data: PriceListPdfData) {
    const doc = buildPriceListPdf(data, await loadPdfFont());
    await doc.save('price-list.pdf', { returnPromise: true });
}
