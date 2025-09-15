import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SseJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) token = req.query?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException('missing token');

    try {
      const payload = this.jwt.verify(token);
      req.user = { id: payload.sub, email: payload.email, ...payload };
      return true;
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }
}
