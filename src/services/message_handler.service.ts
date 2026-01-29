import { findOrCreateUser } from './user.service';
import { parseReminderIntent } from './nlp.service';
import { createReminder } from './reminder.service';
import { sendMessage } from './bot.service';
import { buildUserDateTimeToUTC } from '../utils/timezone';
import { DateTime } from 'luxon';

export const handleIncomingMessage = async (
  platform: 'whatsapp' | 'telegram',
  platformId: string,
  userName: string,
  text: string,
  messageTimestamp?: number // unix seconds
) => {
  try {
    const user = await findOrCreateUser(platform, platformId, userName);

    /* ---------------- TIMEZONE COMMAND ---------------- */
    if (text.startsWith('/timezone')) {
      const tz = text.split(' ')[1];
      if (!tz) {
        await sendMessage(platform, platformId, 'Usage: /timezone Asia/Kolkata');
        return;
      }

      user.timezone = tz;
      await user.save();
      await sendMessage(platform, platformId, `✅ Timezone set to ${tz}`);
      return;
    }

    if (!user.timezone) {
      await sendMessage(
        platform,
        platformId,
        '🌍 Please set your timezone first.\nExample: /timezone Asia/Kolkata'
      );
      return;
    }

    /* ---------------- NLP ---------------- */
    const nlpResult = await parseReminderIntent(text);
    if (!nlpResult?.isoDate) {
      await sendMessage(platform, platformId, 'I could not understand the time.');
      return;
    }

    /* ---------------- TIME EXTRACTION ---------------- */
    const timeMatch = nlpResult.isoDate.match(/(\d{2}):(\d{2})/);
    if (!timeMatch) {
      await sendMessage(platform, platformId, 'Invalid time format.');
      return;
    }

    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);

    /* ---------------- DATE SOURCE (CRITICAL FIX) ---------------- */
    let baseDate: DateTime;

    if (messageTimestamp) {
      // ✅ TRUST TELEGRAM TIMESTAMP (CORRECT DATE)
      baseDate = DateTime.fromSeconds(messageTimestamp).setZone(user.timezone);
    } else {
      // fallback only if platform doesn't give timestamp
      baseDate = DateTime.now().setZone(user.timezone);
    }

    if (text.toLowerCase().includes('tomorrow')) {
      baseDate = baseDate.plus({ days: 1 });
    }

    /* ---------------- BUILD UTC DATE ---------------- */
    const scheduledAtUTC = buildUserDateTimeToUTC(
      baseDate.year,
      baseDate.month,
      baseDate.day,
      hour,
      minute,
      user.timezone
    );

    /* ---------------- CREATE REMINDER ---------------- */
    await createReminder(
      user._id,
      text,
      text,
      scheduledAtUTC,
      nlpResult.recurrence
    );

    const confirmTime = DateTime
      .fromJSDate(scheduledAtUTC, { zone: 'utc' })
      .setZone(user.timezone)
      .toFormat('dd LLL yyyy, hh:mm a');

    await sendMessage(
      platform,
      platformId,
      `✅ Reminder set for ${confirmTime}`
    );
  } catch (err) {
    console.error(err);
    await sendMessage(platform, platformId, 'Something went wrong.');
  }
};
