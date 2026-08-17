import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  ListLibraryQuery,
  ListLibraryQueryHandler,
  RemoveLibraryEntryCommand,
  RemoveLibraryEntryCommandHandler,
  UpsertLibraryEntryCommand,
  UpsertLibraryEntryCommandHandler,
  type LibraryEntryResultDto,
} from '../../../application';
import { UpsertLibraryEntryRequest } from '../requests';

@Controller()
export class LibrariesController {
  constructor(
    private readonly listLibraryQuery: ListLibraryQueryHandler,
    private readonly upsertLibraryCommand: UpsertLibraryEntryCommandHandler,
    private readonly removeLibraryCommand: RemoveLibraryEntryCommandHandler,
  ) {}

  @Get('library')
  @RequirePermissions(PermissionCode.LIBRARY_MANAGE_OWN)
  listLibrary(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly LibraryEntryResultDto[]> {
    return this.listLibraryQuery.execute(new ListLibraryQuery(userId));
  }

  @Put('library/:storyId')
  @RequirePermissions(PermissionCode.LIBRARY_MANAGE_OWN)
  upsertLibrary(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpsertLibraryEntryRequest,
  ): Promise<LibraryEntryResultDto> {
    return this.upsertLibraryCommand.execute(
      new UpsertLibraryEntryCommand(
        userId,
        storyId,
        request.status,
        request.isFavorite,
      ),
    );
  }

  @Delete('library/:storyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.LIBRARY_MANAGE_OWN)
  async removeLibrary(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<void> {
    await this.removeLibraryCommand.execute(
      new RemoveLibraryEntryCommand(userId, storyId),
    );
  }
}
