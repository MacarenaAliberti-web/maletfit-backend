# Checklist de Revisión Integral — Backend MaletFit

Actualizado con todos los módulos: `auth`, `users`, `instructors`, `class-types`, `schedules`, `bookings`, `routines`. Organizado por área, con el "por qué" de cada punto para que sirva también como referencia de buenas prácticas.

---

## 1. Variables de entorno y configuración

- [x] `.env` no está commiteado
- [x] `.env.example` con todas las claves necesarias
- [x] `DATABASE_URL` (pooled) y `DIRECT_URL` (directa) configuradas para Supabase
- [x] `JWT_SECRET`: sin fallback inseguro (`|| 'supersecretkey'` eliminado de los 6 módulos que lo usaban), con chequeo **fail-fast** en `main.ts` — la app no arranca si falta la variable
- [x] `FRONTEND_URL` configurada para CORS

---

## 2. CORS

- [x] `app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true })`
- [x] `credentials: true` habilitado (necesario para que las cookies httpOnly viajen cross-origin)
- [ ] En producción, restringir `origin` a un dominio fijo (no depender solo de la env var sin fallback seguro)

---

## 3. Validación y manejo de excepciones

- [x] `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- [x] Todos los módulos usan DTOs con `class-validator` (incluyendo `class-types`, el último en sumarse — antes usaba un tipo inline sin validación real)
- [x] `CreateRoutineDto` valida arrays anidados con `@ValidateNested({ each: true })` + `@Type(() => CreateExerciseDto)`
- [x] `UpdateRoleDto` usa `@IsEnum(Role)` para rechazar valores de rol inválidos
- [ ] Filtro global de excepciones (`HttpExceptionFilter`) para formato de error 100% consistente — pendiente, no bloqueante

---

## 4. Swagger / OpenAPI

- [x] Configurado en `/api/docs`
- [x] Descripción actualizada para reflejar auth por **cookies httpOnly**, no Bearer token (se sacó el `addBearerAuth` desactualizado)
- [ ] `@ApiTags`, `@ApiProperty` y ejemplos por endpoint — cobertura parcial, mejora futura

---

## 5. Autenticación, roles y seguridad

- [x] JWT en cookie httpOnly, `secure` en producción, `sameSite: 'lax'`
- [x] `JwtGuard` manual (no Passport) leyendo `req.cookies['jwt']`
- [x] `RolesGuard` + `@Roles(...)` aplicado por endpoint, no globalmente — cada módulo define su propio nivel de acceso
- [x] `password` nunca se serializa (verificado con `select` explícito en todas las queries de `User`)
- [x] Protección contra **auto-lockout**: un admin no puede cambiar su propio rol vía `PATCH /users/:id/role`
- [x] Al promover a alguien a `INSTRUCTOR`, se crea automáticamente su perfil en la tabla `Instructor` (dentro de una transacción, junto con el cambio de rol)
- [ ] Rate limiting en `/auth/login` (mejora futura, con `@nestjs/throttler`)
- [ ] Protección CSRF explícita (mitigado parcialmente por `sameSite: 'lax'`, pero no resuelto del todo — anotado como tema a investigar)

---

## 6. Fechas y zonas horarias

- [x] Fechas en UTC en la base de datos (comportamiento default de Prisma/Postgres)
- [x] El frontend envía `startTime`/`endTime` como ISO 8601 con offset; el backend nunca asume timezone del servidor
- [ ] Validación de que `endTime > startTime` en `CreateScheduleDto` — pendiente de confirmar si ya está

---

## 7. Integridad referencial y lógica de negocio

- [x] `@@unique([userId, scheduleId])` en `Booking` — evita doble reserva del mismo alumno al mismo turno
- [x] Índices en `Schedule.startTime` y `Booking.scheduleId + status`
- [x] **Condición de carrera resuelta:** `create()` y `cancel()` de `bookings.service.ts` corren dentro de `runSerializableTransaction()` (helper reusable), con `isolationLevel: 'Serializable'` y reintentos ante el código de error `P2034` de Prisma
- [x] Lista de espera (`WAITLIST`) automática cuando un turno se llena, con ascenso automático del primero en espera al cancelarse una reserva `CONFIRMED`
- [x] `updateAttendance` restringido a `ATTENDED`/`NO_SHOW` únicamente — no puede usarse para forzar `CONFIRMED`/`CANCELLED` esquivando la lógica de `cancel()`
- [x] Row-Level Security (RLS) habilitado en Supabase; Prisma sigue funcionando con credenciales de administrador
- [ ] Soft delete vs. hard delete en `Schedule`/`Booking` — sigue pendiente de decisión, anotado desde las primeras sesiones

---

## 8. Testing

- [x] `bookings.service.spec.ts`: cubre asignación `CONFIRMED`/`WAITLIST`, rechazo de doble reserva, reintento ante error de serialización (`P2034`), verificación de `isolationLevel`, y el flujo de ascenso automático en `cancel()`
- [ ] Sin tests en `schedules`, `routines`, `class-types`, `instructors`, `users` — pendiente
- [ ] Sin test de integración real contra Postgres para la condición de carrera (el test unitario actual prueba la _lógica de negocio_, no la concurrencia real — requiere una base de datos de test, ver nota en el spec file)

---

## 9. Calidad general

- [x] Lint y build sin errores antes de cada push
- [x] Componentes/servicios compartidos entre módulos (ej. `runSerializableTransaction`) extraídos en vez de duplicados
- [ ] README principal desactualizado — pendiente de reescribir con arquitectura completa y capturas

---

## Prioridad si el tiempo apremia (actualizado)

Con todo lo de arriba ya resuelto, lo que más suma ahora, en orden:

1. **Tests para los módulos sin cobertura** (`schedules`, `routines`, `class-types`) — demuestra consistencia con el estándar que ya tenés en `bookings`
2. **README completo** — es lo primero que ve un reclutador
3. **Filtro global de excepciones** — pulido de consistencia, bajo esfuerzo
4. Rate limiting y CSRF — buenos para mencionar como "roadmap futuro" en el README, no bloqueantes para portfolio
