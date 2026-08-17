import { Inject, Injectable } from '@nestjs/common';
import { normalizeCategoryName } from '../../../domain';
import { CATEGORY_REPOSITORY, type CategoryRepositoryPort } from '../../ports';
import { CreateCategoryCommand } from './create-category.command';
@Injectable()
export class CreateCategoryCommandHandler {
 constructor(@Inject(CATEGORY_REPOSITORY) private readonly repository: CategoryRepositoryPort) {}
 execute(command: CreateCategoryCommand) { return this.repository.create({ ...command.input, name: normalizeCategoryName(command.input.name) }, command.audit); }
}
