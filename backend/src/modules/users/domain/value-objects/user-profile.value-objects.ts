import {
    InvalidUserBioException,
    InvalidUserDisplayNameException,
} from '../exceptions';

export class UserDisplayNameValueObject {
    private constructor(
        readonly value: string,
    ) { }

    static create(
        rawValue: string,
    ): UserDisplayNameValueObject {
        if (typeof rawValue !== 'string') {
            throw new InvalidUserDisplayNameException();
        }

        const value = rawValue
            .trim()
            .replace(/\s+/gu, ' ');

        if (
            value.length < 1 ||
            value.length > 120
        ) {
            throw new InvalidUserDisplayNameException();
        }

        return new UserDisplayNameValueObject(value);
    }
}

export class UserBioValueObject {
    private constructor(
        readonly value: string | null,
    ) { }

    static create(
        rawValue: string | null,
    ): UserBioValueObject {
        if (rawValue === null) {
            return new UserBioValueObject(null);
        }

        if (typeof rawValue !== 'string') {
            throw new InvalidUserBioException();
        }

        const value = rawValue.trim();

        if (value.length > 1000) {
            throw new InvalidUserBioException();
        }

        return new UserBioValueObject(
            value || null,
        );
    }
}