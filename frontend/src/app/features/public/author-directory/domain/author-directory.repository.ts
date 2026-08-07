
import { AuthorDirectoryView } from './author-directory.models';

export abstract class AuthorDirectoryRepository {
    abstract getDirectory(): AuthorDirectoryView;
}