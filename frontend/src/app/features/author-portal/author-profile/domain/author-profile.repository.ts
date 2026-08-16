import { Observable } from 'rxjs';
import { EditableAuthorProfile, UpdateEditableAuthorProfile } from './author-profile.models';

export abstract class AuthorProfileRepository {
  abstract get(): Observable<EditableAuthorProfile>;
  abstract update(input: UpdateEditableAuthorProfile): Observable<EditableAuthorProfile>;
}
