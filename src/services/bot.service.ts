import axios from 'axios';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

// Telegram
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
export const telegramBot = new Telegraf(telegramBotToken || 'dummy_token');

// WhatsApp
const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

export const sendMessage = async (platform: 'whatsapp' | 'telegram', platformId: string, text: string) => {
    if (platform === 'telegram') {
        try {
            if (!telegramBotToken) {
                console.warn('Telegram token not set, skipping message');
                return;
            }
            await telegramBot.telegram.sendMessage(platformId, text);
        } catch (error) {
            console.error('Error sending Telegram message:', error);
            // Don't throw for now to prevent crashing scheduler loop
        }
    } else if (platform === 'whatsapp') {
        try {
            await axios.post(
                `https://graph.facebook.com/v17.0/${whatsappPhoneId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: platformId,
                    type: 'text',
                    text: { body: text },
                },
                {
                    headers: {
                        Authorization: `Bearer ${whatsappToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } catch (error: any) {
            console.error('Error sending WhatsApp message:', error.response?.data || error.message);
        }
    }
};

export const getWhatsappMediaUrl = async (mediaId: string): Promise<string | null> => {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/v17.0/${mediaId}`,
            {
                headers: { Authorization: `Bearer ${whatsappToken}` }
            }
        );
        return response.data.url;
    } catch (error) {
        console.error('Error fetching WhatsApp media URL:', error);
        return null;
    }
};
