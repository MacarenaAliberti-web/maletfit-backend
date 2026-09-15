// src/mail/mail.module.ts
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global() // así cualquier service (auth, bookings, routines) lo inyecta sin re-importarlo
@Module({
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }