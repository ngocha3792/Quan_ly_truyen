import {
    BadRequestException,
    ValidationPipe,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface ValidationIssue {
    field: string;
    code: string;
    message: string;
}

function flattenValidationErrors(
    errors: ValidationError[],
    parentPath = '',
): ValidationIssue[] {
    return errors.flatMap((error) => {
        const field = parentPath
            ? `${parentPath}.${error.property}`
            : error.property;

        const currentIssues = Object.entries(
            error.constraints ?? {},
        ).map(([code, message]) => ({
            field,
            code,
            message,
        }));

        const childIssues = error.children?.length
            ? flattenValidationErrors(error.children, field)
            : [];

        return [...currentIssues, ...childIssues];
    });
}

export class AppValidationPipe extends ValidationPipe {
    constructor() {
        super({
            transform: true,

            transformOptions: {
                enableImplicitConversion: false,
            },

            whitelist: true,
            forbidNonWhitelisted: true,

            stopAtFirstError: false,

            validationError: {
                target: false,
                value: false,
            },

            exceptionFactory: (errors: ValidationError[]) =>
                new BadRequestException({
                    code: 'VALIDATION_ERROR',
                    message: 'Dữ liệu gửi lên không hợp lệ',
                    issues: flattenValidationErrors(errors),
                }),
        });
    }
}