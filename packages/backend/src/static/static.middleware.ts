import { Injectable, NestMiddleware } from '@nestjs/common';
import { join } from 'path';
import { existsSync, statSync } from 'fs';

@Injectable()
export class SpaFallbackMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    if (req.path.startsWith('/api')) {
      return next();
    }

    const webDistPath = join(process.cwd(), '..', 'web', 'dist');
    const filePath = join(webDistPath, req.path);

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }

    res.sendFile(join(webDistPath, 'index.html'));
  }
}
