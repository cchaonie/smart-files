import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SpaFallbackMiddleware } from './static.middleware';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '..', 'web', 'dist'),
      exclude: ['/api/(.*)'],
    }),
  ],
})
export class StaticModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SpaFallbackMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
