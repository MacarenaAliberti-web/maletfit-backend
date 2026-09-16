# Sistema de Notificaciones por Email — MaletFit

Este documento explica las decisiones detrás del sistema de emails transaccionales de MaletFit: qué proveedor se evaluó, cuál se eligió y por qué, la arquitectura del módulo, y el detalle completo de cada notificación implementada.

---

## 1. Elección de proveedor: Resend vs. Nodemailer + Gmail

### Resend (la opción evaluada primero, la más "correcta" técnicamente)

Resend es el estándar actual para email transaccional en proyectos Node/TypeScript: API pensada para developers, integración nativa con **React Email** (plantillas como componentes JSX), y un free tier permanente de 3.000 emails/mes.

**Por qué no se usó en este proyecto:** el free tier de Resend solo permite enviar sin restricciones a un **dominio propio verificado** (vía registros DNS). Para un proyecto de portfolio sin dominio comprado, esto agrega fricción de configuración (esperar propagación DNS, gestionar registros SPF/DKIM) que no aporta valor de aprendizaje adicional al alcance de este proyecto.

### Nodemailer + Gmail SMTP (la opción elegida)

Permite enviar a **cualquier destinatario real**, sin dominio propio, usando una cuenta de Gmail como remitente técnico. Requiere:

- Verificación en 2 pasos activada en la cuenta de Gmail
- Una **App Password** (Google eliminó el acceso por contraseña normal para SMTP en mayo de 2025)
- Límite de ~500 destinatarios/día en cuentas personales — muy por encima de lo que este proyecto necesita

**Trade-off asumido conscientemente:**

- Peor entregabilidad que un servicio dedicado — los emails pueden demorar o, en clientes estrictos (Outlook/Hotmail en particular), aterrizar en spam las primeras veces que le llegan a un destinatario nuevo.
- No es la práctica recomendada para un producto real con usuarios en producción — un servicio como Resend, con dominio propio y reputación de envío gestionada, sería la elección correcta en ese escenario.
- Para el alcance de un proyecto de portfolio (bajo volumen, destinatarios conocidos), es una solución pragmática y sin costo.

### Incidente: cuenta de Gmail dedicada inhabilitada

Se intentó crear una cuenta `maletfit@gmail.com` dedicada exclusivamente al envío. Google la **inhabilitó a las pocas horas**, detectando el patrón "cuenta nueva + acceso SMTP inmediato" como comportamiento de bot:

> "Parece que esta cuenta se ha creado o usado con otras para infringir las políticas de Google. Es posible que la cuenta la haya creado un programa informático o un robot."

**Solución aplicada:** se usa la cuenta personal de la desarrolladora, con historial de uso real, como remitente técnico. El destinatario ve **"MaletFit"** como nombre visible gracias al header `from`:

```typescript
from: `"MaletFit" <${process.env.GMAIL_USER}>`,
```

Aunque la dirección real que aparece sea una cuenta personal, el nombre mostrado es consistentemente el de la marca del producto.

---

## 2. Arquitectura del módulo

```
src/mail/
├── mail.module.ts   # @Global() — cualquier service lo inyecta sin reimportar
└── mail.service.ts  # Transporter de Nodemailer + un método por tipo de notificación
```

### Principio de diseño central: un email nunca debe romper la operación principal

```typescript
private async sendMail(to: string, subject: string, html: string) {
    try {
        await this.transporter.sendMail({ from: ..., to, subject, html });
        this.logger.log(`Email enviado a ${to}: ${subject}`);
    } catch (error) {
        // El email es un efecto secundario, no debe tumbar la operación real.
        this.logger.error(`Error al enviar email a ${to}: ${error}`);
    }
}
```

Cada método público (`sendWelcomeEmail`, `sendBookingConfirmedEmail`, etc.) delega en este método privado compartido. El error se loguea, nunca se relanza — así, si Gmail está caído o hay un problema de red, el registro, la reserva o la asignación de rutina **ya se completaron con éxito** antes de que se intente el envío, y ese envío fallido no afecta la respuesta que recibe el usuario.

### Patrón de disparo: `void` + fire-and-forget

```typescript
void this.mailService.sendWelcomeEmail(user.email, user.fullName);
```

El `void` indica explícitamente que no se espera (`await`) a que el email termine de enviarse antes de responder al cliente — la respuesta HTTP no debe sentirse más lenta por un envío de email que puede tardar 1-2 segundos.

### Reconsulta de datos fuera de la transacción

En `BookingsService`, los emails se disparan **después** de que la transacción de Prisma (que corre en `isolationLevel: 'Serializable'`) ya terminó — nunca dentro de ella. Esto implica volver a consultar los datos necesarios (usuario, turno, instructor) con una query normal fuera del bloque transaccional, en vez de reutilizar lo que ya se tenía disponible dentro de la transacción. Es una decisión deliberada: mezclar el envío de emails con la lógica transaccional de la reserva aumentaría el tiempo que la transacción mantiene sus locks, lo cual es contraproducente justo en el escenario que se diseñó para evitar (condiciones de carrera bajo alta concurrencia).

---

## 3. Los 7 disparadores implementados

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

_(Se numeraron 8 filas porque el disparador 4 y el 8 se sumaron en una segunda ronda, después de los 5 originales — de ahí que el conteo textual diga "7" pero la tabla tenga 8 filas: el evento de registro dispara dos emails distintos, uno al usuario y otro al admin, contados como una sola "ronda" de trabajo pero dos notificaciones.)_

### Detalle: notificación al instructor (disparador 4)

Se envía en **ambos** casos — reserva confirmada o en lista de espera — porque en los dos escenarios alguien se anotó a la clase del instructor, y es información relevante para él independientemente del estado final de esa reserva puntual.

### Detalle: notificación al admin (disparador 8)

Implementada asumiendo **un único administrador** en el sistema:

```typescript
const admin = await this.prisma.user.findFirst({
  where: { role: 'ADMIN' },
  select: { email: true },
});
```

**Limitación conocida:** si el sistema llegara a tener múltiples administradores, esta lógica solo notificaría al primero encontrado. Para soportar varios, se reemplazaría `findFirst` por `findMany` y se iteraría enviando a cada uno — cambio simple, pospuesto hasta que sea un requisito real.

---

## 4. Cómo probar el sistema completo

1. Registrar un usuario nuevo → confirmar email de bienvenida (destinatario) y de aviso (admin)
2. Reservar un turno con cupo disponible → confirmar email de reserva confirmada (alumno) y de nueva reserva (instructor)
3. Llenar un turno y reservar un 6º lugar → confirmar email de lista de espera (alumno) y de nueva reserva (instructor)
4. Cancelar una reserva confirmada que tenga a alguien en lista de espera → confirmar email de cancelación (quien cancela) y de ascenso (quien sube)
5. Asignar una rutina a un alumno desde el dashboard de instructor o admin → confirmar email de rutina asignada
