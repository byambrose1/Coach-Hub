import { BrevoClient } from "@getbrevo/brevo";

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY || "",
});

interface InvoiceEmailData {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
  notes?: string;
  trainerName: string;
  businessName: string;
  businessAddress?: string;
  trainerEmail?: string;
  paymentLink?: string;
}

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<void> {
  const {
    clientName,
    clientEmail,
    invoiceNumber,
    amount,
    currency,
    dueDate,
    notes,
    trainerName,
    businessName,
    businessAddress,
    trainerEmail,
    paymentLink,
  } = data;

  const senderName = businessName || trainerName || "FitTrack";
  const senderEmail = trainerEmail || "noreply@fittrack.app";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #2563eb; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .body { padding: 30px; }
    .invoice-badge { display: inline-block; background: #dbeafe; color: #2563eb; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .greeting { font-size: 16px; color: #333; margin-bottom: 20px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table td { padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .details-table td:first-child { color: #666; width: 40%; }
    .details-table td:last-child { color: #333; font-weight: 500; }
    .amount-row td { font-size: 18px !important; font-weight: 700 !important; border-bottom: 2px solid #2563eb !important; }
    .amount-row td:last-child { color: #2563eb !important; }
    .notes { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #555; }
    .notes strong { color: #333; }
    .pay-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { padding: 20px 30px; background: #f9fafb; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${senderName}</h1>
    </div>
    <div class="body">
      <span class="invoice-badge">Invoice ${invoiceNumber}</span>
      <p class="greeting">Hi ${clientName},</p>
      <p style="color: #555; font-size: 14px;">Please find your invoice details below.</p>
      
      <table class="details-table">
        <tr>
          <td>Invoice Number</td>
          <td>${invoiceNumber}</td>
        </tr>
        <tr>
          <td>Due Date</td>
          <td>${dueDate}</td>
        </tr>
        <tr class="amount-row">
          <td>Amount Due</td>
          <td>${currency}${amount}</td>
        </tr>
      </table>

      ${notes ? `<div class="notes"><strong>Notes:</strong> ${notes}</div>` : ""}
      
      ${paymentLink ? `<p style="text-align: center;"><a href="${paymentLink}" class="pay-button">Pay Now</a></p>` : ""}
      
      <p style="color: #555; font-size: 14px;">If you have any questions about this invoice, please don't hesitate to get in touch.</p>
      <p style="color: #333; font-size: 14px;">Thank you,<br><strong>${trainerName}</strong></p>
    </div>
    <div class="footer">
      ${businessAddress ? `<p>${businessAddress}</p>` : ""}
      <p>Sent via FitTrack</p>
    </div>
  </div>
</body>
</html>`;

  try {
    console.log(`Attempting to send invoice email to ${clientEmail} via Brevo...`);
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `Invoice ${invoiceNumber} from ${senderName}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log(`Invoice email sent successfully to ${clientEmail}`);
  } catch (error: any) {
    console.error(`Failed to send email via Brevo:`, error);
    throw error;
  }
}

export async function sendBookingNotificationEmail(data: {
  clientName: string;
  clientEmail: string;
  sessionDate: string;
  sessionTime: string;
  trainerName: string;
  businessName?: string;
  trainerEmail?: string;
}): Promise<void> {
  const { clientName, clientEmail, sessionDate, sessionTime, trainerName, businessName, trainerEmail } = data;
  
  const senderName = businessName || trainerName || "FitTrack";
  const senderEmail = trainerEmail || "noreply@fittrack.app";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; }
    .header { color: #2563eb; text-align: center; margin-bottom: 30px; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Session Booked!</h1>
    </div>
    <p>Hi ${clientName},</p>
    <p>A new session has been scheduled for you by <strong>${trainerName}</strong>.</p>
    
    <div class="details">
      <p><strong>Date:</strong> ${sessionDate}</p>
      <p><strong>Time:</strong> ${sessionTime}</p>
    </div>
    
    <p>We look forward to seeing you then!</p>
    
    <div class="footer">
      <p>Sent via FitTrack by ${senderName}</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `New Session Booked: ${sessionDate}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log(`Booking notification sent to ${clientEmail}`);
  } catch (error) {
    console.error("Failed to send booking notification:", error);
  }
}
