import jsPDF from "jspdf";
import "jspdf-autotable";
import { toWords } from "number-to-words";
import api from "../api.js";

/**
 * Calculates the total for a single billing item row.
 * @param {object} item - The billing item.
 * @returns {number} The calculated total for the row.
 */
const calculateRowTotal = (item) => {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  const discount = Number(item.discount) || 0;
  const taxPercentage = 18; // Standard tax rate
  const baseTotal = qty * price;

  if (item.taxIncluded) {
    const discountedTotal = baseTotal - discount;
    const taxMultiplier = 1 + taxPercentage / 100;
    return discountedTotal / taxMultiplier;
  } else {
    return baseTotal - discount;
  }
};

/**
 * Generates, saves, and uploads the invoice PDF.
 * @param {object} invoiceData - All data required for the invoice.
 * @param {function} navigate - The navigate function from react-router-dom.
 * @param {function} setError - The state setter for errors.
 */
export const processInvoice = async (invoiceData, navigate, setError) => {
  const {
    billingItems,
    supplier,
    recipient,
    dateOfIssuance,
    invoiceNumber,
    isGstBill,
  } = invoiceData;

  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  const overallTotal = billingItems.reduce((sum, item) => sum + calculateRowTotal(item), 0);
  const taxRate = 18;
  const taxableAmount = overallTotal;
  const taxAmount = taxableAmount * (taxRate / 100);
  const totalAmount = taxableAmount + taxAmount;

  // --- PDF Structure ---

  // Top Section
  const topRows = [
    [{ content: `GSTIN  : ${supplier.gstin}`, styles: { halign: "left" } }, { content: "Original Copy", styles: { halign: "right" } }],
    [{ content: "TAX INVOICE", colSpan: 2, styles: { halign: "center", fontSize: 14, fontStyle: "bold" } }],
    [{ content: supplier.name, colSpan: 2, styles: { halign: "center", fontSize: 12, fontStyle: "bold" } }],
    [{ content: supplier.address, colSpan: 2, styles: { halign: "center", fontSize: 10 } }],
    [{ content: `Tel. : ${supplier.phone}   email : ${supplier.email}`, colSpan: 2, styles: { halign: "center", fontSize: 10 } }],
    [
      { content: `Party Details :\n${recipient.name}\n${recipient.address}\n${recipient.gstin ? `GSTIN : ${recipient.gstin}` : ""}`, styles: { halign: "left" } },
      { content: `Invoice No.    : ${invoiceNumber}\nDated          : ${dateOfIssuance}\nPlace of Supply: ${supplier.place}`, styles: { halign: "left" } },
    ],
  ];

  doc.autoTable({ startY: currentY, body: topRows, theme: "grid", margin: { left: 20, right: 20 } });
  currentY = doc.lastAutoTable.finalY + 10;

  // Items Table
  const tableHead = [["S.N.", "Description", "HSN/SAC", "Qty. Unit", "List Price", "Discount", "Price", "Amount(₹)"]];
  const tableBody = billingItems.map((item, index) => [
    `${index + 1}.`,
    item.itemName,
    item.hsn_code,
    `${Number(item.quantity).toFixed(2)} Pcs.`,
    Number(item.price).toFixed(2),
    Number(item.discount).toFixed(2),
    item.taxIncluded ? `${Number(item.price).toFixed(2)} (Inc)` : Number(item.price).toFixed(2),
    calculateRowTotal(item).toFixed(2),
  ]);

  const totalQuantity = billingItems.reduce((acc, item) => acc + Number(item.quantity), 0);
  tableBody.push([
    { content: "Total", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
    `${totalQuantity.toFixed(2)} Pcs.`, "", "", "",
    { content: overallTotal.toFixed(2), styles: { halign: "right", fontStyle: "bold" } },
  ]);

  doc.autoTable({ startY: currentY, head: tableHead, body: tableBody, theme: "grid", margin: { left: 20, right: 20 } });
  currentY = doc.lastAutoTable.finalY + 10;

  // Tax Summary
  const taxBody = [[`${taxRate}%`, taxableAmount.toFixed(2), (taxAmount / 2).toFixed(2), (taxAmount / 2).toFixed(2), taxAmount.toFixed(2)]];
  doc.autoTable({
    startY: currentY,
    head: [["Tax Rate", "Taxable Amt.", "CGST Amt.", "SGST Amt.", "Total Tax"]],
    body: taxBody,
    theme: "grid",
    margin: { left: 20, right: 20 },
  });
  currentY = doc.lastAutoTable.finalY + 10;

  // Amount in Words
  const amountInWords = toWords(Math.floor(totalAmount));
  doc.setFont("Helvetica", "bold").setFontSize(10).text(`Rupees ${amountInWords} Only`, 25, currentY);
  currentY += 20;

  // Bottom Section
  const bottomStartY = pageHeight - 220;
  doc.autoTable({
    startY: bottomStartY,
    body: [
      [{ content: "Declaration", colSpan: 3, styles: { halign: "center", fontStyle: "bold" } }],
      [{ content: "Bank - State Bank of India\nBranch- M.I.T, Patna\nA/c No-32959477419\nIFSC-SBIN0004603", colSpan: 3, styles: { halign: "center" } }],
      [
        { content: "Terms & Conditions\n1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged for late payments.\n3. Subject to 'Bihar' Jurisdiction only.", styles: { valign: "top" } },
        { content: "Receiver's Signature :", styles: { valign: "top" } },
        { content: "For HINDUSTAN ELECTRIC:\n\n\n\nAuthorised Signatory", styles: { valign: "top" } },
      ],
    ],
    theme: "grid",
    margin: { left: 20, right: 20 },
  });

  // --- Save and Upload ---
  doc.save(`invoice_${invoiceNumber}.pdf`);

  const pdfBlob = doc.output("blob");
  const formData = new FormData();
  formData.append("file", pdfBlob, `invoice_${invoiceNumber}.pdf`);
  formData.append("invoiceNumber", invoiceNumber);
  formData.append("billType", isGstBill ? "gst" : "nongst");

  try {
    await api.post("/upload/bill", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    navigate("/dashboard");
  } catch (err) {
    console.error("Upload failed:", err);
    setError("Failed to upload invoice PDF to the server.");
  }
};