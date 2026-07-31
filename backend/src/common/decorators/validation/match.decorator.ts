import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/** Validates that a property equals another property on the same DTO. */
export function Match(
  relatedProperty: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'match',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [relatedProperty],
      ...(validationOptions === undefined
        ? {}
        : { options: validationOptions }),
      validator: {
        validate(
          value: unknown,
          args: ValidationArguments,
        ): boolean {
          const [property] = args.constraints as [string];
          const object = args.object as Record<string, unknown>;
          return value === object[property];
        },
        defaultMessage(args: ValidationArguments): string {
          const [property] = args.constraints as [string];
          return `${args.property} must match ${property}`;
        },
      },
    });
  };
}
