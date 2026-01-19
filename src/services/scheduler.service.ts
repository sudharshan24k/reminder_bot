import cron from 'node-cron';
import Reminder from '../models/Reminder';
import { updateReminderStatus } from './reminder.service'; // Reuse helper or inline
// "Outcome: Reminder engine works without bots" -> replace bot send with console log

export const initScheduler = () => {
    // Cron job (every 1 minute)
    cron.schedule('* * * * *', async () => {
        console.log('--- Scheduler Tick ---');
        try {
            const now = new Date();

            // 1. Find due reminders
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
                const user = reminder.user as any;

                // 2. Send message (Simulated/Console)
                const message = `🔔 [${user?.platform?.toUpperCase() || 'API'}] Reminder for ${user?.name || 'User'}: "${reminder.text}"`;
                console.log('SENDING MESSAGE >>>', message);

                // 3. Mark as sent (and handle recurrence)
                // Logic: If recurring, create next, mark current sent.

                let nextDate: Date | undefined;
                if (reminder.recurrence) {
                    const lastDate = new Date(reminder.scheduledAt);
                    if (reminder.recurrence.type === 'daily') {
                        nextDate = new Date(lastDate);
                        nextDate.setDate(nextDate.getDate() + 1);
                    } else if (reminder.recurrence.type === 'weekly') {
                        nextDate = new Date(lastDate);
                        nextDate.setDate(nextDate.getDate() + 7);
                    } else if (reminder.recurrence.type === 'interval' && reminder.recurrence.intervalValue) {
                        nextDate = new Date(lastDate);
                        nextDate.setDate(nextDate.getDate() + reminder.recurrence.intervalValue);
                    }
                }

                // Update status
                if (nextDate) {
                    // Create next
                    await Reminder.create({
                        user: reminder.user,
                        text: reminder.text,
                        originalText: reminder.originalText,
                        scheduledAt: nextDate,
                        status: 'pending',
                        recurrence: reminder.recurrence
                    });
                    console.log(`Rescheduled valid recurrence for ${nextDate.toISOString()}`);
                }

                reminder.status = 'sent';
                await reminder.save();
                console.log(`Reminder ${reminder._id} marked as SENT.`);
            }

        } catch (error) {
            console.error('Scheduler Error:', error);
        }
        console.log('----------------------');
    });
};
