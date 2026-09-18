import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness plus a real database round-trip: a process that cannot reach
   * Postgres is not healthy, however cheerfully it answers HTTP.
   */
  @Public()
  @Get('health')
  async health(): Promise<{ status: string; database: string; uptime: number }> {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    return { status: database === 'up' ? 'ok' : 'degraded', database, uptime: process.uptime() };
  }
}
