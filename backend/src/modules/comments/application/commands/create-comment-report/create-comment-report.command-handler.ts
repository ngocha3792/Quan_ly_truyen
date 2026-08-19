import { Inject, Injectable } from '@nestjs/common';
import type { CommentReportView } from '../../dto';
import {
  COMMENT_INTERACTION_PERSISTENCE_PORT,
  type CommentInteractionPersistencePort,
} from '../../ports';
import { CreateCommentReportCommand } from './create-comment-report.command';
@Injectable()
export class CreateCommentReportCommandHandler {
  constructor(
    @Inject(COMMENT_INTERACTION_PERSISTENCE_PORT)
    private readonly persistence: CommentInteractionPersistencePort,
  ) {}
  execute(command: CreateCommentReportCommand): Promise<CommentReportView> {
    return this.persistence.createReport(command.input);
  }
}
