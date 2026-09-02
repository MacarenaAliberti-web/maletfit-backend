# Guía de Pruebas — Thunder Client (MaletFit Backend)

Este documento describe el flujo de pruebas manuales para verificar los endpoints del backend de MaletFit: `Auth`, `Users`, `Instructors`, `ClassTypes`, `Schedules`, `Bookings` y `Routines`.

**Base URL (local):** `http://localhost:3000`

> 💡 Tip: en Thunder Client podés crear una variable de entorno `{{baseUrl}}` para no repetir el host en cada request. La autenticación es vía **cookie httpOnly** (no Bearer token) — una vez que hacés login en una pestaña de Thunder Client, la cookie viaja sola en los requests siguientes de esa misma pestaña.

---

## 1. Auth

### 1.1 Registro

| Campo    | Valor                       |
| -------- | --------------------------- |
| Método   | `POST`                      |
| Endpoint | `{{baseUrl}}/auth/register` |

**Body:**

```json
{
  "email": "alumna@maletfit.com",
  "password": "ClaveSegura123!",
  "fullName": "Ana Torres"
}
```

**Respuesta esperada (201):** `{ "user": { id, email, fullName, role: "STUDENT" } }`, con la cookie `jwt` seteada (httpOnly) en la respuesta — no aparece en el body.

### 1.2 Login

| Campo    | Valor                    |
| -------- | ------------------------ |
| Método   | `POST`                   |
| Endpoint | `{{baseUrl}}/auth/login` |

**Body:**

```json
{
  "email": "alumna@maletfit.com",
  "password": "ClaveSegura123!"
}
```

**Respuesta esperada (200):** `{ "user": {...} }`, cookie `jwt` seteada.

### 1.3 Logout

| Campo    | Valor                     |
| -------- | ------------------------- |
| Método   | `POST`                    |
| Endpoint | `{{baseUrl}}/auth/logout` |

**Respuesta esperada (200):** limpia la cookie `jwt`.

---

## 2. Users

### 2.1 Perfil propio

`GET {{baseUrl}}/users/me` — cualquier rol autenticado. Nunca debe incluir `password` en la respuesta.

### 2.2 Listado completo (solo ADMIN)

`GET {{baseUrl}}/users` — devuelve todos los usuarios con `id`, `email`, `fullName`, `role`, `createdAt`.

### 2.3 Listado de alumnos (ADMIN / INSTRUCTOR)

`GET {{baseUrl}}/users/students` — devuelve solo usuarios `STUDENT`, con `id`, `fullName`, `email` (sin `password`).

### 2.4 Cambiar rol de un usuario (solo ADMIN)

| Campo    | Valor                        |
| -------- | ---------------------------- |
| Método   | `PATCH`                      |
| Endpoint | `{{baseUrl}}/users/:id/role` |

**Body:**

```json
{ "role": "INSTRUCTOR" }
```

**Casos a probar:**

- Rol válido (`ADMIN` / `INSTRUCTOR` / `STUDENT`) → `200`, y si el nuevo rol es `INSTRUCTOR`, se crea automáticamente el perfil en la tabla `Instructor` si no existía.
- Rol inválido (ej. `"COSA"`) → `400` (`@IsEnum`).
- Un admin intentando cambiar su propio rol → `400` (`"No podés cambiar tu propio rol"`).
- Un `STUDENT`/`INSTRUCTOR` intentando este endpoint → `403`.

---

## 3. Instructors

### 3.1 Listado completo (ADMIN / INSTRUCTOR)

`GET {{baseUrl}}/instructors` — cada item incluye `id` (el `Instructor.id`, distinto del `User.id`) y `user: { id, fullName, email }`.

### 3.2 Mi propio perfil de instructor

`GET {{baseUrl}}/instructors/me` — logueado como `INSTRUCTOR`. Devuelve `404` si el usuario no tiene perfil de `Instructor` asociado (por ejemplo, un `ADMIN` que nunca fue promovido).

---

## 4. ClassTypes

### 4.1 Listado (cualquier rol autenticado)

`GET {{baseUrl}}/class-types`

### 4.2 Crear (solo ADMIN)

| Campo    | Valor                     |
| -------- | ------------------------- |
| Método   | `POST`                    |
| Endpoint | `{{baseUrl}}/class-types` |

**Body:**

```json
{
  "name": "Crossfit",
  "description": "Entrenamiento funcional de alta intensidad",
  "durationMin": 45
}
```

**Casos de error a probar:**

- `durationMin` en `0` o negativo → `400`
- `name` vacío o ausente → `400`
- Campo extra no declarado en el DTO (ej. `foo: "bar"`) → `400` (`forbidNonWhitelisted`)
- Un `STUDENT`/`INSTRUCTOR` intentando crear → `403`

---

## 5. Schedules

### 5.1 Crear turno (ADMIN / INSTRUCTOR)

| Campo    | Valor                   |
| -------- | ----------------------- |
| Método   | `POST`                  |
| Endpoint | `{{baseUrl}}/schedules` |

**Body:**

```json
{
  "classTypeId": "uuid-del-class-type",
  "instructorId": "uuid-del-instructor",
  "startTime": "2026-09-20T14:00:00.000Z",
  "endTime": "2026-09-20T15:00:00.000Z",
  "capacity": 5
}
```

> ⚠️ `instructorId` es el `Instructor.id` (de `GET /instructors` o `/instructors/me`), **no** el `User.id`.

### 5.2 Listar todos los turnos

`GET {{baseUrl}}/schedules` — cualquier rol. Incluye `classType`, `instructor.user`, y `_count.bookings` (reservas `CONFIRMED`).

### 5.3 Mis turnos (INSTRUCTOR / ADMIN)

`GET {{baseUrl}}/schedules/my-schedules` — solo los turnos donde `instructorId` coincide con el perfil de instructor del usuario logueado.

### 5.4 Disponibilidad de un turno

`GET {{baseUrl}}/schedules/:id/availability` → `{ scheduleId, capacity, occupiedSeats, availableSeats, isFull }`

### 5.5 Roster de un turno (INSTRUCTOR / ADMIN)

`GET {{baseUrl}}/schedules/:id/roster` → `{ scheduleId, confirmed: [...], waitlist: [...] }`, cada entrada con `user: { id, fullName, email }`.

---

## 6. Bookings

### 6.1 Crear reserva

`POST {{baseUrl}}/bookings` con `{ "scheduleId": "..." }`.

**Casos a probar (crítico — condiciones de carrera):**

- Cupo disponible → `status: "CONFIRMED"`
- Cupo lleno → `status: "WAITLIST"` (no rechaza la request, asigna lista de espera)
- Mismo alumno reservando el mismo turno dos veces → `409 Conflict`
- **Prueba de concurrencia:** disparar varios requests simultáneos contra el último cupo libre de un turno de capacidad 5 (con 8 alumnos de prueba) → exactamente 5 `CONFIRMED` y el resto `WAITLIST`, sin sobreturnos.

### 6.2 Mis reservas

`GET {{baseUrl}}/bookings/my-bookings` — incluye `schedule` completo (con `classType` e `instructor.user`).

### 6.3 Cancelar reserva

`PATCH {{baseUrl}}/bookings/:id/cancel` — si la reserva cancelada estaba `CONFIRMED`, asciende automáticamente al primero en `WAITLIST` (por orden de creación).

### 6.4 Marcar asistencia (ADMIN / INSTRUCTOR)

| Campo    | Valor                                 |
| -------- | ------------------------------------- |
| Método   | `PATCH`                               |
| Endpoint | `{{baseUrl}}/bookings/:id/attendance` |

**Body:**

```json
{ "status": "ATTENDED" }
```

Valores válidos: `"ATTENDED"` o `"NO_SHOW"` únicamente. Puede llamarse varias veces sobre la misma reserva para corregir una marca anterior.

---

## 7. Routines

### 7.1 Crear rutina (ADMIN / INSTRUCTOR)

| Campo    | Valor                  |
| -------- | ---------------------- |
| Método   | `POST`                 |
| Endpoint | `{{baseUrl}}/routines` |

**Body:**

```json
{
  "userId": "uuid-del-alumno",
  "title": "Rutina de fuerza - Semana 1",
  "notes": "Enfocado en tren superior, 3 veces por semana",
  "exercises": [
    { "name": "Press de banca", "sets": 4, "reps": 10, "weightKg": 40 },
    { "name": "Remo con barra", "sets": 4, "reps": 12 }
  ]
}
```

`userId` es el `User.id` del alumno (no el `Instructor.id`). Requiere al menos 1 ejercicio.

### 7.2 Mis rutinas (el propio alumno)

`GET {{baseUrl}}/routines/my-routines`

### 7.3 Todas las rutinas (ADMIN / INSTRUCTOR)

`GET {{baseUrl}}/routines` — incluye `user: { id, fullName, email }` de cada alumno.

### 7.4 Ver una rutina puntual

`GET {{baseUrl}}/routines/:id` — el propio alumno dueño, o `ADMIN`/`INSTRUCTOR`. Otro alumno intentando ver una rutina ajena → `403`.

### 7.5 Editar rutina (ADMIN / INSTRUCTOR)

`PATCH {{baseUrl}}/routines/:id` — mismo shape que el create, todos los campos opcionales. Si se manda `exercises`, reemplaza todos los ejercicios existentes.

### 7.6 Eliminar rutina (ADMIN / INSTRUCTOR)

`DELETE {{baseUrl}}/routines/:id`

---

## 8. Flujo end-to-end sugerido

1. `POST /auth/register` × 3 (un futuro admin, un instructor, un alumno) — o promoví uno existente con `PATCH /users/:id/role`
2. Como `ADMIN`: `POST /class-types`, luego `GET /instructors` para conseguir un `Instructor.id`
3. Como `ADMIN` o `INSTRUCTOR`: `POST /schedules` con capacity: 5
4. `POST /auth/register` × 6 alumnos de prueba
5. Con cada alumno: `POST /bookings` sobre el mismo `scheduleId` → confirmar 5 `CONFIRMED` + 1 `WAITLIST`
6. `PATCH /bookings/:id/cancel` sobre uno de los `CONFIRMED` → confirmar que el de `WAITLIST` pasa a `CONFIRMED`
7. Como `INSTRUCTOR`: `GET /schedules/:id/roster`, luego `PATCH /bookings/:id/attendance`
8. Como `ADMIN`/`INSTRUCTOR`: `POST /routines` para uno de los alumnos, luego `PATCH /routines/:id` para editarla
9. Como el alumno: `GET /routines/my-routines` → confirmar que ve la rutina actualizada
