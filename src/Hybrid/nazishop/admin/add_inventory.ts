import logger from '../../../Utils/logger';
import InventoryModel from '../../../Models/Inventory';

export default {
    name: 'Add Inventory',
    type: 'mutation',
    description: 'Add new inventory item',
    file: __filename,
    category: 'admin',
    requireAuth: true,
    requireAdmin: true,
    mutation: `addInventory(serviceId: String!, email: String!, password: String!, pin: String, profiles: String, expiryDate: DateTime): AddInventoryResponse!`,
    resolver: async (_: any, args: any, context: any) => {
        try {
            if (!context.user || context.user.role !== 'ADMIN') {
                throw new Error('Acceso denegado. Solo administradores.');
            }

            const { serviceId, email, password, pin, profiles, expiryDate } = args;
            logger.info({ serviceId, email }, 'Admin adding inventory');

            const newItem = new InventoryModel({
                serviceId,
                email,
                password,
                pin,
                profiles,
                expiryDate,
                isAvailable: true
            });

            await newItem.save();

            return {
                success: true,
                message: 'Inventario agregado correctamente',
                item: newItem
            };
        } catch (error: any) {
            logger.error({ error: error.message }, 'Error adding inventory');
            return {
                success: false,
                message: error.message || 'Error al agregar inventario',
                item: null
            };
        }
    }
};
