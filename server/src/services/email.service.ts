// import nodemailer from "nodemailer";
// import { ENV } from "../config/env";

// const transporter = nodemailer.createTransport({
//   host: ENV.EMAIL.host,
//   port: ENV.EMAIL.port,
//   secure: false,
//   auth: {
//     user: ENV.EMAIL.user,
//     pass: ENV.EMAIL.pass,
//   },
// });

// transporter.verify((err) => {
//   if (err) {
//     console.error("❌ Email transporter error:", err.message);
//   } else {
//     console.log("✅ Email service ready");
//   }
// });

// export interface BookingEmailData {
//   toEmail: string;
//   toName: string;
//   eventTitle: string;
//   venue: string;
//   eventDate: string;
//   seatNumber: string;
//   rowLabel: string;
//   pricePaid: number;
//   bookingId: string;
// }

// const formatDate = (dateStr: string): string => {
//   return new Date(dateStr).toLocaleDateString("en-IN", {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// };

// export const sendBookingConfirmationEmail = async (
//   data: BookingEmailData
// ): Promise<void> => {
//   const {
//     toEmail,
//     toName,
//     eventTitle,
//     venue,
//     eventDate,
//     seatNumber,
//     rowLabel,
//     pricePaid,
//     bookingId,
//   } = data;

//   const html = `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="utf-8">
//       <style>
//         body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; margin: 0; padding: 0; }
//         .wrapper { max-width: 560px; margin: 40px auto; padding: 0 20px; }
//         .card { background: #111118; border: 1px solid #1e1e2e; border-radius: 16px; overflow: hidden; }
//         .header { background: #4f46e5; padding: 32px; text-align: center; }
//         .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
//         .header p { color: #c7d2fe; margin: 8px 0 0; font-size: 14px; }
//         .body { padding: 32px; }
//         .greeting { color: #e5e7eb; font-size: 16px; margin: 0 0 24px; }
//         .ticket { background: #1a1a2e; border: 1px solid #2d2d44; border-radius: 12px; padding: 24px; margin: 24px 0; }
//         .ticket-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #2d2d44; }
//         .ticket-row:last-child { border-bottom: none; }
//         .ticket-label { color: #9ca3af; font-size: 13px; }
//         .ticket-value { color: #f3f4f6; font-size: 14px; font-weight: 500; text-align: right; max-width: 60%; }
//         .seat-badge { background: #4f46e5; color: white; font-size: 22px; font-weight: 700; padding: 12px 24px; border-radius: 10px; text-align: center; margin: 20px 0; letter-spacing: 2px; }
//         .price { color: #34d399; font-size: 26px; font-weight: 700; }
//         .footer { padding: 20px 32px; border-top: 1px solid #1e1e2e; }
//         .footer p { color: #6b7280; font-size: 12px; margin: 0; text-align: center; }
//         .booking-id { color: #4b5563; font-size: 11px; font-family: monospace; text-align: center; margin-top: 8px; }
//       </style>
//     </head>
//     <body>
//       <div class="wrapper">
//         <div class="card">
//           <div class="header">
//             <h1>🎟️ Booking Confirmed!</h1>
//             <p>Your ticket is secured. See you there!</p>
//           </div>

//           <div class="body">
//             <p class="greeting">Hey ${toName},<br>Your booking is confirmed. Here are your ticket details:</p>

//             <div class="seat-badge">
//               ROW ${rowLabel} — SEAT ${seatNumber}
//             </div>

//             <div class="ticket">
//               <div class="ticket-row">
//                 <span class="ticket-label">Event</span>
//                 <span class="ticket-value">${eventTitle}</span>
//               </div>
//               <div class="ticket-row">
//                 <span class="ticket-label">Venue</span>
//                 <span class="ticket-value">${venue}</span>
//               </div>
//               <div class="ticket-row">
//                 <span class="ticket-label">Date & Time</span>
//                 <span class="ticket-value">${formatDate(eventDate)}</span>
//               </div>
//               <div class="ticket-row">
//                 <span class="ticket-label">Seat</span>
//                 <span class="ticket-value">${seatNumber} (Row ${rowLabel})</span>
//               </div>
//               <div class="ticket-row">
//                 <span class="ticket-label">Amount Paid</span>
//                 <span class="ticket-value price">₹${Number(pricePaid).toLocaleString("en-IN")}</span>
//               </div>
//             </div>
//           </div>

//           <div class="footer">
//             <p>SmartQueue — Distributed Ticket Booking</p>
//             <p class="booking-id">Booking ID: ${bookingId}</p>
//           </div>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;

//   await transporter.sendMail({
//     from: ENV.EMAIL.from,
//     to: toEmail,
//     subject: `✅ Booking Confirmed — ${eventTitle} (Seat ${seatNumber})`,
//     html,
//   });

//   console.log(`📧 Confirmation email sent to ${toEmail}`);
// };

import nodemailer from "nodemailer";
import { ENV } from "../config/env";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  // auth: {
  //   user: ENV.BREVO.senderEmail,
  //   pass: ENV.BREVO.apiKey,       // Brevo uses API key as SMTP password
  // },
  auth: {
    user: ENV.BREVO.smtpUser,
    pass: ENV.BREVO.smtpPass,
  },
});

transporter.verify((err) => {
  if (err) console.error("❌ Brevo SMTP error:", err.message);
  else console.log("✅ Brevo email service ready");
});

export interface BookingEmailData {
  toEmail: string;
  toName: string;
  eventTitle: string;
  venue: string;
  eventDate: string;
  seatNumber: string;
  rowLabel: string;
  pricePaid: number;
  bookingId: string;
}

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const buildTicketHtml = (data: BookingEmailData): string => {
  const {
    toName,
    eventTitle,
    venue,
    eventDate,
    seatNumber,
    rowLabel,
    pricePaid,
    bookingId,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               background: #0f0f17; color: #e5e7eb; }
        .wrapper { max-width: 580px; margin: 40px auto; padding: 0 16px 40px; }

        /* Header */
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                  border-radius: 16px 16px 0 0; padding: 36px 32px; text-align: center; }
        .header-icon { font-size: 48px; margin-bottom: 12px; }
        .header h1 { color: #fff; font-size: 26px; font-weight: 700; margin-bottom: 6px; }
        .header p  { color: #c7d2fe; font-size: 15px; }

        /* Card body */
        .card { background: #1a1a2e; border: 1px solid #2d2d44;
                border-top: none; border-radius: 0 0 16px 16px; overflow: hidden; }

        /* Seat badge */
        .seat-section { padding: 28px 32px; text-align: center;
                        border-bottom: 1px dashed #2d2d44; }
        .seat-badge { display: inline-block; background: #4f46e5;
                      color: #fff; font-size: 32px; font-weight: 800;
                      padding: 16px 40px; border-radius: 12px;
                      letter-spacing: 4px; margin-bottom: 8px; }
        .seat-sub { color: #9ca3af; font-size: 13px; }

        /* Details table */
        .details { padding: 24px 32px; border-bottom: 1px dashed #2d2d44; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 10px 0; font-size: 14px;
                      border-bottom: 1px solid #23233a; }
        .details td:last-child { border-bottom: none; }
        .details .label { color: #9ca3af; width: 40%; }
        .details .value { color: #f3f4f6; font-weight: 500;
                          text-align: right; }
        .price-value { color: #34d399; font-size: 20px; font-weight: 700; }

        /* Warning strip */
        .warning { background: #1e1b38; padding: 16px 32px;
                   border-bottom: 1px solid #2d2d44; }
        .warning p { font-size: 12px; color: #818cf8; text-align: center; }

        /* Footer */
        .footer { padding: 24px 32px; text-align: center; }
        .footer p { color: #4b5563; font-size: 12px; line-height: 1.6; }
        .booking-id { font-family: monospace; color: #374151;
                      font-size: 11px; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="header-icon">🎟️</div>
          <h1>Booking Confirmed!</h1>
          <p>Your ticket is secured — see you there!</p>
        </div>

        <div class="card">
          <!-- Greeting -->
          <div style="padding: 24px 32px 0; font-size: 15px; color: #d1d5db;">
            Hey <strong style="color:#fff">${toName}</strong>,<br>
            your booking is confirmed. Here are your ticket details:
          </div>

          <!-- Seat badge -->
          <div class="seat-section">
            <div class="seat-badge">ROW ${rowLabel} · SEAT ${seatNumber}</div>
            <div class="seat-sub">Your assigned seat</div>
          </div>

          <!-- Event details -->
          <div class="details">
            <table>
              <tr>
                <td class="label">🎵 Event</td>
                <td class="value">${eventTitle}</td>
              </tr>
              <tr>
                <td class="label">📍 Venue</td>
                <td class="value">${venue}</td>
              </tr>
              <tr>
                <td class="label">📅 Date</td>
                <td class="value">${formatDate(eventDate)}</td>
              </tr>
              <tr>
                <td class="label">💺 Seat</td>
                <td class="value">${seatNumber} (Row ${rowLabel})</td>
              </tr>
              <tr>
                <td class="label">💰 Amount Paid</td>
                <td class="value price-value">
                  ₹${Number(pricePaid).toLocaleString("en-IN")}
                </td>
              </tr>
            </table>
          </div>

          <!-- Warning -->
          <div class="warning">
            <p>🔒 This ticket is non-transferable. Please carry a valid ID to the event.</p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>
              SmartQueue — Distributed Ticket Booking Platform<br>
              Questions? Reply to this email.
            </p>
            <p class="booking-id">Booking ID: ${bookingId}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const sendBookingConfirmationEmail = async (
  data: BookingEmailData,
): Promise<void> => {
  if (!ENV.BREVO.smtpPass)  {
    console.warn("⚠️  Brevo API key not set — skipping email");
    return;
  }

  await transporter.sendMail({
    from: `"${ENV.BREVO.senderName}" <${ENV.BREVO.senderEmail}>`,
    to: `"${data.toName}" <${data.toEmail}>`,
    subject: `✅ Confirmed — ${data.eventTitle} · Seat ${data.seatNumber}`,
    html: buildTicketHtml(data),
    text: `Booking Confirmed — ${data.eventTitle} Seat ${data.seatNumber}`,
  });
  console.log(
    `📧 Brevo email sent to ${data.toEmail} (Seat ${data.seatNumber})`,
  );
  console.log(
    `📧 Brevo email sent to ${data.toEmail} (Seat ${data.seatNumber})`,
  );
};
