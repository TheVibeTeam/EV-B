import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import UserModel from '../../Models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export default {
    name: 'Scan Bottle',
    path: '/earthvibe/scan-bottle',
    method: 'post',
    category: 'earthvibe',
    example: { 
        userId: '507f1f77bcf86cd799439011',
        bottles: [
            {
                barcode: '7501055363322',
                productName: 'Agua Cielo',
                brand: 'Aje',
                quantity: '500ml',
                points: 10
            },
            {
                barcode: '7501055363323',
                productName: 'Coca-Cola',
                brand: 'Coca-Cola Company',
                quantity: '600ml',
                points: 10
            }
        ]
    },
    parameter: ['userId', 'bottles'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                status: false, 
                msg: 'Token de autenticación no proporcionado' 
            });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            (req as any).user = decoded;
        } catch (error) {
            return res.status(401).json({ 
                status: false, 
                msg: 'Token inválido o expirado' 
            });
        }

        const { userId, bottles } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                status: false, 
                msg: 'userId es requerido' 
            });
        }

        const authenticatedUserId = (req as any).user.userId;
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                status: false,
                msg: 'No tienes permiso para registrar botellas a otro usuario'
            });
        }

        if (!bottles) {
            return res.status(400).json({ 
                status: false, 
                msg: 'bottles es requerido. Asegúrate de parsear correctamente el QR' 
            });
        }

        if (!Array.isArray(bottles)) {
            return res.status(400).json({ 
                status: false, 
                msg: 'bottles debe ser un array. El QR escaneado no tiene el formato correcto' 
            });
        }

        if (bottles.length === 0) {
            return res.status(400).json({ 
                status: false, 
                msg: 'bottles está vacío' 
            });
        }

        for (let i = 0; i < bottles.length; i++) {
            const bottle = bottles[i];
            if (!bottle.barcode || !bottle.productName || !bottle.brand || !bottle.quantity || typeof bottle.points !== 'number') {
                return res.status(400).json({
                    status: false,
                    msg: `Botella en posición ${i} no tiene el formato correcto. Campos requeridos: barcode, productName, brand, quantity, points`
                });
            }
        }

        next();
    },
    execution: async (req: Request, res: Response) => {
        try {
            const { userId, bottles } = req.body;

            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({
                    status: false,
                    msg: 'Usuario no encontrado'
                });
            }

            const skipped: string[] = [];
            const added: any[] = [];
            let total = 0;

            for (const bottle of bottles) {
                const exists = user.scannedProducts.find(
                    p => p.barcode === bottle.barcode
                );

                if (exists) {
                    skipped.push(bottle.barcode);
                    continue;
                }

                const item = {
                    barcode: bottle.barcode,
                    productName: bottle.productName,
                    brand: bottle.brand,
                    quantity: bottle.quantity,
                    points: bottle.points,
                    scannedAt: new Date()
                };

                user.scannedProducts.push(item);
                added.push(item);
                total += bottle.points;
            }

            user.points += total;
            await user.save();

            res.json({
                status: true,
                msg: `${added.length} botella(s) registrada(s) exitosamente`,
                added: added.length,
                skipped: skipped.length,
                barcodes: skipped,
                points: total,
                total: user.points,
                recycled: user.scannedProducts.length
            });
        } catch (error: any) {
            res.status(500).json({
                status: false,
                msg: 'Error al registrar botellas',
                error: error.message
            });
        }
    }
};
