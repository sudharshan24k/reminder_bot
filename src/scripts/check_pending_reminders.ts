import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Check pending reminders in the database
 */
async function checkPendingReminders() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reminder_bot');
        console.log('✅ Connected to MongoDB\n');

        const now = new Date();
        console.log(`Current time: ${now.toISOString()} (${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST)\n`);

        // Get all pending reminders
        const allPending = await Reminder.find({ status: 'pending' }).sort({ scheduledAt: 1 });
        console.log(`Total pending reminders: ${allPending.length}\n`);

        if (allPending.length > 0) {
            console.log('Pending reminders:');
            allPending.forEach((reminder, index) => {
                const scheduledIST = new Date(reminder.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                const isPast = reminder.scheduledAt <= now;
                console.log(`${index + 1}. ${reminder.originalText || reminder.text}`);
                console.log(`   Scheduled: ${reminder.scheduledAt.toISOString()} (${scheduledIST} IST)`);
                console.log(`   Status: ${isPast ? '⚠️ OVERDUE' : '⏰ Future'}`);
                console.log(`   ID: ${reminder._id}\n`);
            });
        }

        // Get overdue reminders
        const overdue = await Reminder.find({
            status: 'pending',
            scheduledAt: { $lte: now }
        });

        if (overdue.length > 0) {
            console.log(`\n⚠️ ${overdue.length} reminder(s) are OVERDUE and should have been sent!`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Check complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkPendingReminders();
