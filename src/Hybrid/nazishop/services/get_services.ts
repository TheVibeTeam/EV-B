import logger from '../../../Utils/logger';
import ServiceModel from '../models/Service';

export default {
    name: 'Get Services',
    type: 'query',
    description: 'Get all services with optional filters',
    file: __filename,
    category: 'services',
    query: `services(category: ServiceCategory, isActive: Boolean, limit: Int, skip: Int): ServicesResponse!`,
    resolver: async (_: any, args: any) => {
        try {
            const { category, isActive, limit = 20, skip = 0 } = args;
            logger.info({ category, isActive, limit, skip }, 'Fetching services');
            const filter: any = {};
            if (category) filter.category = category;
            if (isActive !== undefined) filter.isActive = isActive;
            const servicesFromDB = await ServiceModel.find(filter).limit(limit).skip(skip).sort({ isFeatured: -1, createdAt: -1 });
            const total = await ServiceModel.countDocuments(filter);

            // Import InventoryModel dynamically to avoid circular dependencies if any
            const InventoryModel = require('../models/Inventory').default;

            const services = await Promise.all(servicesFromDB.map(async (service) => {
                const serviceObject = service.toObject();

                // Fetch inventory stats for this service
                // We use serviceId (custom ID) not _id because that's how inventory is linked
                const inventoryItems = await InventoryModel.find({
                    serviceId: serviceObject.serviceId,
                    isAvailable: true
                });

                logger.info({
                    serviceId: serviceObject.serviceId,
                    inventoryCount: inventoryItems.length
                }, 'Inventory check for service');

                let streamingPrices: number[] = serviceObject.streamingPrices || [];
                let streamingPlans: string[] = serviceObject.streamingPlans || [];
                let streamingDurations: string[] = serviceObject.streamingDurations || [];

                if (inventoryItems.length > 0) {
                    // Extract prices from inventory
                    const inventoryPrices = inventoryItems
                        .map((item: any) => item.price)
                        .filter((p: any) => p != null) as number[];

                    logger.info({ inventoryPrices }, 'Found inventory prices');

                    if (inventoryPrices.length > 0) {
                        streamingPrices = [...new Set([...streamingPrices, ...inventoryPrices])];
                    }

                    // Extract plans/counts
                    const inventoryPlans = inventoryItems
                        .map((item: any) => item.plan)
                        .filter((p: any) => p != null) as string[];

                    logger.info({ inventoryPlans }, 'Found inventory plans');

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

                return {
                    ...serviceObject,
                    id: (serviceObject._id as any).toString(),
                    createdAt: serviceObject.createdAt?.toISOString(),
                    updatedAt: serviceObject.updatedAt?.toISOString(),
                    streamingPrices,
                    streamingPlans,
                    streamingDurations
                };
            }));

            return { services, total };
        } catch (error: any) {
            logger.error({ error: error.message }, 'Error fetching services');
            throw new Error(error.message || 'Error al obtener servicios');
        }
    }
};
