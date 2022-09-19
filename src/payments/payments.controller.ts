import { Body, Controller, Get, Post } from '@nestjs/common';

@Controller('/payments')
export class PaymentsController {
  @Post('')
  processPaddlePayment(@Body() body) {
    console.log(body);
    return { ok: true };
  }

  @Get('')
  processPaddlePaymentGet(@Body() body) {
    console.log(body);
    return { ok: '야호' };
  }
}
