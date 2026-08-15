import { Provider } from '@angular/core';
import { MyLibraryRepository } from '../domain/my-library.repository';
import { MyLibraryHttpRepository } from './my-library-http.repository';

export function provideMyLibrary(): Provider[] {
  return [{ provide: MyLibraryRepository, useClass: MyLibraryHttpRepository }];
}
