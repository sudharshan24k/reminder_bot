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

// Track processed reminders to prevent duplicates in the same minute
const processedReminders = new Set<string>();

export const initScheduler = () => {
  cron.schedule('* * * * *', async () => {
    console.log('--- Scheduler Tick ---');

    try {
      const now = new Date();

      // Safety check: Don't process reminders older than 7 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);

      // ✅ TIMING FIX: Only process reminders scheduled for the current minute
      // This prevents early triggering and ensures exact timing
      const currentMinuteStart = new Date(now);
      currentMinuteStart.setSeconds(0, 0);

      const currentMinuteEnd = new Date(now);
      currentMinuteEnd.setSeconds(59, 999);

      // ✅ CRITICAL FIX: Use the later of currentMinuteStart or cutoffDate
      const queryStartDate = currentMinuteStart > cutoffDate ? currentMinuteStart : cutoffDate;

      const reminders = await Reminder.find({
        status: 'pending',
        scheduledAt: {
          $gte: queryStartDate,
          $lte: currentMinuteEnd
        }
      }).populate('user');

      if (reminders.length === 0) {
        console.log('No due reminders.');
        return;
      }

      console.log(`Found ${reminders.length} due reminders.`);

      for (const reminder of reminders) {
        // ✅ DEDUPLICATION: Skip if already processed in this tick
        const reminderId = reminder._id.toString();
        if (processedReminders.has(reminderId)) {
          console.log(`⏭️ Skipping already processed reminder ${reminderId}`);
          continue;
        }
        processedReminders.add(reminderId);

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

          // ✅ CRITICAL FIX: Mark as sent BEFORE creating next reminder
          // This prevents infinite loops if recurrence creation fails
          reminder.status = 'sent';
          await reminder.save();
          console.log(`✅ Reminder ${reminder._id} marked as SENT.`);

          // Create next recurring reminder if applicable
          if (nextDate) {
            try {
              // ✅ CRITICAL FIX: Use user._id instead of populated user object
              const userId = typeof reminder.user === 'object' && 'platformId' in reminder.user
                ? (reminder.user as any)._id
                : reminder.user;

              await Reminder.create({
                user: userId,
                text: reminder.text,
                originalText: reminder.originalText,
                scheduledAt: nextDate,
                status: 'pending',
                recurrence: reminder.recurrence
              });
              console.log(`✅ Next recurring reminder created for ${nextDate.toISOString()}`);
            } catch (recurrenceError) {
              console.error(`❌ Failed to create next recurring reminder:`, recurrenceError);
              // Don't throw - the current reminder is already marked as sent
            }
          }
        } catch (err) {
          console.error(`❌ Failed reminder ${reminder._id}`, err);
        }
      }
    } catch (err) {
      console.error('Scheduler Error:', err);
    }

    console.log('----------------------');
  });

  // Clear processed reminders cache every 5 minutes to prevent memory buildup
  setInterval(() => {
    processedReminders.clear();
    console.log('🧹 Cleared processed reminders cache');
  }, 5 * 60 * 1000);
};