import { Observable } from 'rxjs';

import { AuthorDirectoryView } from './author-directory.models';

export abstract class AuthorDirectoryRepository {
  abstract getDirectory(): Observable<AuthorDirectoryView>;
}
