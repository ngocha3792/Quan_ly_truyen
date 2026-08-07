import { Provider } from '@angular/core';

import { MyLibraryRepository } from '../domain/my-library.repository';
import { MyLibraryMockRepository } from './my-library-mock.repository';

export function provideMyLibrary(): Provider[] {
  return [
    {
      provide: MyLibraryRepository,
      useClass: MyLibraryMockRepository,
    },
  ];
}
