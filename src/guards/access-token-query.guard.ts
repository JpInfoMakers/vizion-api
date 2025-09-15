import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AccessTokenQueryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const qToken = (req.query?.access_token as string | undefined)?.trim();
    const hasAuth = typeof req.headers?.authorization === 'string' && req.headers.authorization.toLowerCase().startsWith('bearer ');
    if (qToken && !hasAuth) {
      req.headers.authorization = `Bearer ${qToken}`;
    }
    return true;
  }
}
