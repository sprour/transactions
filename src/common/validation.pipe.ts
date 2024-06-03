import { ArgumentMetadata, BadRequestException, Injectable, Logger, PipeTransform } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class DtoValidationPipe implements PipeTransform<any> {
  private logger = new Logger('DtoValidationPipe');

  async transform(value: any, {metatype, type, data}: ArgumentMetadata): Promise<any> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToClass(metatype, value);
    const errors = await validate(object);
    if (errors.length > 0) {
      this.logger.error(`${errors.join(',')}`);
      throw new BadRequestException(`${metatype.name} has invalid fields`);
    }
    return value;
  }

  private toValidate(metatype): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

}
