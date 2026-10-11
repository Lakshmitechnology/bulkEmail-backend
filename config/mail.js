const nodemailer = require("nodemailer");

const gmailUser = process.env.GMAIL_USER || process.env.MAIL_USER || process.env.username;
const gmailPass = process.env.GMAIL_APP_PASS || process.env.MAIL_PASS || process.env.pass;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
});

module.exports = transporter;