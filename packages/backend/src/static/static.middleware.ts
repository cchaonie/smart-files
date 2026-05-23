import { Injectable, NestMiddleware } from '@nestjs/common';
import { join } from 'path';

@Injectable()
export class SpaFallbackMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(process.cwd(), '..', 'web', 'dist', 'index.html'));
  }
}
