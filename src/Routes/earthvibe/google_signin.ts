import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../Models/User';

export default {
    name: 'Google Sign In',
    path: '/google-signin',
    method: 'post',
    category: 'earthvibe',
    example: {},
    parameter: ['email', 'name', 'googleId'],
    premium: false,
    error: false,
    logger: true,
    execution: async (req: Request, res: Response) => {
        try {
            const { email, name, googleId, profilePicture } = req.body;

            if (!email || !name || !googleId) {
                return res.status(400).json({
                    status: false,
                    msg: 'Email, nombre y Google ID son requeridos'
                });
            }

            // Buscar usuario por email o por googleId
            let user = await User.findOne({ 
                $or: [
                    { email: email.toLowerCase() },
                    { googleId }
                ]
            });

            if (user) {
                // Usuario existe, actualizar googleId si no lo tiene
                if (!user.googleId) {
                    user.googleId = googleId;
                    await user.save();
                }
            } else {
                // Crear nuevo usuario
                // Generar username único basado en el email
                let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
                
                // Verificar que el username sea único
                let usernameExists = await User.findOne({ username });
                let counter = 1;
                while (usernameExists) {
                    username = `${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}${counter}`;
                    usernameExists = await User.findOne({ username });
                    counter++;
                }

                // Generar contraseña aleatoria (no se usará, pero es requerida)
                const randomPassword = bcrypt.hashSync(Math.random().toString(36).slice(-8), 10);

                user = new User({
                    email: email.toLowerCase(),
                    password: randomPassword,
                    username,
                    name,
                    googleId,
                    profilePicture: profilePicture || undefined,
                    university: 'Por definir',
                    faculty: 'Por definir',
                    verified: true, // Auto-verificar usuarios de Google
                    role: 'user'
                });

                await user.save();
            }

            // Generar token JWT
            const token = jwt.sign(
                { 
                    id: user._id,
                    email: user.email,
                    role: user.role 
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '30d' }
            );

            // Preparar respuesta
            const userData = {
                id: user._id,
                email: user.email,
                username: user.username,
                name: user.name,
                bio: user.bio,
                profilePicture: user.profilePicture,
                university: user.university,
                faculty: user.faculty,
                verified: user.verified,
                role: user.role,
                points: user.points,
                totalScans: user.totalScans,
                totalPosts: user.posts?.length || 0,
                createdAt: user.createdAt,
                posts: user.posts
            };

            res.json({
                status: true,
                msg: user.googleId === googleId && user.email === email.toLowerCase() 
                    ? 'Inicio de sesión exitoso' 
                    : 'Usuario creado exitosamente',
                data: {
                    token,
                    user: userData
                }
            });

        } catch (error: any) {
            console.error('Error en Google Sign In:', error);
            res.status(500).json({
                status: false,
                msg: 'Error al procesar la autenticación con Google',
                error: error.message
            });
        }
    }
};
