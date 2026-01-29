import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Delete ALL reminders from the database
 * Use this to start fresh
 */
async function deleteAllReminders() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reminder_bot');
        console.log('✅ Connected to MongoDB');

        // Count total reminders
        const totalCount = await Reminder.countDocuments();
        console.log(`\nTotal reminders in database: ${totalCount}`);

        if (totalCount === 0) {
            console.log('No reminders to delete.');
            await mongoose.disconnect();
            process.exit(0);
        }

        // Show breakdown by status
        const pending = await Reminder.countDocuments({ status: 'pending' });
        const sent = await Reminder.countDocuments({ status: 'sent' });
        const failed = await Reminder.countDocuments({ status: 'failed' });

        console.log(`\nBreakdown:`);
        console.log(`  - Pending: ${pending}`);
        console.log(`  - Sent: ${sent}`);
        console.log(`  - Failed: ${failed}`);

        // Delete all reminders
        const result = await Reminder.deleteMany({});
        console.log(`\n✅ Deleted ${result.deletedCount} reminders`);

        await mongoose.disconnect();
        console.log('✅ Database cleaned successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

deleteAllReminders();
