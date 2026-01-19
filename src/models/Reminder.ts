import mongoose, { Schema, Document } from 'mongoose';

export interface IReminder extends Document {
    user: mongoose.Types.ObjectId;
    text: string;
    originalText: string;
    scheduledAt: Date;
    status: 'pending' | 'sent' | 'failed';
    recurrence?: {
        type: 'daily' | 'weekly' | 'interval';
        intervalValue?: number;
    };
    createdAt: Date;
}

const ReminderSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    originalText: { type: String },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    recurrence: {
        type: { type: String, enum: ['daily', 'weekly', 'interval'] },
        intervalValue: { type: Number }
    },
    createdAt: { type: Date, default: Date.now }
});

// Index for efficient scheduler polling
ReminderSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
