import { Inject, Injectable } from '@nestjs/common';
import { CATEGORY_REPOSITORY, type CategoryRepositoryPort } from '../../ports';
import { DeleteCategoryCommand } from './delete-category.command';
@Injectable()
export class DeleteCategoryCommandHandler {
 constructor(@Inject(CATEGORY_REPOSITORY) private readonly repository: CategoryRepositoryPort) {}
 execute(command: DeleteCategoryCommand) { return this.repository.delete(command.id, command.audit); }
}
