import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OrchestratorService } from '../services/orchestrator.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AccessTokenQueryGuard } from '../guards/access-token-query.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@UseGuards(AccessTokenQueryGuard, JwtAuthGuard)
@Controller('v1/orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post()
  async handle(
    @CurrentUser('id') userId: string,
    @Body() body: { kind: 'automator'|'manual_analyzer'; data: any },
  ) {
    const { kind, data } = body;
    return this.orchestrator.handle(userId, kind, data);
  }
}
