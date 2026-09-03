import { Body, Controller, Get, Put } from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  GetMyReadingGoalQuery,
  GetMyReadingGoalQueryHandler,
  UpsertReadingGoalCommand,
  UpsertReadingGoalCommandHandler,
  type ReadingGoalResultDto,
} from '../../../application';
import { UpsertReadingGoalRequest } from '../requests';

@Controller()
export class ReadingGoalsController {
  constructor(
    private readonly getMyReadingGoalQuery: GetMyReadingGoalQueryHandler,
    private readonly upsertReadingGoalCommand: UpsertReadingGoalCommandHandler,
  ) {}

  @Get('reading-goal')
  @RequirePermissions(PermissionCode.READING_GOAL_MANAGE_OWN)
  getMyReadingGoal(
    @CurrentUserId() userId: string | undefined,
  ): Promise<ReadingGoalResultDto> {
    return this.getMyReadingGoalQuery.execute(
      new GetMyReadingGoalQuery(userId),
    );
  }

  @Put('reading-goal')
  @RequirePermissions(PermissionCode.READING_GOAL_MANAGE_OWN)
  upsertReadingGoal(
    @CurrentUserId() userId: string | undefined,
    @Body() request: UpsertReadingGoalRequest,
  ): Promise<ReadingGoalResultDto> {
    return this.upsertReadingGoalCommand.execute(
      new UpsertReadingGoalCommand(userId, request.targetChapters),
    );
  }
}
