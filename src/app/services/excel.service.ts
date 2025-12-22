import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

@Injectable({
    providedIn: 'root'
})
export class ExcelService {

    exportToExcel(
        data: any[],
        fileName: string,
        columns: { header: string, field: string, type?: 'text', format?: (val: any) => any }[],
        summary?: { label: string, value: any }[],
        ext: 'xlsx' | 'xls' = 'xlsx'
    ) {
        if (!data || !data.length) {
            return;
        }

        // 1. Summary rows (üstte, key-value)
        let wsData: any[][] = [];
        if (summary && summary.length > 0) {
            summary.forEach(item => {
                wsData.push([item.label, item.value]);
            });
            wsData.push([]); // boş satır
        }

        // 2. Header row
        wsData.push(columns.map(col => col.header));

        // 3. Data rows
        data.forEach(row => {
            const rowData = columns.map(col => {
                let val = row[col.field];
                if (col.format) {
                    val = col.format(row);
                } else if (val === null || val === undefined) {
                    val = '';
                }
                return val;
            });
            wsData.push(rowData);
        });

        // Worksheet ve workbook oluştur
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fiş Detayı');

        // Dosya oluştur
        const fileExt = ext === 'xls' ? 'xls' : 'xlsx';
        XLSX.writeFile(wb, `${fileName}.${fileExt}`);
    }

    constructor() { }

    exportToCsv(data: any[], fileName: string, columns: { header: string, field: string, type?: 'text', format?: (val: any) => any }[], summary?: { label: string, value: any }[]) {
        if (!data || !data.length) {
            return;
        }

        // BOM for UTF-8
        const BOM = '\uFEFF';
        let csvContent = BOM;

        // Summary Section
        if (summary && summary.length > 0) {
            summary.forEach(item => {
                const val = item.value !== null && item.value !== undefined ? item.value : '';
                csvContent += `${item.label};${val}\r\n`;
            });
            csvContent += '\r\n'; // Empty line after summary
        }

        // Headers
        const headers = columns.map(c => c.header).join(';');
        csvContent += headers + '\r\n';

        // Rows
        data.forEach(row => {
            const rowData = columns.map(col => {
                let val = row[col.field];

                // Custom formatting if provided
                if (col.format) {
                    val = col.format(row);
                } else if (val === null || val === undefined) {
                    val = '';
                }

                // Handle explicit text type for Excel (prevents scientific notation)
                if (col.type === 'text') {
                    const stringVal = String(val).replace(/"/g, '""');
                    return `="${stringVal}"`;
                }

                // Escape quotes and wrap in quotes if necessary
                const stringVal = String(val);
                if (stringVal.includes(';') || stringVal.includes('"') || stringVal.includes('\n')) {
                    return `"${stringVal.replace(/"/g, '""')}"`;
                }
                return stringVal;
            });
            csvContent += rowData.join(';') + '\r\n';
        });

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
