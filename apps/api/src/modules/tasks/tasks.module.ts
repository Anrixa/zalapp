import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TasksService } from './tasks.service';

/**
 * Imports AuthModule for TokenService — the token table is its business, and
 * pruning it from here rather than reaching into Prisma keeps that true.
 */
@Module({
  imports: [AuthModule],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
