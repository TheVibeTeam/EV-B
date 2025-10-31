import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import NotificationModel from '../../Models/Notification';
import UserModel from '../../Models/User';
import { sendPushToAll, sendPushToMultipleUsers } from '../../Utils/firebase-push';
import logger from '../../Utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default {
    name: 'Send Notification',
    path: '/earthvibe/admin/notifications/send',
    method: 'post',
    category: 'earthvibe',
    example: {},
    parameter: [],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                status: false, 
                msg: 'Token no proporcionado' 
            });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            
            // Verificar que sea admin o superadmin
            if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
                return res.status(403).json({
                    status: false,
                    msg: 'Acceso denegado. Se requieren permisos de administrador.'
                });
            }

            (req as any).user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ 
                status: false, 
                msg: 'Token inválido o expirado' 
            });
        }
    },
    execution: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const {
                title,
                message,
                type = 'general',
                priority = 'medium',
                recipients = 'all',
                specificUserIds,
                expiresInDays
            } = req.body;

            // Validaciones
            if (!title || !message) {
                return res.status(400).json({
                    status: false,
                    msg: 'Título y mensaje son requeridos'
                });
            }

            if (title.length > 100) {
                return res.status(400).json({
                    status: false,
                    msg: 'El título no puede exceder 100 caracteres'
                });
            }

            if (message.length > 500) {
                return res.status(400).json({
                    status: false,
                    msg: 'El mensaje no puede exceder 500 caracteres'
                });
            }

            // Obtener datos del admin que envía
            const admin = await UserModel.findById(user.userId);
            if (!admin) {
                return res.status(404).json({
                    status: false,
                    msg: 'Administrador no encontrado'
                });
            }

            // Calcular fecha de expiración si se especificó
            let expiresAt = undefined;
            if (expiresInDays && expiresInDays > 0) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + expiresInDays);
            }

            // Crear la notificación
            const notification = new NotificationModel({
                title,
                message,
                type,
                priority,
                sentBy: admin._id,
                sentByName: admin.name,
                recipients,
                specificUsers: recipients === 'specific' ? specificUserIds : undefined,
                expiresAt
            });

            await notification.save();

            // Contar destinatarios
            let recipientCount = 0;
            if (recipients === 'all') {
                recipientCount = await UserModel.countDocuments();
            } else if (recipients === 'verified') {
                recipientCount = await UserModel.countDocuments({ verified: true });
            } else if (recipients === 'specific' && specificUserIds) {
                recipientCount = specificUserIds.length;
            }

            // Enviar notificaciones push
            let pushStats = { success: 0, failed: 0 };
            try {
                if (recipients === 'all') {
                    pushStats = await sendPushToAll({
                        title,
                        message,
                        type,
                        priority
                    }, 'all');
                } else if (recipients === 'verified') {
                    pushStats = await sendPushToAll({
                        title,
                        message,
                        type,
                        priority
                    }, 'verified');
                } else if (recipients === 'specific' && specificUserIds) {
                    pushStats = await sendPushToMultipleUsers(specificUserIds, {
                        title,
                        message,
                        type,
                        priority
                    });
                }
                logger.info(`Push notifications enviadas: ${pushStats.success} exitosas, ${pushStats.failed} fallidas`);
            } catch (pushError) {
                logger.error('Error enviando push notifications:', pushError);
            }

            res.json({
                status: true,
                msg: 'Notificación enviada correctamente',
                data: {
                    id: notification._id,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    priority: notification.priority,
                    recipients: notification.recipients,
                    recipientCount,
                    sentBy: notification.sentByName,
                    createdAt: notification.createdAt,
                    expiresAt: notification.expiresAt,
                    pushNotifications: {
                        sent: pushStats.success,
                        failed: pushStats.failed
                    }
                }
            });
        } catch (error) {
            logger.error('Error enviando notificación:', error);
            res.status(500).json({
                status: false,
                msg: 'Error en el servidor',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
};
