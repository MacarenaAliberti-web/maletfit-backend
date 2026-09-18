// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    private async sendMail(to: string, subject: string, html: string) {
        try {
            const apiKey = process.env.BREVO_API_KEY;
            const senderEmail = process.env.BREVO_SENDER_EMAIL;

            if (!apiKey || !senderEmail) {
                this.logger.error('Faltan las variables de entorno BREVO_API_KEY o BREVO_SENDER_EMAIL');
                return;
            }

            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    sender: {
                        name: 'MaletFit',
                        email: senderEmail,
                    },
                    to: [{ email: to }],
                    subject: subject,
                    htmlContent: html,
                }),
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Error de Brevo (${response.status}): ${errorData}`);
            }

            this.logger.log(`Email enviado vía Brevo a ${to}: ${subject}`);
        } catch (error: any) {
            // Importante: el email NUNCA debe romper la operación principal.
            this.logger.error(`Error al enviar email vía Brevo a ${to}: ${error.message || error}`);
        }
    }

    async sendWelcomeEmail(to: string, fullName: string) {
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #10b981;">¡Bienvenido a MaletFit, ${fullName}!</h1>
                <p>Tu cuenta se creó correctamente. Ya podés iniciar sesión y reservar tu primera clase.</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, '¡Bienvenido a MaletFit! 🏋️', html);
    }

    async sendBookingConfirmedEmail(
        to: string,
        fullName: string,
        className: string,
        startTime: Date,
    ) {
        const formattedDate = startTime.toLocaleString('es-AR', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #10b981;">¡Reserva confirmada!</h1>
                <p>Hola ${fullName}, tu lugar en <strong>${className}</strong> quedó confirmado.</p>
                <p><strong>Fecha y hora:</strong> ${formattedDate}</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, `Reserva confirmada: ${className}`, html);
    }

    async sendBookingWaitlistEmail(
        to: string,
        fullName: string,
        className: string,
        startTime: Date,
    ) {
        const formattedDate = startTime.toLocaleString('es-AR', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #f59e0b;">Estás en lista de espera</h1>
                <p>Hola ${fullName}, el turno de <strong>${className}</strong> del ${formattedDate} está completo por ahora.</p>
                <p>Quedaste anotado en la lista de espera — si se libera un cupo, te vamos a avisar por email.</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, `Lista de espera: ${className}`, html);
    }

    async sendNewBookingNotificationToInstructor(
        to: string,
        instructorName: string,
        studentName: string,
        className: string,
        startTime: Date,
    ) {
        const formattedDate = startTime.toLocaleString('es-AR', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #10b981;">Nueva reserva en tu clase</h1>
                <p>Hola ${instructorName}, <strong>${studentName}</strong> se anotó en tu clase de <strong>${className}</strong>.</p>
                <p><strong>Fecha y hora:</strong> ${formattedDate}</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, `Nueva reserva: ${studentName} en ${className}`, html);
    }

    async sendBookingCancelledEmail(
        to: string,
        fullName: string,
        className: string,
        startTime: Date,
    ) {
        const formattedDate = startTime.toLocaleString('es-AR', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #ef4444;">Reserva cancelada</h1>
                <p>Hola ${fullName}, tu reserva en <strong>${className}</strong> del ${formattedDate} fue cancelada correctamente.</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, `Reserva cancelada: ${className}`, html);
    }

    async sendBookingPromotedEmail(
        to: string,
        fullName: string,
        className: string,
        startTime: Date,
    ) {
        const formattedDate = startTime.toLocaleString('es-AR', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #10b981;">¡Se liberó un cupo!</h1>
                <p>Hola ${fullName}, buenas noticias: se liberó un lugar en <strong>${className}</strong> y tu reserva quedó <strong>confirmada</strong>.</p>
                <p><strong>Fecha y hora:</strong> ${formattedDate}</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, `¡Tu lugar en ${className} se confirmó!`, html);
    }

    async sendRoutineAssignedEmail(
        to: string,
        fullName: string,
        routineTitle: string,
    ) {
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #10b981;">¡Tenés una nueva rutina!</h1>
                <p>Hola ${fullName}, tu instructor te asignó una nueva rutina: <strong>${routineTitle}</strong>.</p>
                <p>Ingresá a MaletFit para ver el detalle completo de los ejercicios.</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, `Nueva rutina asignada: ${routineTitle}`, html);
    }

    async sendNewUserNotificationToAdmin(
        to: string,
        studentName: string,
        studentEmail: string,
    ) {
        const html = `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h1 style="color: #10b981;">Nuevo usuario registrado</h1>
                <p><strong>${studentName}</strong> se registró en MaletFit.</p>
                <p><strong>Email:</strong> ${studentEmail}</p>
                <p style="color: #6b7280; font-size: 14px;">Este es un email automático, no respondas a este mensaje.</p>
            </div>
        `;
        await this.sendMail(to, `Nuevo registro: ${studentName}`, html);
    }
}