import { generateInvoicePdf } from "./lib/invoice-pdf";

async function main() {
  const buf = await generateInvoicePdf({
    invoiceNumber: "INV-2026-04-U123",
    issueDate: "2026年04月03日",
    companyName: "株式会社AilaB",
    internName: "test1",
    internAddress: "東京都OO区OO町0-0-0",
    internPhone: "08000000000",
    month: "2026年04月",
    workingHours: 20,
    unitPrice: 1300,
    totalSalary: 26000,
    expenseTransport: 0,
    expenseTravel: 0,
    expenseAi: 0,
    totalExpense: 0,
    subtotal: 26000,
    taxAmount: 2600,
    totalAmount: 28600,
    bankInfo: "test1",
    paymentDue: "2026年05月31日",
  });
  console.log(buf.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
