# Sistema de Notificaciones por Email — MaletFit

Este documento explica las decisiones detrás del sistema de emails transaccionales de MaletFit: qué proveedores se evaluaron, cuál terminó usándose y por qué, la arquitectura del módulo, y el detalle completo de cada notificación implementada.

---

## 1. Historia de la elección de proveedor

El proyecto pasó por **tres etapas** distintas antes de llegar a la solución final — vale la pena documentar las tres, porque cada cambio respondió a un problema real descubierto en la práctica, no a preferencia.

### Etapa 1 — Resend (evaluada, descartada antes de implementar)

Resend es el estándar actual para email transaccional en proyectos Node/TypeScript: API pensada para developers, integración nativa con React Email, y un free tier permanente de 3.000 emails/mes.

**Por qué no se usó:** el free tier de Resend solo permite enviar sin restricciones a un **dominio propio verificado** (vía registros DNS). Sin un dominio comprado, esto agregaba fricción de configuración fuera del alcance de este proyecto.

### Etapa 2 — Nodemailer + Gmail SMTP (implementada, funcionó en local, falló en producción)

Permite enviar a cualquier destinatario real sin dominio propio, usando una cuenta de Gmail como remitente técnico vía protocolo SMTP.

**Incidente 1 — cuenta dedicada inhabilitada:** se intentó crear `maletfit@gmail.com` exclusivamente para el envío. Google la inhabilitó a las pocas horas, detectando el patrón "cuenta nueva + acceso SMTP inmediato" como comportamiento de bot. Se resolvió usando la cuenta personal de la desarrolladora en su lugar, con `"MaletFit" <email-personal>` como nombre visible en el campo `from`.

**Incidente 2 — bloqueo de puertos SMTP en Render (el que forzó la migración final):** los 8 disparadores de email funcionaban perfecto en **local**, pero en **producción** (desplegado en Render) ningún email llegaba nunca, con este error en los logs:

```
ERROR [MailService] Error al enviar email a ...: Error: connect ENETUNREACH ...
ERROR [MailService] Error al enviar email a ...: Error: Connection timeout
```

Se probó cambiar de puerto (465 → 587) sin éxito. La investigación confirmó que **Render bloquea todo el tráfico saliente por los puertos SMTP estándar (25, 465 y 587) en el plan gratuito**, desde septiembre de 2025 — es una medida anti-spam común en plataformas cloud (Render, Heroku, DigitalOcean), ya que servidores comprometidos en tiers gratuitos son un vector barato para enviar spam masivo, lo cual arruina la reputación de IP de toda la plataforma.

**Conclusión clave:** el problema no era de código ni de credenciales — era que **el protocolo SMTP en sí mismo está bloqueado** en este hosting, sin importar qué proveedor de correo se use por detrás.

### Etapa 3 — Brevo vía API HTTPS (solución final, en uso)

La salida real a un bloqueo de puertos SMTP es dejar de usar SMTP: **enviar el email como una petición HTTPS normal** (puerto 443), que ningún proveedor cloud bloquea, porque bloquear ese puerto tumbaría cualquier conexión saliente del servidor (bases de datos, APIs externas, todo).

**Por qué Brevo específicamente:** a diferencia de Resend, Brevo permite **"Single Sender Verification"** en su free tier — verificar una sola dirección de email (no un dominio completo) como remitente autorizado, y desde ahí enviar a cualquier destinatario sin restricción. Esto resuelve exactamente la limitación que había descartado a Resend en la Etapa 1, sin necesidad de comprar ni configurar un dominio.

**Cambio de dependencias:**

```bash
npm uninstall nodemailer @types/nodemailer
npm install @getbrevo/brevo
```

**Variables de entorno nuevas:**

```
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=email-verificado-como-sender
```

---

## 2. Arquitectura del módulo

```
src/mail/
├── mail.module.ts   # @Global() — cualquier service lo inyecta sin reimportar
└── mail.service.ts  # Cliente de Brevo (API HTTPS) + un método por tipo de notificación
```

La estructura pública del módulo **no cambió** con la migración — los 8 métodos (`sendWelcomeEmail`, `sendBookingConfirmedEmail`, etc.) mantienen la misma firma. Lo único que cambió fue el mecanismo interno de envío: en vez de abrir una conexión SMTP con Nodemailer, `sendMail()` ahora hace una llamada a la API de Brevo.

### Principio de diseño central: un email nunca debe romper la operación principal

```typescript
private async sendMail(to: string, subject: string, html: string) {
    try {
        await this.brevoClient.sendTransacEmail({
            sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'MaletFit' },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        });
        this.logger.log(`Email enviado a ${to}: ${subject}`);
    } catch (error) {
        // El email es un efecto secundario, no debe tumbar la operación real.
        this.logger.error(`Error al enviar email a ${to}: ${error}`);
    }
}
```

Este principio no cambió con la migración: el error se loguea, nunca se relanza — si Brevo tuviera un problema momentáneo, el registro, la reserva o la asignación de rutina ya se completaron con éxito antes de intentar el envío.

### Patrón de disparo: `void` + fire-and-forget

```typescript
void this.mailService.sendWelcomeEmail(user.email, user.fullName);
```

Sigue igual — no se espera (`await`) a que el email termine de enviarse antes de responder al cliente.

### Reconsulta de datos fuera de la transacción

Sin cambios respecto al diseño original: en `BookingsService`, los emails se disparan después de que la transacción de Prisma ya terminó, nunca dentro de ella, para no extender el tiempo que la transacción mantiene sus locks.

---

## 3. Los 7 disparadores implementados (sin cambios funcionales tras la migración)

| #   | Evento                         | Disparado desde                                         | Destinatario               | Contenido                        |
| --- | ------------------------------ | ------------------------------------------------------- | -------------------------- | -------------------------------- |
| 1   | Registro de usuario            | `AuthService.register()`                                | El nuevo usuario           | Bienvenida                       |
| 2   | Reserva confirmada             | `BookingsService.create()`                              | El alumno                  | Clase, fecha, hora               |
| 3   | Reserva en lista de espera     | `BookingsService.create()`                              | El alumno                  | Clase, fecha, hora               |
| 4   | Nueva reserva en su clase      | `BookingsService.create()` (mismo método que 2 y 3)     | El instructor de esa clase | Quién se anotó, clase, fecha     |
| 5   | Cancelación de reserva         | `BookingsService.cancel()`                              | El alumno que cancela      | Clase, fecha, hora               |
| 6   | Ascenso desde lista de espera  | `BookingsService.cancel()` (si había alguien en espera) | El alumno que asciende     | Clase, fecha, hora               |
| 7   | Rutina asignada                | `RoutinesService.create()`                              | El alumno                  | Título de la rutina              |
| 8   | Nuevo registro (aviso interno) | `AuthService.register()` (mismo método que 1)           | El administrador           | Nombre y email del nuevo usuario |

_(Se numeraron 8 filas porque el disparador 4 y el 8 se sumaron en una segunda ronda, después de los 5 originales — el evento de registro dispara dos emails distintos, uno al usuario y otro al admin.)_

### Detalle: notificación al instructor (disparador 4)

Se envía en ambos casos — reserva confirmada o en lista de espera — porque en los dos escenarios alguien se anotó a la clase del instructor.

### Detalle: notificación al admin (disparador 8)

Implementada asumiendo un único administrador, vía `findFirst({ where: { role: 'ADMIN' } })`. Si el sistema llegara a tener múltiples administradores, se reemplazaría por `findMany` + iteración.

---

## 4. Lección aprendida: probar en el ambiente real, no solo en local

El bug más difícil de este sistema no estuvo en el código — todos los tests y las pruebas manuales en local pasaron sin problema. El problema apareció exclusivamente en producción, por una restricción de infraestructura invisible desde el entorno de desarrollo. Esto refuerza una práctica concreta: **cualquier feature que dependa de una conexión saliente (email, webhooks, servicios de terceros) debe probarse explícitamente en el ambiente de despliegue real antes de darla por terminada**, no asumir que "si funciona en `localhost`, funciona en todos lados".

---

## 5. Cómo probar el sistema completo

1. Registrar un usuario nuevo → confirmar email de bienvenida (destinatario) y de aviso (admin)
2. Reservar un turno con cupo disponible → confirmar email de reserva confirmada (alumno) y de nueva reserva (instructor)
3. Llenar un turno y reservar un 6º lugar → confirmar email de lista de espera (alumno) y de nueva reserva (instructor)
4. Cancelar una reserva confirmada que tenga a alguien en lista de espera → confirmar email de cancelación (quien cancela) y de ascenso (quien sube)
5. Asignar una rutina a un alumno desde el dashboard de instructor o admin → confirmar email de rutina asignada
