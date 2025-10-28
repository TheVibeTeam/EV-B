import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import logger from '../logger';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const resolve = path.resolve;

export default new class Loader {
    public plugins: Record<string, any> = {}
    public sockets: Record<string, any> = {}

    public async router(dir: string): Promise<void> {
        const files = await this.scandir(dir);
        const entries: [string, any][] = [];
        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                const name = path.basename(file).replace(/\.(ts|js)$/, '');
                try {
                    const mod = await import(file);
                    entries.push([name, mod.default || mod]);
                    logger.info({ file, name }, 'Route loaded successfully');
                } catch (err: any) {
                    logger.error({ file, error: err.message }, 'Error importing router');
                }
            }
        }
        this.plugins = Object.fromEntries(entries);
    }

    public async socket(dir: string): Promise<void> {
        const files = await this.scandir(dir);
        const entries: [string, any][] = [];
        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                const name = path.basename(file).replace(/\.(ts|js)$/, '');
                try {
                    const mod = await import(file);
                    entries.push([name, mod.default || mod]);
                    logger.info({ file, name }, 'Socket loaded successfully');
                } catch (err: any) {
                    logger.error({ file, error: err.message }, 'Error importing socket');
                }
            }
        }
        this.sockets = Object.fromEntries(entries);
    }

    private async scandir(dir: string): Promise<string[]> {
        const subdirs = await readdir(dir);
        const files = await Promise.all(subdirs.map(async (subdir) => {
            const res = resolve(dir, subdir);
            try {
                return (await stat(res)).isDirectory() ? this.scandir(res) : res;
            } catch (err: any) {
                logger.error({ dir: res, error: err.message }, 'Error reading directory');
                return [];
            }
        }));
        return files.flat();
    }
}