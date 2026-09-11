import { BrevoClient } from "@getbrevo/brevo";
import { logError } from "./safe-logging";

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
  const { clientName, clientEmail, invoiceNumber, amount, currency, dueDate, notes, trainerName, businessName, businessAddress, trainerEmail, paymentLink } = data;
  const senderName = businessName || trainerName || "Practably";
  const senderEmail = trainerEmail || "noreply@practably.app";

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;background:#fff}
    .header{background:#2563eb;color:white;padding:30px;text-align:center}
    .header h1{margin:0;font-size:24px}
    .body{padding:30px}
    .invoice-badge{display:inline-block;background:#dbeafe;color:#2563eb;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;margin-bottom:16px}
    .details-table{width:100%;border-collapse:collapse;margin:20px 0}
    .details-table td{padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
    .details-table td:first-child{color:#666;width:40%}
    .details-table td:last-child{color:#333;font-weight:500}
    .amount-row td{font-size:18px!important;font-weight:700!important;border-bottom:2px solid #2563eb!important}
    .amount-row td:last-child{color:#2563eb!important}
    .notes{background:#f9fafb;padding:15px;border-radius:8px;margin:20px 0;font-size:14px;color:#555}
    .pay-button{display:inline-block;background:#2563eb;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:600;margin:20px 0}
    .footer{padding:20px 30px;background:#f9fafb;text-align:center;font-size:12px;color:#888}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>${senderName}</h1></div>
    <div class="body">
      <span class="invoice-badge">Invoice ${invoiceNumber}</span>
      <p>Hi ${clientName},</p>
      <p style="color:#555;font-size:14px;">Please find your invoice details below.</p>
      <table class="details-table">
        <tr><td>Invoice Number</td><td>${invoiceNumber}</td></tr>
        <tr><td>Due Date</td><td>${dueDate}</td></tr>
        <tr class="amount-row"><td>Amount Due</td><td>${currency}${amount}</td></tr>
      </table>
      ${notes ? `<div class="notes"><strong>Notes:</strong> ${notes}</div>` : ""}
      ${paymentLink ? `<p style="text-align:center;"><a href="${paymentLink}" class="pay-button">Pay Now</a></p>` : ""}
      <p style="color:#555;font-size:14px;">If you have any questions, please don't hesitate to get in touch.</p>
      <p style="color:#333;font-size:14px;">Thank you,<br><strong>${trainerName}</strong></p>
    </div>
    <div class="footer">${businessAddress ? `<p>${businessAddress}</p>` : ""}<p>Sent via Practably</p></div>
  </div>
  </body></html>`;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `Invoice ${invoiceNumber} from ${senderName}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log("Invoice email sent");
  } catch (error: any) {
    logError("Failed to send invoice email", error);
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
  const senderName = businessName || trainerName || "Practably";
  const senderEmail = trainerEmail || "noreply@practably.app";

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;background:#fff;padding:30px}
    .header{color:#2563eb;text-align:center;margin-bottom:30px}
    .details{background:#f9fafb;padding:20px;border-radius:8px;margin:20px 0}
    .footer{text-align:center;font-size:12px;color:#888;margin-top:30px}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>Session Booked!</h1></div>
    <p>Hi ${clientName},</p>
    <p>A new session has been scheduled for you by <strong>${trainerName}</strong>.</p>
    <div class="details">
      <p><strong>Date:</strong> ${sessionDate}</p>
      <p><strong>Time:</strong> ${sessionTime}</p>
    </div>
    <p>We look forward to seeing you then!</p>
    <div class="footer"><p>Sent via Practably by ${senderName}</p></div>
  </div>
  </body></html>`;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `Session Booked: ${sessionDate}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log("Booking notification sent");
  } catch (error) {
    logError("Failed to send booking notification", error);
  }
}

export async function sendSessionCancellationEmail(data: {
  clientName: string;
  clientEmail: string;
  sessionDate: string;
  sessionTime: string;
  trainerName: string;
  businessName?: string;
  trainerEmail?: string;
}): Promise<void> {
  const { clientName, clientEmail, sessionDate, sessionTime, trainerName, businessName, trainerEmail } = data;
  const senderName = businessName || trainerName || "Practably";
  const senderEmail = trainerEmail || "noreply@practably.app";

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;background:#fff;padding:30px}
    .header{color:#dc2626;text-align:center;margin-bottom:30px}
    .details{background:#fef2f2;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #fecaca}
    .footer{text-align:center;font-size:12px;color:#888;margin-top:30px}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>Session Cancelled</h1></div>
    <p>Hi ${clientName},</p>
    <p>Unfortunately, the following session has been cancelled:</p>
    <div class="details">
      <p><strong>Date:</strong> ${sessionDate}</p>
      <p><strong>Time:</strong> ${sessionTime}</p>
    </div>
    <p>Please contact <strong>${trainerName}</strong> to reschedule if needed.</p>
    <div class="footer"><p>Sent via Practably by ${senderName}</p></div>
  </div>
  </body></html>`;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `Session Cancelled: ${sessionDate}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log("Cancellation notification sent");
  } catch (error) {
    logError("Failed to send cancellation email", error);
  }
}

export async function sendSessionRescheduleEmail(data: {
  clientName: string;
  clientEmail: string;
  newDate: string;
  newTime: string;
  oldDate?: string;
  oldTime?: string;
  trainerName: string;
  businessName?: string;
  trainerEmail?: string;
}): Promise<void> {
  const { clientName, clientEmail, newDate, newTime, oldDate, oldTime, trainerName, businessName, trainerEmail } = data;
  const senderName = businessName || trainerName || "Practably";
  const senderEmail = trainerEmail || "noreply@practably.app";

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;background:#fff;padding:30px}
    .header{color:#d97706;text-align:center;margin-bottom:30px}
    .details{background:#fffbeb;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #fde68a}
    .footer{text-align:center;font-size:12px;color:#888;margin-top:30px}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>Session Rescheduled</h1></div>
    <p>Hi ${clientName},</p>
    <p>Your session has been rescheduled by <strong>${trainerName}</strong>.</p>
    ${oldDate ? `<p style="color:#999;font-size:13px;">Previously: ${oldDate} at ${oldTime || ""}</p>` : ""}
    <div class="details">
      <p><strong>New Date:</strong> ${newDate}</p>
      <p><strong>New Time:</strong> ${newTime}</p>
    </div>
    <p>Please let us know if this new time doesn't work for you.</p>
    <div class="footer"><p>Sent via Practably by ${senderName}</p></div>
  </div>
  </body></html>`;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `Session Rescheduled: New time ${newDate}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log("Reschedule notification sent");
  } catch (error) {
    logError("Failed to send reschedule email", error);
  }
}

export async function sendLowSessionsEmail(data: {
  clientName: string;
  clientEmail: string;
  packageName: string;
  remainingSessions: number;
  trainerName: string;
  businessName?: string;
  trainerEmail?: string;
  paymentLink?: string;
}): Promise<void> {
  const { clientName, clientEmail, packageName, remainingSessions, trainerName, businessName, trainerEmail, paymentLink } = data;
  const senderName = businessName || trainerName || "Practably";
  const senderEmail = trainerEmail || "noreply@practably.app";
  const sessionWord = remainingSessions === 1 ? "session" : "sessions";

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;background:#fff}
    .header{background:#dc2626;color:white;padding:30px;text-align:center}
    .header h1{margin:0;font-size:24px}
    .body{padding:30px}
    .alert-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;text-align:center;margin:20px 0}
    .count{font-size:48px;font-weight:700;color:#dc2626;line-height:1}
    .count-label{font-size:14px;color:#991b1b;margin-top:4px}
    .package-name{background:#f9fafb;border-radius:6px;padding:10px 16px;display:inline-block;font-size:14px;color:#555;margin:10px 0}
    .renew-button{display:inline-block;background:#2563eb;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:600;margin:20px 0}
    .footer{padding:20px 30px;background:#f9fafb;text-align:center;font-size:12px;color:#888}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>${senderName}</h1></div>
    <div class="body">
      <p>Hi ${clientName},</p>
      <p>This is a friendly reminder that your session package is running low.</p>
      <div class="alert-box">
        <div class="count">${remainingSessions}</div>
        <div class="count-label">${sessionWord} remaining</div>
      </div>
      <p style="text-align:center;"><span class="package-name">${packageName}</span></p>
      <p style="color:#555;font-size:14px;">To keep your training on track, please get in touch with <strong>${trainerName}</strong> to renew or top up your sessions.</p>
      ${paymentLink ? `<p style="text-align:center;"><a href="${paymentLink}" class="renew-button">Renew Sessions</a></p>` : ""}
      <p style="color:#333;font-size:14px;">Thank you,<br><strong>${trainerName}</strong></p>
    </div>
    <div class="footer"><p>Sent via Practably by ${senderName}</p></div>
  </div>
  </body></html>`;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `You have ${remainingSessions} ${sessionWord} remaining - ${packageName}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log("Low sessions notification sent");
  } catch (error: any) {
    logError("Failed to send low sessions email", error);
    throw error;
  }
}

export async function sendBroadcastEmail(data: {
  subject: string;
  message: string;
  recipients: { name: string; email: string }[];
  trainerName: string;
  businessName?: string;
  trainerEmail?: string;
}): Promise<{ sent: number; failed: number }> {
  const { subject, message, recipients, trainerName, businessName, trainerEmail } = data;
  const senderName = businessName || trainerName || "Practably";
  const senderEmail = trainerEmail || "noreply@practably.app";

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;background:#fff}
    .header{background:#7c3aed;color:white;padding:30px;text-align:center}
    .header h1{margin:0;font-size:22px}
    .body{padding:30px;color:#333;font-size:15px;line-height:1.7;white-space:pre-line}
    .footer{padding:20px 30px;background:#f9fafb;text-align:center;font-size:12px;color:#888}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>${senderName}</h1></div>
    <div class="body">${message.replace(/\n/g, "<br/>")}</div>
    <div class="footer"><p>Message from ${trainerName} via Practably</p></div>
  </div>
  </body></html>`;

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await brevo.transactionalEmails.sendTransacEmail({
        subject,
        htmlContent,
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipient.email, name: recipient.name }],
      });
      sent++;
    } catch (error) {
      logError("Failed to send broadcast email", error);
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendParqEmail(data: {
  clientName: string;
  clientEmail: string;
  trainerName: string;
  businessName?: string;
  trainerEmail?: string;
}): Promise<void> {
  const { clientName, clientEmail, trainerName, businessName, trainerEmail } = data;
  const senderName = businessName || trainerName || "Practably";
  const senderEmail = trainerEmail || "noreply@practably.app";

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;background:#fff;padding:30px}
    .header{color:#2563eb;text-align:center;margin-bottom:30px}
    .questions{background:#f9fafb;padding:20px;border-radius:8px;margin:20px 0}
    .q{padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
    .footer{text-align:center;font-size:12px;color:#888;margin-top:30px}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>Health Screening Form (PAR-Q)</h1></div>
    <p>Hi ${clientName},</p>
    <p>Your coach <strong>${trainerName}</strong> has sent you a Pre-Activity Readiness Questionnaire (PAR-Q). Please review the questions below and reply to this email or contact your coach directly with your answers.</p>
    <div class="questions">
      <p style="font-weight:600;margin-bottom:12px;">Please answer Yes or No to each question:</p>
      <div class="q">1. Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?</div>
      <div class="q">2. Do you feel pain in your chest when you do physical activity?</div>
      <div class="q">3. In the past month, have you had chest pain when you were not doing physical activity?</div>
      <div class="q">4. Do you lose your balance because of dizziness or do you ever lose consciousness?</div>
      <div class="q">5. Do you have a bone or joint problem that could be made worse by a change in your physical activity?</div>
      <div class="q">6. Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?</div>
      <div class="q">7. Do you know of any other reason why you should not do physical activity?</div>
    </div>
    <p style="font-size:13px;color:#666;">Please reply to this email or contact ${trainerName} with your responses before your first session.</p>
    <div class="footer"><p>Sent via Practably by ${senderName}</p></div>
  </div>
  </body></html>`;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `Health Screening Form (PAR-Q) from ${senderName}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      to: [{ email: clientEmail, name: clientName }],
    });
    console.log("PAR-Q email sent");
  } catch (error: any) {
    logError("Failed to send PAR-Q email", error);
    throw error;
  }
}
