import { Inject, Injectable } from '@nestjs/common';
import { normalizeCategoryName } from '../../../domain';
import { CATEGORY_REPOSITORY, type CategoryRepositoryPort } from '../../ports';
import { UpdateCategoryCommand } from './update-category.command';
@Injectable()
export class UpdateCategoryCommandHandler {
 constructor(@Inject(CATEGORY_REPOSITORY) private readonly repository: CategoryRepositoryPort) {}
 execute(command: UpdateCategoryCommand) { return this.repository.update(command.id, { ...command.input, ...(command.input.name === undefined ? {} : { name: normalizeCategoryName(command.input.name) }) }, command.audit); }
}
