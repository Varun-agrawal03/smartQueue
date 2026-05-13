import nodemailer from "nodemailer";
import { ENV } from "../config/env";

const transporter = nodemailer.createTransport({
  host: ENV.EMAIL.host,
  port: ENV.EMAIL.port,
  secure: false,
  auth: {
    user: ENV.EMAIL.user,
    pass: ENV.EMAIL.pass,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("❌ Email transporter error:", err.message);
  } else {
    console.log("✅ Email service ready");
  }
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

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const sendBookingConfirmationEmail = async (
  data: BookingEmailData
): Promise<void> => {
  const {
    toEmail,
    toName,
    eventTitle,
    venue,
    eventDate,
    seatNumber,
    rowLabel,
    pricePaid,
    bookingId,
  } = data;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; margin: 0; padding: 0; }
        .wrapper { max-width: 560px; margin: 40px auto; padding: 0 20px; }
        .card { background: #111118; border: 1px solid #1e1e2e; border-radius: 16px; overflow: hidden; }
        .header { background: #4f46e5; padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
        .header p { color: #c7d2fe; margin: 8px 0 0; font-size: 14px; }
        .body { padding: 32px; }
        .greeting { color: #e5e7eb; font-size: 16px; margin: 0 0 24px; }
        .ticket { background: #1a1a2e; border: 1px solid #2d2d44; border-radius: 12px; padding: 24px; margin: 24px 0; }
        .ticket-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #2d2d44; }
        .ticket-row:last-child { border-bottom: none; }
        .ticket-label { color: #9ca3af; font-size: 13px; }
        .ticket-value { color: #f3f4f6; font-size: 14px; font-weight: 500; text-align: right; max-width: 60%; }
        .seat-badge { background: #4f46e5; color: white; font-size: 22px; font-weight: 700; padding: 12px 24px; border-radius: 10px; text-align: center; margin: 20px 0; letter-spacing: 2px; }
        .price { color: #34d399; font-size: 26px; font-weight: 700; }
        .footer { padding: 20px 32px; border-top: 1px solid #1e1e2e; }
        .footer p { color: #6b7280; font-size: 12px; margin: 0; text-align: center; }
        .booking-id { color: #4b5563; font-size: 11px; font-family: monospace; text-align: center; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="header">
            <h1>🎟️ Booking Confirmed!</h1>
            <p>Your ticket is secured. See you there!</p>
          </div>

          <div class="body">
            <p class="greeting">Hey ${toName},<br>Your booking is confirmed. Here are your ticket details:</p>

            <div class="seat-badge">
              ROW ${rowLabel} — SEAT ${seatNumber}
            </div>

            <div class="ticket">
              <div class="ticket-row">
                <span class="ticket-label">Event</span>
                <span class="ticket-value">${eventTitle}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Venue</span>
                <span class="ticket-value">${venue}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Date & Time</span>
                <span class="ticket-value">${formatDate(eventDate)}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Seat</span>
                <span class="ticket-value">${seatNumber} (Row ${rowLabel})</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Amount Paid</span>
                <span class="ticket-value price">₹${Number(pricePaid).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>SmartQueue — Distributed Ticket Booking</p>
            <p class="booking-id">Booking ID: ${bookingId}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: ENV.EMAIL.from,
    to: toEmail,
    subject: `✅ Booking Confirmed — ${eventTitle} (Seat ${seatNumber})`,
    html,
  });

  console.log(`📧 Confirmation email sent to ${toEmail}`);
};