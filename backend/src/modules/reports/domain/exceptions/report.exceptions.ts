import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class ReportNotFoundException extends ResourceNotFoundException {
  constructor(id?: string) {
    super({
      code: 'REPORT_NOT_FOUND',
      resource: 'báo cáo',
      identifier: id,
      message: 'Không tìm thấy báo cáo',
    });
  }
}

export class ReportAlreadyClosedException extends ResourceConflictException {
  constructor() {
    super({
      code: 'REPORT_ALREADY_CLOSED',
      message: 'Báo cáo đã được đóng bởi một moderator khác',
    });
  }
}

export class InvalidReportResolutionException extends InvalidInputException {
  constructor() {
    super({
      code: 'REPORT_RESOLUTION_NOTE_REQUIRED',
      message: 'Ghi chú xử lý phải có từ 10 đến 2000 ký tự',
      details: { field: 'note' },
    });
  }
}
