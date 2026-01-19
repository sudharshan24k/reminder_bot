import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    platform: 'whatsapp' | 'telegram';
    platformId: string;
    name?: string;
    language: string;
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    platform: { type: String, required: true, enum: ['whatsapp', 'telegram'] },
    platformId: { type: String, required: true },
    name: { type: String },
    language: { type: String, default: 'en' },
    createdAt: { type: Date, default: Date.now }
});

// Compound index to ensure unique user per platform
UserSchema.index({ platform: 1, platformId: 1 }, { unique: true });

export default mongoose.model<IUser>('User', UserSchema);
