import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  platform: String,
  platformId: String,
  name: String,

  // ✅ NEW
  timezone: {
    type: String,
    default: null, // e.g. "Asia/Kolkata"
  },
});

export default mongoose.model('User', UserSchema);
