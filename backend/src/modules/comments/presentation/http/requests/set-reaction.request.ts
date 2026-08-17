import { IsIn } from 'class-validator';

import {
  COMMENT_REACTION_TYPES,
  type ReactionName,
} from '../../../domain';

export class SetReactionRequest {
  @IsIn(COMMENT_REACTION_TYPES)
  type!: ReactionName;
}
