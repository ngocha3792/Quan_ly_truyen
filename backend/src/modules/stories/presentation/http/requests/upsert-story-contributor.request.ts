import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { STORY_CONTRIBUTOR_ROLES, type StoryContributorRoleName } from '../../../application';

export class UpsertStoryContributorRequest {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn(STORY_CONTRIBUTOR_ROLES)
  role!: StoryContributorRoleName;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  creditName?: string;

  @IsBoolean()
  canEdit!: boolean;
}
