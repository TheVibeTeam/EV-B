import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export const requireAuth = (resolver: any) => {
    return async (parent: any, args: any, context: any, info: any) => {
        const token = context.token;
        if (!token) {
            throw new Error('No autenticado');
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            context.user = {
                id: decoded.userId,
                email: decoded.email,
                role: decoded.role || 'USER'
            };
            return resolver(parent, args, context, info);
        } catch (error) {
            throw new Error('Token inválido o expirado');
        }
    };
};

export const requireAdmin = (resolver: any) => {
    return requireAuth(async (parent: any, args: any, context: any, info: any) => {
        if (context.user.role !== 'ADMIN') {
            throw new Error('Requiere permisos de administrador');
        }
        return resolver(parent, args, context, info);
    });
};
