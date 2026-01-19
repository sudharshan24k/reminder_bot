import { Request, Response } from 'express';
import User from '../models/User';
import Reminder from '../models/Reminder';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalReminders = await Reminder.countDocuments();
        const pendingReminders = await Reminder.countDocuments({ status: 'pending' });

        res.json({
            totalUsers,
            totalReminders,
            pendingReminders
        });
    } catch (error) {
        console.error('Admin Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};
