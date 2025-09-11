import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class ImageService {
  private readonly uploadRoot = '/var/www/tradervizion/uploads';

  private async ensureDir(subfolder: string) {
    const dir = path.join(this.uploadRoot, subfolder);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async saveBase64(photoBase64: string, photoMimeType = 'image/png', subfolder = 'avatars') {
    const ext = (photoMimeType.split('/')[1] || 'png').toLowerCase();
    const filename = `${randomUUID()}.${ext}`;
    const dir = await this.ensureDir(subfolder);
    const filepath = path.join(dir, filename);

    const buffer = Buffer.from(photoBase64, 'base64');
    await fs.writeFile(filepath, buffer, { mode: 0o644 });

    const publicUrl = `https://tradervizion.com/uploads/${subfolder}/${filename}`;
    return { publicUrl, filename, mime: photoMimeType, size: buffer.length };
  }

  async saveFile(file: Express.Multer.File, subfolder = 'avatars') {
    const ext = file.originalname.split('.').pop();
    const filename = `${randomUUID()}.${ext}`;
    const dir = await this.ensureDir(subfolder);
    const filepath = path.join(dir, filename);

    await fs.writeFile(filepath, file.buffer, { mode: 0o644 });
    const publicUrl = `https://tradervizion.com/uploads/${subfolder}/${filename}`;
    return { publicUrl, filename, mime: file.mimetype, size: file.size };
  }

}
