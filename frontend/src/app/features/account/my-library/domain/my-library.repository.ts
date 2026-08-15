import { Observable } from 'rxjs';
import { MyLibraryView } from './my-library.models';

export abstract class MyLibraryRepository {
  abstract getLibrary(): Observable<MyLibraryView>;
  abstract setFavorite(storyId: string, isFavorite: boolean): Observable<void>;
}
