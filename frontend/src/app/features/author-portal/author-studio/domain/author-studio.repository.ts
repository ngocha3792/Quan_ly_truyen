import { Observable } from 'rxjs';

import { AuthorStudioDashboard } from './author-studio.models';

export abstract class AuthorStudioRepository {
  abstract getDashboard(): Observable<AuthorStudioDashboard>;
}
