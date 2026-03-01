import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

/**
 * 自定义校验装饰器：验证当前字段值与指定字段值相等
 * 典型场景：confirmPassword 必须等于 newPassword
 *
 * @param property 目标字段名（同一 DTO 内）
 * @param validationOptions class-validator 选项（message 等）
 */
export function Match(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName: String(propertyName),
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];
          return value === relatedValue;
        },
        defaultMessage(args: ValidationArguments): string {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} 必须与 ${relatedPropertyName} 一致`;
        },
      },
    });
  };
}
