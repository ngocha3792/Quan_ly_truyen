
import { Injectable } from '@angular/core';

import { AuthorDirectoryView } from '../domain/author-directory.models';
import { AuthorDirectoryRepository } from '../domain/author-directory.repository';
import { AUTHOR_DIRECTORY_MOCK } from '../mock/author-directory.mock';

@Injectable()
export class AuthorDirectoryMockRepository
    implements AuthorDirectoryRepository {
    getDirectory(): AuthorDirectoryView {
        return AUTHOR_DIRECTORY_MOCK;
    }
}