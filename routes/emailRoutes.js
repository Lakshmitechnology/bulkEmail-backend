const express = require("express");
const router = express.Router();

const Email = require("../model/email");
const transporter = require("../config/mail");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/", (req, res) => {
  res.send({ message: "Email routes are working" });
});

router.post("/send", async (req, res) => {
  const { subject, body } = req.body;

  // Accept an array, or a comma/semicolon/space separated string
  const rawRecipients = Array.isArray(req.body.recipients)
    ? req.body.recipients
    : String(req.body.recipients || "").split(/[,;\s]+/);

  // Clean up and remove duplicates (duplicates are skipped, not rejected)
  const emails = [
    ...new Set(
      rawRecipients
        .filter((email) => typeof email === "string")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  console.log(`Recipients received: ${emails.length}`, emails);

  if (
    typeof subject !== "string" ||
    !subject.trim() ||
    typeof body !== "string" ||
    !body.trim() ||
    emails.length === 0 ||
    emails.length > 100
  ) {
    return res.status(400).json({
      message: "Enter a subject, message and 1–100 recipients.",
    });
  }

  if (emails.some((email) => !emailPattern.test(email))) {
    return res.status(400).json({
      message: "Please enter valid email addresses.",
    });
  }

  let record;

  try {
    record = await Email.create({
      subject: subject.trim(),
      body: body.trim(),
      recipients: emails,
      status: "pending",
    });
  } catch (error) {
    console.error("Could not save email record:", error.message);
    return res.status(500).json({
      message: "Could not save the email campaign.",
    });
  }

  const sender =
    process.env.MAIL_FROM ||
    process.env.GMAIL_USER ||
    process.env.MAIL_USER ||
    process.env.username;

  const results = [];

  for (const recipient of emails) {
    try {
      const info = await transporter.sendMail({
        from: sender,
        to: recipient,
        subject: subject.trim(),
        text: body.trim(),
      });

      console.log("Sent to", recipient);

      results.push({
        recipient,
        status: "sent",
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("Email failed for", recipient, error.message);

      results.push({
        recipient,
        status: "failed",
        error: error.message,
      });
    }
  }

  const successCount = results.filter((item) => item.status === "sent").length;
  const failureCount = results.length - successCount;

  const status =
    failureCount === 0 ? "sent" : successCount === 0 ? "failed" : "partial";

  try {
    record.results = results;
    record.status = status;
    await record.save();
  } catch (error) {
    console.error("Could not update email history:", error.message);

    return res.status(500).json({
      message: "Sending finished, but saving the final status failed.",
      campaignId: record._id,
      results,
    });
  }

  return res.status(200).json({
    message: `Email processing completed: ${successCount} succeeded, ${failureCount} failed.`,
    campaignId: record._id,
    status,
    results,
  });
});

router.get("/history", async (req, res) => {
  try {
    const history = await Email.find().sort({ createdAt: -1 }).limit(100);
    res.json(history);
  } catch (error) {
    console.error("Could not fetch email history:", error.message);

    res.status(500).json({
      message: "Could not load email history.",
    });
  }
});

module.exports = router;