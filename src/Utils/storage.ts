import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { Storage as GCStorage } from '@google-cloud/storage';
import logger from './logger';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);
const readdir = promisify(fs.readdir);

const STORAGE_DIR = path.join(process.cwd(), 'Storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const ABSOLUTE_STORAGE_DIR = path.resolve(STORAGE_DIR);
const CATEGORIES = ['images', 'videos', 'documents'];

// Google Cloud Storage config
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_CLOUD_RUN = process.env.K_SERVICE !== undefined;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'auralix-uploads';
const GCS_PROJECT_ID = process.env.GCP_PROJECT_ID || 'pro-platform-470721-v2';

let gcsStorage: GCStorage | null = null;
let gcsBucket: any = null;

interface UploadOptions {
    userId: string;
    category?: 'images' | 'videos' | 'documents';
    originalName?: string;
}

interface UploadBufferOptions extends UploadOptions {
    mimeType?: string;
    extension?: string;
}

interface UploadResponse {
    url: string;
    filename: string;
    path: string;
}

interface StorageStats {
    totalFiles: number;
    categories: Record<string, number>;
}

/**
 * @class StorageService
 * @summary Gestiona el almacenamiento de archivos usando Google Cloud Storage en producción
 * y filesystem local en desarrollo.
 */
export default class Storage {

    /**
     * @summary Inicializa el storage (GCS en producción, filesystem en desarrollo).
     */
    static async init(): Promise<void> {
        try {
            if (IS_PRODUCTION || IS_CLOUD_RUN) {
                // Inicializar Google Cloud Storage
                gcsStorage = new GCStorage({
                    projectId: GCS_PROJECT_ID
                });
                gcsBucket = gcsStorage.bucket(GCS_BUCKET_NAME);
                
                // Verificar que el bucket existe
                const [exists] = await gcsBucket.exists();
                if (!exists) {
                    logger.warn(`GCS bucket ${GCS_BUCKET_NAME} does not exist, creating...`);
                    await gcsStorage.createBucket(GCS_BUCKET_NAME, {
                        location: 'US',
                        storageClass: 'STANDARD'
                    });
                    logger.info(`GCS bucket ${GCS_BUCKET_NAME} created`);
                }
                
                logger.info(`Google Cloud Storage initialized with bucket: ${GCS_BUCKET_NAME}`);
            } else {
                // Desarrollo: usar filesystem local
                const dirsToCreate = [
                    STORAGE_DIR,
                    UPLOADS_DIR,
                    ...CATEGORIES.map(cat => path.join(UPLOADS_DIR, cat))
                ];
                
                await Promise.all(
                    dirsToCreate.map(dir => mkdir(dir, { recursive: true }))
                );
                
                logger.info('Local storage directories initialized');
            }
        } catch (error) {
            logger.error('Failed to initialize storage:', error);
            throw error;
        }
    }

    /**
     * @summary Guarda un buffer usando GCS en producción o filesystem en desarrollo.
     * @private
     */
    private static async _saveFile(
        buffer: Buffer,
        userId: string,
        category: string,
        extension: string
    ): Promise<UploadResponse> {
        const filename = `${userId}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${extension}`;
        const filePath = `${category}/${filename}`;

        if (IS_PRODUCTION || IS_CLOUD_RUN) {
            // Subir a Google Cloud Storage
            if (!gcsBucket) {
                throw new Error('GCS bucket not initialized');
            }

            const file = gcsBucket.file(filePath);
            await file.save(buffer, {
                metadata: {
                    contentType: this.getMimeType(extension),
                    cacheControl: 'public, max-age=31536000'
                }
            });

            // Hacer el archivo público
            await file.makePublic();

            const url = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filePath}`;
            logger.info(`File uploaded to GCS: ${url}`);
            return { url, filename, path: filePath };
        } else {
            // Desarrollo: guardar en filesystem local
            const categoryDir = path.join(UPLOADS_DIR, category);
            const localFilePath = path.join(categoryDir, filename);

            await writeFile(localFilePath, buffer);

            const url = `/uploads/${category}/${filename}`;
            logger.info(`File uploaded locally: ${url}`);
            return { url, filename, path: localFilePath };
        }
    }

    /**
     * @summary Sube un archivo a partir de un string base64.
     * @param {string} base64Data - El string de datos base64 (con o sin prefijo data:mime).
     * @param {UploadOptions} options - Opciones de subida, como el userId.
     * @returns {Promise<UploadResponse>} La URL pública y la ruta del archivo.
     */
    static async uploadBase64(
        base64Data: string,
        options: UploadOptions
    ): Promise<UploadResponse> {
        try {
            const { userId, category = 'images' } = options;
            const base64String = base64Data.replace(/^data:.*;base64,/, '');
            const buffer = Buffer.from(base64String, 'base64');
            const ext = this.getExtensionFromMime(base64Data) || 'bin';
            
            return this._saveFile(buffer, userId, category, ext);
        } catch (error) {
            logger.error('Upload base64 error:', error);
            throw new Error('Failed to upload file');
        }
    }

    /**
     * @summary Sube un archivo a partir de un Buffer.
     * @param {Buffer} buffer - El buffer del archivo.
     * @param {UploadBufferOptions} options - Opciones de subida, como userId y extensión.
     * @returns {Promise<UploadResponse>} La URL pública y la ruta del archivo.
     */
    static async uploadBuffer(
        buffer: Buffer,
        options: UploadBufferOptions
    ): Promise<UploadResponse> {
        try {
            const { userId, category = 'images', extension = 'bin' } = options;
            return this._saveFile(buffer, userId, category, extension);
        } catch (error) {
            logger.error('Upload buffer error:', error);
            throw new Error('Failed to upload file');
        }
    }

    /**
     * @summary Elimina un archivo (GCS en producción, filesystem en desarrollo).
     * @param {string} fileUrl - La URL del archivo a eliminar.
     * @returns {Promise<boolean>} True si se eliminó, false si no se encontró o hubo un error.
     */
    static async deleteFile(fileUrl: string): Promise<boolean> {
        try {
            if (IS_PRODUCTION || IS_CLOUD_RUN) {
                // Eliminar de GCS
                if (!gcsBucket) {
                    throw new Error('GCS bucket not initialized');
                }

                // Extraer el path del archivo de la URL de GCS
                const gcsPath = fileUrl.replace(`https://storage.googleapis.com/${GCS_BUCKET_NAME}/`, '');
                const file = gcsBucket.file(gcsPath);
                await file.delete();
                logger.info(`File deleted from GCS: ${gcsPath}`);
                return true;
            } else {
                // Desarrollo: eliminar del filesystem local
                const filePath = this.getFilePath(fileUrl);
                await unlink(filePath);
                logger.info(`File deleted locally: ${fileUrl}`);
                return true;
            }
        } catch (error: any) {
            if (error.code === 'ENOENT' || error.code === 404 || error.message === 'Invalid file path') {
                logger.warn(`File not found, could not delete: ${fileUrl}`);
            } else {
                logger.error('Delete file error:', error);
            }
            return false;
        }
    }

    /**
     * @summary Obtiene la ruta absoluta segura de un archivo a partir de su URL.
     * @param {string} fileUrl - La URL relativa (ej. /uploads/images/file.jpg).
     * @returns {string} La ruta absoluta en el sistema de ficheros.
     * @throws {Error} Si la ruta es inválida o intenta un Path Traversal.
     */
    static getFilePath(fileUrl: string): string {
        const urlPath = fileUrl.replace(/^\//, '');
        const absoluteFilePath = path.resolve(ABSOLUTE_STORAGE_DIR, urlPath);

        if (
            !absoluteFilePath.startsWith(ABSOLUTE_STORAGE_DIR) ||
            urlPath.includes('\0') || 
            urlPath.includes('..')
        ) {
            throw new Error('Invalid file path');
        }
        return absoluteFilePath;
    }

    /**
     * @summary Comprueba si un archivo existe en el almacenamiento.
     * @param {string} fileUrl - La URL relativa (ej. /uploads/images/file.jpg).
     * @returns {Promise<boolean>} True si el archivo existe.
     */
    static async fileExists(fileUrl: string): Promise<boolean> {
        try {
            const filePath = this.getFilePath(fileUrl);
            await access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @summary Obtiene estadísticas de los archivos almacenados.
     * @returns {Promise<StorageStats>} Un objeto con el total de archivos y el conteo por categoría.
     */
    static async getStorageStats(): Promise<StorageStats> {
        try {
            const stats: Record<string, number> = {};
            
            const categoryCounts = await Promise.all(
                CATEGORIES.map(async (category) => {
                    const categoryDir = path.join(UPLOADS_DIR, category);
                    try {
                        const files = await readdir(categoryDir);
                        return { name: category, count: files.length };
                    } catch (error: any) {
                        if (error.code !== 'ENOENT') {
                            logger.warn(`Could not read dir ${category}: ${error.message}`);
                        }
                        return { name: category, count: 0 };
                    }
                })
            );

            let totalFiles = 0;
            for (const item of categoryCounts) {
                stats[item.name] = item.count;
                totalFiles += item.count;
            }

            return { totalFiles, categories: stats };
        } catch (error) {
            logger.error('Get storage stats error:', error);
            return { totalFiles: 0, categories: {} };
        }
    }

    /**
     * @summary Obtiene el MIME type de una extensión de archivo.
     * @private
     */
    private static getMimeType(extension: string): string {
        const mimeMap: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'pdf': 'application/pdf',
            'txt': 'text/plain'
        };

        return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * @summary Extrae la extensión de archivo de un MimeType en un string base64.
     * @private
     */
    private static getExtensionFromMime(dataUrl: string): string | null {
        const match = dataUrl.match(/^data:([^;]+);/);
        if (!match) return null;

        const mime = match[1];
        const mimeMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/ogg': 'ogg',
            'application/pdf': 'pdf',
            'text/plain': 'txt'
        };

        return mimeMap[mime] || null;
    }
}