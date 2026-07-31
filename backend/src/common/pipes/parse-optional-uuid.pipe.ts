import {
    ArgumentMetadata,
    BadRequestException,
    ParseUUIDPipe,
    PipeTransform,
} from '@nestjs/common';

export class ParseOptionalUuidPipe
    implements PipeTransform<unknown, Promise<string | undefined>> {
    private readonly uuidPipe = new ParseUUIDPipe({
        version: '4',
    });

    async transform(
        value: unknown,
        metadata: ArgumentMetadata,
    ): Promise<string | undefined> {
        if (
            value === undefined ||
            value === null ||
            value === ''
        ) {
            return undefined;
        }

        if (typeof value !== 'string') {
            throw new BadRequestException({
                code: 'INVALID_UUID',
                message: `${metadata.data ?? 'value'
                    } phải là UUID hợp lệ`,
            });
        }

        return this.uuidPipe.transform(value, metadata);
    }
}