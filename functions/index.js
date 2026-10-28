const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const CryptoJS = require("crypto-js");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

/**
 * Decrypts AES data using user's crypto key.
 */
function decryptPayload(ciphertext, key) {
  if (!ciphertext || typeof ciphertext !== "string" || !key) return ciphertext;
  if (!ciphertext.startsWith("U2FsdGVkX1")) return ciphertext; // Not AES encrypted
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return ciphertext;
    return JSON.parse(decryptedStr);
  } catch (err) {
    logger.warn("Could not decrypt payload field", err);
    return null;
  }
}

/**
 * Calculate weekly stats from user's tasks and courses.
 */
function computeSummary(tasks = [], courses = [], now = new Date()) {
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  const doneThisWeek = tasks.filter((t) => {
    if (t.status !== "done" || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= oneWeekAgo && d <= now;
  });

  const donePrevWeek = tasks.filter((t) => {
    if (t.status !== "done" || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  });

  const totalMinutesThisWeek = doneThisWeek.reduce(
    (sum, t) => sum + (t.actualDuration || t.estimatedDuration || 0),
    0
  );
  const totalMinutesPrevWeek = donePrevWeek.reduce(
    (sum, t) => sum + (t.actualDuration || t.estimatedDuration || 0),
    0
  );

  const minutesByCourse = {};
  for (const t of doneThisWeek) {
    if (!t.courseId) continue;
    const duration = t.actualDuration || t.estimatedDuration || 0;
    minutesByCourse[t.courseId] = (minutesByCourse[t.courseId] || 0) + duration;
  }

  const coursesMap = new Map(courses.map((c) => [c.id, c.name]));
  let topCourseId = null;
  let topMinutes = 0;
  for (const [cId, mins] of Object.entries(minutesByCourse)) {
    if (mins > topMinutes) {
      topMinutes = mins;
      topCourseId = cId;
    }
  }

  const topCourseName = topCourseId ? (coursesMap.get(topCourseId) || "Corso") : null;
  const hoursThisWeek = (totalMinutesThisWeek / 60).toFixed(1);
  const hoursPrevWeek = (totalMinutesPrevWeek / 60).toFixed(1);
  const hoursDelta = (hoursThisWeek - hoursPrevWeek).toFixed(1);

  return {
    tasksCount: doneThisWeek.length,
    prevTasksCount: donePrevWeek.length,
    tasksDelta: doneThisWeek.length - donePrevWeek.length,
    hoursThisWeek,
    hoursPrevWeek,
    hoursDelta,
    topCourseName,
    topCourseHours: (topMinutes / 60).toFixed(1),
  };
}

/**
 * Builds standard HTML email content.
 */
function buildEmailHtml(stats, userName = "Studente") {
  const deltaBadge =
    stats.tasksDelta >= 0
      ? `<span style="color: #22c55e; font-weight: bold;">+${stats.tasksDelta} rispetto alla settimana scorsa</span>`
      : `<span style="color: #ef4444; font-weight: bold;">${stats.tasksDelta} rispetto alla settimana scorsa</span>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 24px; margin: 0; }
    .card { background-color: #161e2e; border: 1px solid #2d3748; border-radius: 12px; padding: 24px; max-width: 540px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .header { text-align: center; border-bottom: 1px solid #2d3748; padding-bottom: 16px; margin-bottom: 20px; }
    .title { color: #818cf8; margin: 0; font-size: 22px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-top: 4px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .stat-box { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); padding: 14px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 26px; font-weight: bold; color: #ffffff; }
    .stat-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .highlight-box { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 20px; text-align: center; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #2d3748; padding-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">🎓 UniCalendar</h1>
      <div class="subtitle">Il tuo riepilogo settimanale di studio</div>
    </div>

    <p style="font-size: 15px; color: #e2e8f0; line-height: 1.5;">
      Ciao <strong>${userName}</strong>, ecco com'è andata la tua settimana accademica:
    </p>

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-number">${stats.tasksCount}</div>
        <div class="stat-label">Attività Svolte</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.hoursThisWeek}h</div>
        <div class="stat-label">Ore Totali</div>
      </div>
    </div>

    <div class="highlight-box">
      <div style="font-size: 14px; color: #e2e8f0;">
        Andamento: ${deltaBadge}
      </div>
      ${
        stats.topCourseName
          ? `<div style="font-size: 14px; color: #cbd5e1; margin-top: 6px;">
               Materia più studiata: <strong style="color: #a5b4fc;">${stats.topCourseName}</strong> (${stats.topCourseHours}h)
             </div>`
          : ""
      }
    </div>

    <p style="font-size: 13px; color: #94a3b8; line-height: 1.4; text-align: center;">
      Continua così! Preparare con costanza le prossime lezioni e mantenere gli esercizi al passo ti farà arrivare sereno alle sessioni d'esame.
    </p>

    <div class="footer">
      Inviato automaticamente da UniCalendar in base alle tue preferenze.<br>
      Puoi modificare o disattivare questa email nelle Impostazioni dell'app.
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Sends or queues an email.
 * First tries Firestore "mail" collection (Trigger Email extension).
 * If SMTP is configured in env, also supports direct nodemailer dispatch.
 */
async function deliverEmail(toEmail, subject, htmlContent) {
  // 1. Always queue into Firestore "mail" collection (official Firebase extension pattern)
  await db.collection("mail").add({
    to: toEmail,
    message: {
      subject,
      html: htmlContent,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 2. Direct SMTP transport if environment credentials exist
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"UniCalendar" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });
      logger.info(`Direct SMTP email delivered to ${toEmail}`);
    } catch (smtpErr) {
      logger.warn("Direct SMTP delivery failed, email queued in mail collection:", smtpErr);
    }
  }
}

/**
 * Scheduled Cloud Function: Runs hourly to deliver weekly summaries.
 */
exports.sendWeeklySummaries = onSchedule(
  { schedule: "0 * * * *", timeZone: "UTC" },
  async (_event) => {
    logger.info("Starting weekly summaries dispatch check...");

    const usersSnap = await db.collection("users").get();
    const now = new Date();

    for (const doc of usersSnap.docs) {
      try {
        const userId = doc.id;
        const rawUserData = doc.data();

        // 1. Fetch user's crypto key
        const keySnap = await db.collection("user_keys").doc(userId).get();
        const userKey = keySnap.exists ? keySnap.data().key : null;

        // 2. Decrypt data
        const preferences = decryptPayload(rawUserData.preferences, userKey);
        const weeklyPrefs = preferences?.weeklySummary;

        if (!weeklyPrefs || !weeklyPrefs.emailEnabled) {
          continue;
        }

        // Determine destination email
        const targetEmail = weeklyPrefs.email || rawUserData.email || null;
        if (!targetEmail) {
          continue;
        }

        // Check if now matches scheduled day and hour
        // (default: day 0 = Sunday, hour 20)
        const userTz = weeklyPrefs.timeZone || "Europe/Rome";
        const localTimeStr = now.toLocaleString("en-US", { timeZone: userTz });
        const localDate = new Date(localTimeStr);
        const currentDay = localDate.getDay(); // 0 is Sunday
        const currentHour = localDate.getHours();

        const desiredDay = weeklyPrefs.day ?? 0;
        const desiredHour = weeklyPrefs.hour ?? 20;

        if (currentDay !== desiredDay || currentHour !== desiredHour) {
          continue;
        }

        // 3. Decrypt tasks and courses to calculate weekly stats
        const tasks = decryptPayload(rawUserData.tasks, userKey) || [];
        const courses = decryptPayload(rawUserData.courses, userKey) || [];

        const stats = computeSummary(tasks, courses, now);
        const emailHtml = buildEmailHtml(stats, rawUserData.name || "Studente");

        await deliverEmail(
          targetEmail,
          "🎓 UniCalendar - Il tuo Riepilogo Settimanale",
          emailHtml
        );

        logger.info(`Weekly summary sent to user ${userId} (${targetEmail})`);
      } catch (err) {
        logger.error(`Error processing user ${doc.id}:`, err);
      }
    }
  }
);

/**
 * Callable Cloud Function: allows a student to send a test summary email immediately.
 */
exports.sendWeeklySummaryTest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const userId = request.auth.uid;
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User data not found.");
  }

  const rawUserData = userDoc.data();
  const keySnap = await db.collection("user_keys").doc(userId).get();
  const userKey = keySnap.exists ? keySnap.data().key : null;

  const preferences = decryptPayload(rawUserData.preferences, userKey);
  const tasks = decryptPayload(rawUserData.tasks, userKey) || [];
  const courses = decryptPayload(rawUserData.courses, userKey) || [];

  const targetEmail =
    preferences?.weeklySummary?.email ||
    request.auth.token.email ||
    rawUserData.email;

  if (!targetEmail) {
    throw new HttpsError("invalid-argument", "No destination email configured.");
  }

  const stats = computeSummary(tasks, courses, new Date());
  const emailHtml = buildEmailHtml(stats, request.auth.token.name || "Studente");

  await deliverEmail(
    targetEmail,
    "🎓 UniCalendar - Test Riepilogo Settimanale",
    emailHtml
  );

  return { success: true, email: targetEmail };
});
