import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '@/common/decorators';

import {
  GetAuthorDetailQuery,
  GetAuthorDetailQueryHandler,
  GetAuthorDirectoryQuery,
  GetAuthorDirectoryQueryHandler,
} from '../../../application/queries';

import type {
  AuthorDetailDto,
  AuthorDirectoryDto,
} from '../../../application/dto';

@Controller('authors')
@Public()
export class PublicAuthorsController {
  constructor(
    private readonly getDirectoryHandler: GetAuthorDirectoryQueryHandler,
    private readonly getDetailHandler: GetAuthorDetailQueryHandler,
  ) {}

  @Get()
  directory(): Promise<AuthorDirectoryDto> {
    return this.getDirectoryHandler.execute(new GetAuthorDirectoryQuery());
  }

  @Get(':slug')
  detail(@Param('slug') slug: string): Promise<AuthorDetailDto> {
    return this.getDetailHandler.execute(new GetAuthorDetailQuery(slug));
  }
}
