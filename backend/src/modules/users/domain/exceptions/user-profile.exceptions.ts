import {
    InvalidInputException,
    ResourceNotFoundException,
} from '@/common/exceptions';

export class InvalidUserDisplayNameException extends InvalidInputException {
    constructor() {
        super({
            code: 'USER_DISPLAY_NAME_INVALID',
            message: 'Tên hiển thị phải có độ dài từ 1 đến 120 ký tự',
            details: {
                field: 'displayName',
            },
        });
    }
}

export class InvalidUserBioException extends InvalidInputException {
    constructor() {
        super({
            code: 'USER_BIO_INVALID',
            message: 'Tiểu sử không được vượt quá 1000 ký tự',
            details: {
                field: 'bio',
            },
        });
    }
}

export class InvalidUserAvatarException extends InvalidInputException {
    constructor() {
        super({
            code: 'USER_AVATAR_INVALID',
            message: 'Ảnh đại diện không hợp lệ hoặc chưa sẵn sàng',
            details: {
                field: 'avatarMediaId',
            },
        });
    }
}

export class UserProfileUnavailableException extends ResourceNotFoundException {
    constructor() {
        super({
            code: 'USER_PROFILE_NOT_FOUND',
            resource: 'hồ sơ người dùng',
            message: 'Không tìm thấy hồ sơ người dùng hiện tại',
        });
    }
}