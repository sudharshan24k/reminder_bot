import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db';
import { verifyWhatsapp, handleWhatsappEvent } from './controllers/webhook.controller';
import { telegramBot } from './services/bot.service';
import { handleIncomingMessage } from './services/message_handler.service';
import { initScheduler } from './services/scheduler.service';
import { getDashboardStats } from './controllers/admin.controller';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to Database
connectDB();

// Initialize Scheduler
initScheduler();

// Static + Admin
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/api/admin/stats', getDashboardStats);

// Reminder routes
import {
  createReminderController,
  confirmReminderController,
  fetchDueRemindersController,
  createVoiceReminderController
} from './controllers/reminder.controller';

app.post('/api/reminders', createReminderController as any);
app.post('/api/reminders/voice', createVoiceReminderController as any);
app.get('/api/reminders/due', fetchDueRemindersController as any);
app.get('/api/reminders/:id/confirm', confirmReminderController as any);

// WhatsApp Webhooks
app.get('/webhooks/whatsapp', verifyWhatsapp);
app.post('/webhooks/whatsapp', handleWhatsappEvent);

// Telegram Bot (Polling)
if (
  process.env.TELEGRAM_BOT_TOKEN &&
  process.env.TELEGRAM_BOT_TOKEN !== 'dummy_token' &&
  process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token'
) {
  telegramBot.launch()
    .then(() => console.log('Telegram Bot launched'))
    .catch(err => console.error('Telegram Bot Launch Error:', err));

  // 📩 TEXT MESSAGES
  telegramBot.on('text', (ctx) => {
    const userId = ctx.from.id.toString();
    const userName = ctx.from.first_name || 'User';
    const text = ctx.message.text;
    const messageTimestamp = ctx.message.date; // ✅ UNIX timestamp (seconds)

    handleIncomingMessage(
      'telegram',
      userId,
      userName,
      text,
      messageTimestamp
    );
  });

  // 🎧 VOICE MESSAGES
  telegramBot.on('voice', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userName = ctx.from.first_name || 'User';
    const messageTimestamp = ctx.message.date; // ✅ SAME FIX FOR VOICE

    try {
      const fileId = ctx.message.voice.file_id;
      const fileUrl = await ctx.telegram.getFileLink(fileId);

      await ctx.reply('🎧 Processing your voice message...');

      const { transcribeAudio } = await import('./services/voice.service');
      const text = await transcribeAudio(fileUrl.toString(), 'telegram');

      if (text) {
        await ctx.reply(`🗣 I heard: "${text}"`);

        handleIncomingMessage(
          'telegram',
          userId,
          userName,
          text,
          messageTimestamp
        );
      } else {
        await ctx.reply("Sorry, I couldn't understand the audio.");
      }
    } catch (error) {
      console.error('Telegram Voice Error:', error);
      await ctx.reply('Error processing voice message.');
    }
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    try {
      // Stop Telegram bot
      await telegramBot.stop(signal);
      console.log('✅ Telegram bot stopped');

      // Close Express server
      server.close(() => {
        console.log('✅ Express server closed');
      });

      // Close MongoDB connection
      const mongoose = await import('mongoose');
      await mongoose.default.disconnect();
      console.log('✅ MongoDB disconnected');

      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
} else {
  console.log('Telegram Token not set, skipping bot launch.');
}

// Start server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
