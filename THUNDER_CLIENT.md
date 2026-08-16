# Guía de Pruebas — Thunder Client (MaletFit Backend)

Este documento describe el flujo de pruebas manuales para verificar los endpoints principales del backend de MaletFit: `Auth`, `Users`, `Schedules` y `Bookings`.

**Base URL (local):** `http://localhost:3000`

> 💡 Tip: en Thunder Client podés crear una variable de entorno `{{baseUrl}}` y otra `{{token}}` para no repetir valores en cada request.

---

## 1. Auth

### 1.1 Registro de usuario

| Campo    | Valor                            |
| -------- | -------------------------------- |
| Método   | `POST`                           |
| Endpoint | `{{baseUrl}}/auth/register`      |
| Headers  | `Content-Type: application/json` |

**Body (JSON):**

```json
{
  "email": "alumna@maletfit.com",
  "password": "ClaveSegura123!",
  "fullName": "Ana Torres"
}
```

**Respuesta esperada (201):**

```json
{
  "token":: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-generado",
    "email": "alumna@maletfit.com",
    "fullName": "Ana Torres",
    "role": "STUDENT"
  }
}
```

**Casos de error a probar:**

- Email duplicado → `409 Conflict`
- Password sin cumplir longitud mínima → `400 Bad Request`
- Campo `email` con formato inválido → `400 Bad Request`

---

### 1.2 Login

| Campo    | Valor                            |
| -------- | -------------------------------- |
| Método   | `POST`                           |
| Endpoint | `{{baseUrl}}/auth/login`         |
| Headers  | `Content-Type: application/json` |

**Body (JSON):**

```json
{
  "email": "alumna@maletfit.com",
  "password": "ClaveSegura123!"
}
```

**Respuesta esperada (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-generado",
    "email": "alumna@maletfit.com",
    "role": "STUDENT"
  }
}
```

> ✅ Guardá el `accessToken` en la variable `{{token}}` para usarlo en los siguientes requests.

**Casos de error a probar:**

- Credenciales incorrectas → `401 Unauthorized`
- Usuario inexistente → `401 Unauthorized` (nunca revelar si el email existe o no, por seguridad)

---

## 2. Users

### 2.1 Perfil propio

| Campo    | Valor                             |
| -------- | --------------------------------- |
| Método   | `GET`                             |
| Endpoint | `{{baseUrl}}/users/me`            |
| Headers  | `Authorization: Bearer {{token}}` |

**Respuesta esperada (200):**

```json
{
  "id": "uuid-generado",
  "email": "alumna@maletfit.com",
  "fullName": "Ana Torres",
  "role": "STUDENT"
}
```

> ⚠️ Verificar que la respuesta **nunca** incluya el campo `password`.

**Casos de error a probar:**

- Sin header `Authorization` → `401 Unauthorized`
- Token expirado o inválido → `401 Unauthorized`

---

### 2.2 Listado de usuarios (solo ADMIN)

| Campo    | Valor                                                           |
| -------- | --------------------------------------------------------------- |
| Método   | `GET`                                                           |
| Endpoint | `{{baseUrl}}/users`                                             |
| Headers  | `Authorization: Bearer {{token}}` (token de un usuario `ADMIN`) |

**Respuesta esperada (200):** array de usuarios.

**Casos de error a probar:**

- Token de un usuario `STUDENT` intentando acceder → `403 Forbidden` (verifica `RolesGuard`)

---

## 3. Schedules

### 3.1 Crear turno (ADMIN / INSTRUCTOR)

| Campo    | Valor                                                               |
| -------- | ------------------------------------------------------------------- |
| Método   | `POST`                                                              |
| Endpoint | `{{baseUrl}}/schedules`                                             |
| Headers  | `Authorization: Bearer {{token}}`, `Content-Type: application/json` |

**Body (JSON):**

```json
{
  "classTypeId": "uuid-del-class-type",
  "instructorId": "uuid-del-instructor",
  "startTime": "2026-08-20T14:00:00.000Z",
  "endTime": "2026-08-20T15:00:00.000Z",
  "capacity": 5
}
```

**Respuesta esperada (201):** objeto `Schedule` creado.

---

### 3.2 Listar turnos disponibles

| Campo    | Valor                             |
| -------- | --------------------------------- |
| Método   | `GET`                             |
| Endpoint | `{{baseUrl}}/schedules`           |
| Headers  | `Authorization: Bearer {{token}}` |

**Respuesta esperada (200):** array de `Schedule` con `classType` e `instructor` incluidos.

---

### 3.3 Ver disponibilidad de un turno

| Campo    | Valor                                    |
| -------- | ---------------------------------------- |
| Método   | `GET`                                    |
| Endpoint | `{{baseUrl}}/schedules/:id/availability` |
| Headers  | `Authorization: Bearer {{token}}`        |

**Respuesta esperada (200):**

```json
{
  "scheduleId": "uuid-del-schedule",
  "capacity": 5,
  "booked": 3,
  "available": 2
}
```

---

## 4. Bookings

### 4.1 Crear reserva

| Campo    | Valor                                                               |
| -------- | ------------------------------------------------------------------- |
| Método   | `POST`                                                              |
| Endpoint | `{{baseUrl}}/bookings`                                              |
| Headers  | `Authorization: Bearer {{token}}`, `Content-Type: application/json` |

**Body (JSON):**

```json
{
  "scheduleId": "uuid-del-schedule"
}
```

**Respuesta esperada (201):** objeto `Booking` con `status: "CONFIRMED"`.

**Casos de error a probar (crítico):**

- Reservar el mismo turno dos veces con el mismo usuario → `409 Conflict` (constraint `@@unique([userId, scheduleId])`)
- Reservar un turno con cupo lleno (5/5) → `409 Conflict`, mensaje `"No hay cupos disponibles para este turno"`
- **Prueba de concurrencia:** disparar 2-3 requests simultáneos contra el último cupo libre de un turno (podés abrir varias pestañas de Thunder Client o usar un script) y verificar que solo una reserva se confirme.

---

### 4.2 Ver mis reservas

| Campo    | Valor                              |
| -------- | ---------------------------------- |
| Método   | `GET`                              |
| Endpoint | `{{baseUrl}}/bookings/my-bookings` |
| Headers  | `Authorization: Bearer {{token}}`  |

**Respuesta esperada (200):** array de `Booking` con `schedule`, `classType` e `instructor` incluidos.

---

### 4.3 Cancelar reserva

| Campo    | Valor                             |
| -------- | --------------------------------- |
| Método   | `PATCH`                           |
| Endpoint | `{{baseUrl}}/bookings/:id/cancel` |
| Headers  | `Authorization: Bearer {{token}}` |

**Respuesta esperada (200):** objeto `Booking` actualizado con `status: "CANCELLED"`.

**Casos de error a probar:**

- Cancelar una reserva de otro usuario → `404 Not Found` (no revelar que la reserva existe pero pertenece a otro)
- Cancelar una reserva ya cancelada → definir comportamiento esperado (idempotente vs error)

---

## 5. Orden recomendado de ejecución del flujo completo

1. `POST /auth/register` (crear un ADMIN manualmente en la DB o vía seed)
2. `POST /auth/login` como ADMIN → guardar token
3. `POST /schedules` (crear un turno con capacity: 5)
4. `POST /auth/register` × 5 (crear 5 alumnos distintos)
5. Con cada alumno: `POST /bookings` sobre el mismo `scheduleId`
6. Verificar que el 6º intento de reserva devuelva `409 Conflict`
7. `GET /schedules/:id/availability` → debe mostrar `available: 0`
8. `PATCH /bookings/:id/cancel` con uno de los alumnos
9. `GET /schedules/:id/availability` → debe mostrar `available: 1`
