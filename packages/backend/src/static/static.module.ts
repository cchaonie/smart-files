import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { SpaFallbackMiddleware } from './static.middleware';

@Module({})
export class StaticModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SpaFallbackMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
