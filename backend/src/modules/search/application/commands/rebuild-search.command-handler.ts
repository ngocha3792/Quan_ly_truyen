import { Inject, Injectable } from '@nestjs/common';
import { SEARCH_ADMIN_PORT, type SearchAdminPort } from '../ports/search.port';

@Injectable()
export class RebuildSearchCommandHandler {
  constructor(
    @Inject(SEARCH_ADMIN_PORT) private readonly admin: SearchAdminPort,
  ) {}
  execute() {
    return this.admin.rebuild();
  }
  status() {
    return this.admin.status();
  }
}
