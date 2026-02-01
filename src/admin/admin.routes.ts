import { Router } from 'express';
import { getDashboardStats, getUsers, getReminders, getSystemLogs, toggleUserBan, updateUserLimit } from './admin.controller';
import { requireAdminAuth } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to ALL admin routes
router.use(requireAdminAuth);

// Admin API Routes (all protected)
router.get('/api/admin/stats', getDashboardStats);
router.get('/api/admin/users', getUsers);
router.get('/api/admin/reminders', getReminders);
router.get('/api/admin/logs', getSystemLogs);
router.post('/api/admin/users/:id/ban', toggleUserBan);
router.post('/api/admin/users/:id/limit', updateUserLimit);

export default router;
