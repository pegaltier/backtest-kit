import { fileURLToPath } from 'url';
import path from 'path';

export const getEntry = (metaUrl) => {
    const metaPath = fileURLToPath(metaUrl);
    return path.resolve(process.argv[1]) === path.resolve(metaPath);
};

export default getEntry;
