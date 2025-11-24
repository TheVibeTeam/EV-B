import logger from '../../../Utils/logger';
import ServiceModel from '../models/Service';

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
            logger.info({ serviceId }, 'Fetching service by ID');
            
            let service = await ServiceModel.findOne({ serviceId, isActive: true });
            
            // Fallback: try finding by _id if not found by serviceId
            if (!service && serviceId.match(/^[0-9a-fA-F]{24}$/)) {
                service = await ServiceModel.findOne({ _id: serviceId, isActive: true });
            }

            if (!service) throw new Error('Servicio no encontrado');
            
            const serviceObject = service.toObject();
            return {
                ...serviceObject,
                id: (serviceObject._id as any).toString(),
                createdAt: serviceObject.createdAt?.toISOString(),
                updatedAt: serviceObject.updatedAt?.toISOString(),
            };
        } catch (error: any) {
            logger.error({ error: error.message }, 'Error fetching service');
            throw new Error(error.message || 'Error al obtener servicio');
        }
    }
};
