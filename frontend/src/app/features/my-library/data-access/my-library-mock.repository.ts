
import { Injectable } from '@angular/core';

import { MyLibraryView } from '../domain/my-library.models';
import { MyLibraryRepository } from '../domain/my-library.repository';
import { MY_LIBRARY_MOCK } from '../mock/my-library.mock';

@Injectable()
export class MyLibraryMockRepository
    implements MyLibraryRepository {
    getLibrary(): MyLibraryView {
        return MY_LIBRARY_MOCK;
    }
}