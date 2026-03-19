// Email notification service using EmailJS (free, no backend needed)
// Setup: 1) Create account at emailjs.com 2) Create email template 3) Set env vars

const EMAILJS_SERVICE = (import.meta as any).env?.VITE_EMAILJS_SERVICE || '';
const EMAILJS_TEMPLATE = (import.meta as any).env?.VITE_EMAILJS_TEMPLATE || '';
const EMAILJS_PUBLIC_KEY = (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || '';

export const sendEmailNotification = async (
  toEmail: string,
  toName: string,
  subject: string,
  message: string,
): Promise<boolean> => {
  if (!EMAILJS_SERVICE || !EMAILJS_TEMPLATE || !EMAILJS_PUBLIC_KEY) {
    console.warn('EmailJS not configured. Set VITE_EMAILJS_SERVICE, VITE_EMAILJS_TEMPLATE, VITE_EMAILJS_PUBLIC_KEY in .env');
    return false;
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: toEmail,
          to_name: toName,
          subject: subject,
          message: message,
          app_name: 'Melody Music',
        },
      }),
    });
    return response.ok;
  } catch (err) {
    console.warn('Email notification failed:', err);
    return false;
  }
};