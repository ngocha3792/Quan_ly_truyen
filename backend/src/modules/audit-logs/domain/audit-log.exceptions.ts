import { InvalidInputException, ResourceNotFoundException } from '@/common/exceptions';

export class AuditLogNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({ code: 'AUDIT_LOG_NOT_FOUND', resource: 'audit log', identifier: id });
  }
}

export class AuditInvalidDateRangeException extends InvalidInputException {
  constructor() {
    super({ code: 'AUDIT_INVALID_DATE_RANGE', message: 'Khoảng thời gian audit không hợp lệ' });
  }
}
