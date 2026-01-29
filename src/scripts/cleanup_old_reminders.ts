import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cleanup script to remove old pending reminders
 * This will mark all pending reminders older than 7 days as 'failed'
 */
async function cleanupOldReminders() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reminder_bot');
        console.log('✅ Connected to MongoDB');

        // Calculate cutoff date (7 days ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        console.log(`\nCleaning up reminders older than: ${cutoffDate.toISOString()}`);

        // Find old pending reminders
        const oldReminders = await Reminder.find({
            status: 'pending',
            scheduledAt: { $lt: cutoffDate }
        });

        console.log(`Found ${oldReminders.length} old pending reminders`);

        if (oldReminders.length > 0) {
            // Mark them as failed
            const result = await Reminder.updateMany(
                {
                    status: 'pending',
                    scheduledAt: { $lt: cutoffDate }
                },
                {
                    status: 'failed'
                }
            );

            console.log(`✅ Marked ${result.modifiedCount} old reminders as 'failed'`);
        }

        // Optional: Delete all old reminders completely (uncomment if you want to delete instead of marking as failed)
        // const deleteResult = await Reminder.deleteMany({
        //   scheduledAt: { $lt: cutoffDate }
        // });
        // console.log(`✅ Deleted ${deleteResult.deletedCount} old reminders`);

        await mongoose.disconnect();
        console.log('\n✅ Cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

cleanupOldReminders();
