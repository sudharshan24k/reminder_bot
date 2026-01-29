import Groq from "groq-sdk";
import { DateTime } from "luxon";

export async function parseWithGroq(text: string, referenceDate: Date = new Date()) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  // Get current time in both UTC and IST for context
  const nowUTC = DateTime.fromJSDate(referenceDate, { zone: 'utc' });
  const nowIST = nowUTC.setZone('Asia/Kolkata');

  const prompt = `
You are a backend JSON API for parsing reminder requests.

CURRENT TIME CONTEXT:
- UTC: ${nowUTC.toISO()}
- IST (Asia/Kolkata): ${nowIST.toISO()} (${nowIST.toFormat('dd MMM yyyy, HH:mm')} in 24-hour format)
- Default timezone: Asia/Kolkata (IST, UTC+5:30)

IMPORTANT RULES:
- Return ONLY valid JSON
- Do NOT include explanations, markdown, or text before/after JSON
- JSON must start with { and end with }
- All times in user input should be interpreted as IST unless explicitly stated otherwise
- Output isoDate must be in UTC ISO8601 format
- CRITICAL: Support both 12-hour (with AM/PM) and 24-hour time formats
  * If user says "20:05" or "20:05 today", interpret as 8:05 PM IST (20:05 in 24-hour format)
  * If user says "8:05 PM" or "8:05 pm", interpret as 8:05 PM IST
  * If user says "8:05" without AM/PM, interpret based on context (morning/evening)
  * Times from 00:00 to 23:59 are 24-hour format
  * Times with AM/PM are 12-hour format
- For recurring reminders (daily, weekly, monthly, every X days), set recurrence.type accordingly
- For "daily" or "every day", use recurrence.type = "daily"
- For "weekly" or "every week", use recurrence.type = "weekly"
- For "every X days", use recurrence.type = "interval" and set intervalValue = X

Schema:
{
  "intent": "create_reminder",
  "confidence": number,
  "isoDate": string (UTC ISO8601),
  "recurrence": null | {
    "type": "daily" | "weekly" | "interval",
    "intervalValue"?: number
  },
  "confirmationText": string
}

User Message:
"${text}"
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0].message.content!.trim();

  // Extract JSON safely
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Groq NLP did not return valid JSON");
  }

  return JSON.parse(jsonMatch[0]);

}
