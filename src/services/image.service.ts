import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { File as FastifyFile } from '@nest-lab/fastify-multer';

type SaveResult = {
  publicUrl: string;
  filename: string;
  mime: string;
  size: number;
  absPath: string;
};

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

function guessExtFromMime(mime: string) {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

function parseBase64Input(input: string, explicitMime?: string): { buffer: Buffer; mime: string } {
  const m = input.match(/^data:([\w/+.-]+);base64,(.+)$/i);
  if (m) {
    const mime = m[1].toLowerCase();
    const b64 = m[2];
    return { buffer: Buffer.from(b64, 'base64'), mime };
    }
  const mime = (explicitMime || 'image/png').toLowerCase();
  return { buffer: Buffer.from(input, 'base64'), mime };
}

@Injectable()
export class ImageService {
  private readonly uploadRoot = process.env.UPLOAD_ROOT || '/var/www/tradervizion/uploads';
  private readonly publicBaseUrl = (process.env.PUBLIC_BASE_URL || 'https://tradervizion.com').replace(/\/+$/, '');

  private async ensureDir(subfolder: string) {
    const safe = subfolder.replace(/[^a-zA-Z0-9/_-]/g, '');
    const dir = path.join(this.uploadRoot, safe);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  private buildUrl(subfolder: string, filename: string) {
    const seg = subfolder.replace(/^\/+|\/+$/g, '');
    return `${this.publicBaseUrl}/uploads/${seg}/${filename}`;
  }

  async saveBase64(photoBase64: string, photoMimeType?: string, subfolder = 'avatars'): Promise<SaveResult> {
    const { buffer, mime } = parseBase64Input(photoBase64, photoMimeType);
    if (!ALLOWED_MIMES.has(mime)) throw new BadRequestException(`MIME não permitido: ${mime}`);
    if (buffer.length === 0) throw new BadRequestException('Imagem vazia');

    const ext = guessExtFromMime(mime);
    const filename = `${randomUUID()}.${ext}`;
    const dir = await this.ensureDir(subfolder);
    const filepath = path.join(dir, filename);

    await fs.writeFile(filepath, buffer, { mode: 0o644 });

    return {
      publicUrl: this.buildUrl(subfolder, filename),
      filename,
      mime,
      size: buffer.length,
      absPath: filepath,
    };
  }

  async saveTempBase64(photoBase64: string, photoMimeType?: string) {
    return this.saveBase64(photoBase64, photoMimeType, 'tmp');
  }

  async saveFile(file: FastifyFile, subfolder = 'avatars') {
    const mime = (file.mimetype || 'application/octet-stream').toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) throw new BadRequestException(`MIME não permitido: ${mime}`);

    const rawExt = (file.originalname?.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext = rawExt || guessExtFromMime(mime);

    const filename = `${randomUUID()}.${ext}`;
    const dir = await this.ensureDir(subfolder);
    const filepath = path.join(dir, filename);

    await fs.writeFile(filepath, file.buffer, { mode: 0o644 });

    return {
      publicUrl: this.buildUrl(subfolder, filename),
      filename,
      mime,
      size: file.size,
      absPath: filepath,
    };
  }

  async remove(absPath: string): Promise<boolean> {
    try { await fs.unlink(absPath); return true; } catch { return false; }
  }
}
