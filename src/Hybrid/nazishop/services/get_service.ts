import logger from '../../../Utils/logger';
import ServiceModel from '../models/Service';
import InventoryModel from '../../../Models/Inventory';

export default {
    name: 'Get Service By ID',
    type: 'query',
    description: 'Get a single service by ID',
    file: __filename,
    category: 'services',
    query: `service(serviceId: String!): Service`,
    resolver: async (_: any, args: any) => {
        try {
            const { serviceId } = args;
            console.log(`[DEBUG] get_service resolver called with serviceId: ${serviceId}`);
            logger.info({ serviceId }, 'Fetching service by ID');

            let service = await ServiceModel.findOne({ serviceId, isActive: true });

            // Fallback: try finding by _id if not found by serviceId
            if (!service && serviceId.match(/^[0-9a-fA-F]{24}$/)) {
                service = await ServiceModel.findOne({ _id: serviceId, isActive: true });
            }

            if (!service) throw new Error('Servicio no encontrado');

            const serviceObject = service.toObject();

            // Fetch inventory stats for this service
            const inventoryItems = await InventoryModel.find({
                serviceId: serviceObject.serviceId,
                isAvailable: true
            });

            logger.info({
                serviceId: serviceObject.serviceId,
                inventoryCount: inventoryItems.length
            }, 'Inventory check for single service');

            let streamingPrices: number[] = serviceObject.streamingPrices || [];
            let streamingPlans: string[] = serviceObject.streamingPlans || [];
            let streamingDurations: string[] = serviceObject.streamingDurations || [];

            if (inventoryItems.length > 0) {
                // Extract prices from inventory
                const inventoryPrices = inventoryItems
                    .map((item: any) => item.price)
                    .filter((p: any) => p != null) as number[];

                if (inventoryPrices.length > 0) {
                    streamingPrices = [...new Set([...streamingPrices, ...inventoryPrices])];
                }

                // Extract plans/counts
                const inventoryPlans = inventoryItems
                    .map((item: any) => item.plan)
                    .filter((p: any) => p != null) as string[];

                if (inventoryPlans.length > 0) {
                    streamingPlans = [...new Set([...streamingPlans, ...inventoryPlans])];
                } else if (streamingPlans.length === 0) {
                    // If no named plans but items exist, add a generic one so the UI shows "X Cuentas"
                    streamingPlans = Array(inventoryItems.length).fill('Cuenta');
                }

                // Extract durations from inventory
                const inventoryDurations = inventoryItems
                    .map((item: any) => item.duration)
                    .filter((d: any) => d != null) as string[];

                logger.info({ inventoryDurations }, 'Found inventory durations');

                if (inventoryDurations.length > 0) {
                    streamingDurations = [...new Set([...streamingDurations, ...inventoryDurations])];
                } else if (streamingDurations.length === 0 && inventoryItems.length > 0) {
                    // If no durations specified but items exist, default to '1 Mes'
                    streamingDurations = Array(inventoryItems.length).fill('1 Mes');
                }
            }

            const result = {
                ...serviceObject,
                id: (serviceObject._id as any).toString(),
                createdAt: serviceObject.createdAt?.toISOString(),
                updatedAt: serviceObject.updatedAt?.toISOString(),
                streamingPrices,
                streamingPlans,
                streamingDurations
            };

            console.log('[DEBUG] Returning service with:', {
                name: result.name,
                serviceId: result.serviceId,
                inventoryCount: inventoryItems.length,
                streamingPlans: result.streamingPlans,
                streamingDurations: result.streamingDurations,
                streamingPrices: result.streamingPrices
            });

            return result;
        } catch (error: any) {
            logger.error({ error: error.message }, 'Error fetching service');
            throw new Error(error.message || 'Error al obtener servicio');
        }
    }
};
