
import { MyLibraryView } from './my-library.models';

export abstract class MyLibraryRepository {
    abstract getLibrary(): MyLibraryView;
}