import cron from 'node-cron';
import Reminder from '../models/Reminder';
import { sendMessage } from './bot.service';
import { DateTime } from 'luxon';

/**
 * Cleans user reminder text and builds a human-friendly reminder message
 */
function buildReminderMessage(
  originalText: string,
  scheduledAtUTC: Date,
  userTimezone: string
): string {
  // Normalize text
  let intent = originalText.toLowerCase();

  // Remove leading command phrases
  intent = intent.replace(/^remind me to /, '');
  intent = intent.replace(/^remind me /, '');

  // Remove recurrence words
  intent = intent.replace(/\b(everyday|every day|daily|every night|every morning)\b/gi, '');

  // Remove date/time phrases
  intent = intent.replace(/\b(today|tomorrow)\b/gi, '');
  intent = intent.replace(/\bat .*$/gi, '');

  // Cleanup extra spaces
  intent = intent.replace(/\s+/g, ' ').trim();

  // Capitalize first letter
  intent = intent.charAt(0).toUpperCase() + intent.slice(1);

  // Format time in user's timezone
  const time = DateTime
    .fromJSDate(scheduledAtUTC, { zone: 'utc' })
    .setZone(userTimezone)
    .toFormat('hh:mm a');

  return `🔔 📢 Reminder:\nThis is a reminder for you to ${intent} at ${time}.`;
}

export const initScheduler = () => {
  cron.schedule('* * * * *', async () => {
    console.log('--- Scheduler Tick ---');

    try {
      const now = new Date();

      const reminders = await Reminder.find({
        status: 'pending',
        scheduledAt: { $lte: now }
      }).populate('user');

      if (reminders.length === 0) {
        console.log('No due reminders.');
        return;
      }

      console.log(`Found ${reminders.length} due reminders.`);

      for (const reminder of reminders) {
        const user: any = reminder.user;

        if (!user?.platform || !user?.platformId || !user?.timezone) {
          console.error(`❌ Missing user data for reminder ${reminder._id}`);
          continue;
        }

        try {
          // Build clean reminder message
          const message = buildReminderMessage(
            reminder.originalText,
            reminder.scheduledAt,
            user.timezone
          );

          const delivered = await sendMessage(
            user.platform,
            user.platformId,
            message
          );

          if (!delivered) continue;

          // 🔁 Handle recurrence
          let nextDate: Date | undefined;

          if (reminder.recurrence) {
            const lastDate = new Date(reminder.scheduledAt);

            if (reminder.recurrence.type === 'daily') {
              nextDate = new Date(lastDate);
              nextDate.setUTCDate(nextDate.getUTCDate() + 1);
            } else if (reminder.recurrence.type === 'weekly') {
              nextDate = new Date(lastDate);
              nextDate.setUTCDate(nextDate.getUTCDate() + 7);
            } else if (
              reminder.recurrence.type === 'interval' &&
              reminder.recurrence.intervalValue
            ) {
              nextDate = new Date(lastDate);
              nextDate.setUTCDate(
                nextDate.getUTCDate() + reminder.recurrence.intervalValue
              );
            }

            if (nextDate) nextDate.setUTCSeconds(0, 0);
          }

          if (nextDate) {
            await Reminder.create({
              user: reminder.user,
              text: reminder.text,
              originalText: reminder.originalText,
              scheduledAt: nextDate,
              status: 'pending',
              recurrence: reminder.recurrence
            });
          }

          reminder.status = 'sent';
          await reminder.save();

          console.log(`✅ Reminder ${reminder._id} marked as SENT.`);
        } catch (err) {
          console.error(`❌ Failed reminder ${reminder._id}`, err);
        }
      }
    } catch (err) {
      console.error('Scheduler Error:', err);
    }

    console.log('----------------------');
  });
};
