import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ENAV_EMAIL,
    pass: process.env.ENAV_EMAIL_PASSWORD,
  },
});

export const sendEmailToEnav = async ({
  subject,
  body,
  html,
}: {
  subject: string;
  body: string;
  html?: string;
}) => {
  await transporter.sendMail({
    from: `"TODA MAX System" <${process.env.ENAV_EMAIL}>`,
    to: process.env.ENAV_EMAIL,
    subject,
    text: body,
    html,
  });
};
