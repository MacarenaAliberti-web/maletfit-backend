# Checklist de Revisión Integral — Backend MaletFit

Checklist previo a la integración con el frontend. Organizado por área, con el "por qué" de cada punto para que sirva también como referencia de buenas prácticas en tu portfolio.

---

## 1. Variables de entorno y configuración

- [ ] `.env` **no** está commiteado (verificar `.gitignore`)
- [ ] Existe un `.env.example` con todas las claves necesarias (sin valores reales) para que cualquiera pueda clonar el repo y saber qué configurar
- [ ] `DATABASE_URL` (pooled, puerto 6543) y `DIRECT_URL` (directa, puerto 5432) están ambas configuradas para Supabase
- [ ] `JWT_SECRET` es un valor largo y aleatorio (no un string simple tipo `"secret123"`) — generalo con `openssl rand -base64 32`
- [ ] `JWT_EXPIRES_IN` está definido explícitamente (ej. `"1d"`), no dejado en default
- [ ] Puerto de la app (`PORT`) parametrizado vía env, no hardcodeado en `main.ts`
- [ ] Configuración separada (o al menos documentada) para `development` vs `production`

---

## 2. CORS

- [ ] CORS habilitado explícitamente en `main.ts` con `app.enableCors()`
- [ ] En producción, el `origin` está restringido al dominio real del frontend (no `origin: '*'`) — importante mencionarlo en el README como decisión consciente de seguridad
- [ ] Si vas a usar cookies para auth en el futuro, `credentials: true` está considerado (no aplica si usás Bearer token en headers, que es tu caso actual)

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL, // en dev: http://localhost:3001
  credentials: true,
});
```

---

## 3. Manejo global de excepciones y validación

- [ ] `ValidationPipe` global configurado con `whitelist: true` (descarta propiedades no declaradas en el DTO) y `forbidNonWhitelisted: true` (rechaza el request si vienen propiedades extra, en vez de ignorarlas silenciosamente)
- [ ] `transform: true` activado para que los DTOs conviertan tipos automáticamente (ej. query params de string a number)
- [ ] Filtro global de excepciones (`HttpExceptionFilter` o similar) para que **todas** las respuestas de error tengan un formato JSON consistente (mismo shape en un 400, 401, 404, 500)
- [ ] Los mensajes de error no exponen detalles internos (stack traces, queries SQL) en producción

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

---

## 4. Swagger / OpenAPI

- [ ] `SwaggerModule` configurado en `main.ts`, accesible en `/api` o `/docs`
- [ ] Cada controller tiene `@ApiTags(...)` para agrupar endpoints por módulo
- [ ] Endpoints protegidos tienen `@ApiBearerAuth()` para que Swagger muestre el campo de token
- [ ] DTOs decorados con `@ApiProperty()` (incluyendo `description` y `example` donde ayude)
- [ ] Respuestas documentadas con `@ApiResponse({ status, description })` al menos en los casos de éxito y el error más relevante de cada endpoint (ej. 409 en bookings)
- [ ] Swagger **deshabilitado o protegido** en producción si el backend es público (opcional según tu caso, pero vale la pena decidirlo y documentarlo)

---

## 5. Autenticación, roles y seguridad

- [ ] `JwtAuthGuard` aplicado a todos los endpoints que lo requieren (revisar que ninguno haya quedado desprotegido por error)
- [ ] `RolesGuard` + `@Roles(...)` correctamente aplicado en endpoints administrativos (`/users`, creación de `Schedule`, etc.)
- [ ] Contraseñas hasheadas con `bcrypt` con un `saltRounds` razonable (10-12)
- [ ] El campo `password` **nunca** se serializa en ninguna respuesta — verificar con un `select` explícito en las queries de Prisma o un interceptor de exclusión global
- [ ] El JWT payload incluye solo lo necesario (`sub`, `email`, `role`) — nunca datos sensibles
- [ ] Rate limiting básico considerado para `/auth/login` (con `@nestjs/throttler`, aunque sea como mejora futura documentada) para mitigar fuerza bruta

---

## 6. Manejo de fechas y zonas horarias (crítico para Schedules/Bookings)

- [ ] Todas las fechas se almacenan en **UTC** en la base de datos (comportamiento por defecto de `DateTime` en Postgres/Prisma si no se fuerza timezone)
- [ ] El backend nunca asume la zona horaria del servidor para interpretar un `startTime` recibido del frontend — el frontend debe enviar el timestamp ya en formato ISO 8601 con offset (`2026-08-20T14:00:00.000Z`)
- [ ] Definida la estrategia de visualización: el frontend convierte UTC → hora local del usuario (con `Intl.DateTimeFormat` o `date-fns-tz`), el backend no hace esa conversión
- [ ] Validación de que `endTime` sea posterior a `startTime` en el DTO de `Schedule` (con un validador custom de `class-validator` o chequeo manual en el service)
- [ ] Si más adelante hay instructores en distintas zonas horarias, documentarlo como limitación conocida o mejora futura — no es necesario resolverlo ahora, pero vale nombrarlo

---

## 7. Integridad referencial en Prisma

- [ ] Revisar cada relación y decidir conscientemente el `onDelete` (no dejarlo en default sin pensarlo):
  - `Booking → User`: `onDelete: Cascade` (si se borra el usuario, se borran sus reservas) — revisar si en tu caso preferís `Restrict` para no perder historial
  - `Booking → Schedule`: `onDelete: Cascade` está bien si un turno se elimina físicamente, pero considerá si en la práctica preferís **soft delete** (`status: CANCELLED`) en vez de `DELETE` real, para conservar histórico de asistencia
  - `Instructor → User`: `onDelete: Cascade` es razonable
  - `RoutineExercise → Routine`: `onDelete: Cascade` correcto
- [ ] Constraint `@@unique([userId, scheduleId])` en `Booking` verificado y probado (evita doble reserva del mismo alumno al mismo turno)
- [ ] Índices en columnas de búsqueda frecuente: `Schedule.startTime`, `Booking.scheduleId` + `status` — ya los tenés en el schema, verificar que se hayan aplicado en la migración
- [ ] Si decidís pasar a **soft deletes** en `Schedule`/`Booking` (recomendado por el punto anterior), documentar esa decisión en el README como criterio de diseño

---

## 8. Calidad general y buenas prácticas

- [ ] Lint (`npm run lint`) y build (`npm run build`) corren sin errores antes de cada push
- [ ] Al menos un test unitario del `BookingsService`, incluyendo el caso de concurrencia (2 creates simultáneos sobre el último cupo)
- [ ] README principal del repo actualizado con: descripción del proyecto, stack, instrucciones de instalación, variables de entorno necesarias, y link a este checklist y a `THUNDER_CLIENT.md`
- [ ] Logs mínimos en operaciones críticas (creación de reserva, fallos de transacción) para poder debuggear en producción sin exponer datos sensibles

---

## Prioridad antes de arrancar el frontend

Si el tiempo apremia, estos son los puntos que **no deberías saltear**:

1. `password` nunca expuesto en respuestas (seguridad básica no negociable)
2. `ValidationPipe` con `whitelist` + `forbidNonWhitelisted` (evita bugs silenciosos)
3. CORS configurado explícitamente (o el frontend no va a poder conectarse)
4. Fechas en UTC consistentes (evita bugs de "la clase aparece a otra hora")
5. Constraint único en `Booking` + test de concurrencia (es el corazón técnico del proyecto)

El resto (Swagger completo, rate limiting, logs avanzados) podés iterarlo en paralelo mientras avanzás con el frontend, sin que bloquee el arranque.
