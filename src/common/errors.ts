import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessLogicError extends HttpException {
  constructor(response: string | object, status: number = HttpStatus.BAD_REQUEST) {
    super(response, status);
  }
}

export class TechnicalError extends BusinessLogicError {
  constructor(response) {
    super(response || 'Technical error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
