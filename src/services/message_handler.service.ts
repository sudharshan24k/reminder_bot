import { findOrCreateUser } from './user.service';
import { parseReminderIntent } from './nlp.service';
import { createReminder } from './reminder.service';
import { sendMessage } from './bot.service';

export const handleIncomingMessage = async (
    platform: 'whatsapp' | 'telegram',
    platformId: string,
    userName: string,
    text: string
) => {
    try {
        console.log(`Received message from ${userName} (${platform}): ${text}`);

        // 1. Get User
        const user = await findOrCreateUser(platform, platformId, userName);

        // 2. Parse Intent
        const nlpResult = await parseReminderIntent(text);

        if (!nlpResult || !nlpResult.isoDate) {
            if (text.toLowerCase().includes('hi') || text.toLowerCase().includes('start')) {
                await sendMessage(platform, platformId, "Namaste! 🙏 I can set reminders for you. Try saying 'Remind me tomorrow at 9am'.");
            } else {
                await sendMessage(platform, platformId, "I couldn't catch the time properly. Please try again (e.g., 'Kal subah 9 baje').");
            }
            return;
        }

        // 3. Create Reminder
        // MVP: Direct creation
        const scheduledAt = new Date(nlpResult.isoDate);
        const reminder = await createReminder(user._id, text, text, scheduledAt, nlpResult.recurrence);

        // 4. Confirm
        await sendMessage(platform, platformId, `✅ ${nlpResult.confirmationText || 'Reminder set successfully!'}`);

    } catch (error) {
        console.error('Handler Error:', error);
        await sendMessage(platform, platformId, "Sorry, I encountered an error.");
    }
};
