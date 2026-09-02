# MaletFit 🏋️

**Plataforma de gestión de turnos, reservas y rutinas para gimnasios**, desarrollada como proyecto de portfolio full stack.

MaletFit resuelve un problema real de negocio: gestionar clases grupales con cupo limitado (máximo 5 alumnos por turno), evitando sobreturnos incluso bajo reservas simultáneas, con lista de espera automática, seguimiento de asistencia y rutinas de entrenamiento personalizadas por instructor.

---

## Stack técnico

| Capa          | Tecnología                                                   |
| ------------- | ------------------------------------------------------------ |
| Frontend      | Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI |
| Backend       | NestJS, TypeScript                                           |
| ORM           | Prisma                                                       |
| Base de datos | PostgreSQL (Supabase), con Row-Level Security habilitado     |
| Autenticación | JWT en cookies httpOnly (no localStorage)                    |
| Testing       | Jest                                                         |

---

## Roles y funcionalidades

El sistema tiene 3 roles con dashboards independientes:

### 👤 Alumno

- Ver clases disponibles con cupos en tiempo real
- Reservar un turno (cae automáticamente en lista de espera si está lleno)
- Ver y cancelar sus propias reservas
- Ver las rutinas de entrenamiento que le asignó su instructor

### 🏋️ Instructor

- Programar sus propios turnos
- Ver el roster de anotados por turno (confirmados y en lista de espera)
- Marcar asistencia (presente / ausente), con posibilidad de corregir una marca anterior
- Crear y editar rutinas de entrenamiento para cualquier alumno

### 🛠️ Administrador

- Todo lo del instructor, sin restricción de "solo mis turnos"
- Gestión de tipos de clase (disciplinas)
- Gestión de usuarios: cambio de roles, con creación automática del perfil de instructor al promover a alguien

---

## Decisiones técnicas destacadas

### Condiciones de carrera en las reservas

El requisito central del proyecto — nunca superar el cupo máximo de una clase, ni siquiera con reservas simultáneas — se resuelve con transacciones de PostgreSQL en `isolationLevel: 'Serializable'`, combinadas con un mecanismo de reintento automático ante el código de error `P2034` (conflicto de serialización) que devuelve Prisma cuando dos transacciones concurrentes chocan.

```typescript
private async runSerializableTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await this.prisma.$transaction(fn, { isolationLevel: 'Serializable' });
        } catch (error) {
            const isSerializationError =
                error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
            if (isSerializationError && attempt < MAX_RETRIES) continue;
            throw error;
        }
    }
    throw new Error('No se pudo completar la operación tras reintentos');
}
```

Cuando un turno se llena, la reserva no se rechaza: se asigna automáticamente a `WAITLIST`. Al cancelarse una reserva confirmada, el primero en la lista de espera asciende automáticamente (por orden de llegada), dentro de la misma protección transaccional.

### Autenticación con cookies httpOnly

El JWT no vive en `localStorage` ni se envía por header `Authorization` — se setea como cookie httpOnly desde el backend, inaccesible para JavaScript del lado del cliente. Esto mitiga el vector de robo de token vía XSS, a costa de tener que resolver CORS con `credentials: true` y reenviar la cookie manualmente en los fetches que corren en Server Components de Next.js (que no tienen el mismo comportamiento automático que el navegador).

### `Instructor.id` vs `User.id`

Un error real que surgió durante el desarrollo: un `Instructor` es una entidad propia en el modelo de datos (con su propio `id`, relacionada 1 a 1 con `User`), no simplemente un `User` con un rol distinto. Confundir ambos IDs generaba errores de foreign key al crear turnos. La solución final incluye un endpoint dedicado (`GET /instructors/me`) para que el frontend siempre resuelva el ID correcto sin adivinar.

### Roles gestionables desde la app, con consistencia garantizada

Cambiar el rol de un usuario a `INSTRUCTOR` no solo actualiza el campo `role` — crea automáticamente su perfil en la tabla `Instructor` si no existía, dentro de una transacción (para que ambos cambios se apliquen juntos o ninguno). También se previene que un admin se quite accidentalmente su propio rol de administrador (protección de auto-lockout, validada tanto en frontend como en backend).

---

## Estructura del proyecto

```
maletfit-backend/
├── src/
│   ├── auth/          # JWT en cookies httpOnly, guards, roles
│   ├── users/          # Perfil, listado, gestión de roles
│   ├── instructors/    # Perfil de instructor (distinto de User)
│   ├── class-types/    # Disciplinas / tipos de clase
│   ├── schedules/      # Turnos, disponibilidad, roster
│   ├── bookings/       # Reservas, lista de espera, asistencia
│   ├── routines/       # Rutinas de entrenamiento
│   └── prisma/         # Cliente Prisma como módulo global
└── prisma/schema.prisma

maletfit-frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/     # Login, registro
│   │   ├── admin/      # Dashboard admin
│   │   ├── instructor/ # Dashboard instructor
│   │   └── student/    # Dashboard alumno
│   ├── components/dashboard/
│   │   ├── shared/     # Componentes reusados entre roles (rutinas, roster)
│   │   ├── admin/
│   │   └── instructor/
│   ├── services/       # Llamadas HTTP desde el cliente (Axios)
│   ├── lib/             # Helpers de servidor (fetch autenticado en Server Components)
│   ├── context/         # AuthContext
│   └── types/           # Tipos compartidos, alineados 1:1 con las respuestas del backend
```

---

## Testing

Todos los módulos del backend tienen cobertura de tests unitarios (Jest), incluyendo el caso más sensible del proyecto: la simulación de 8 solicitudes de reserva simultáneas sobre un turno de capacidad 5, verificando que exactamente 5 queden `CONFIRMED` y el resto en `WAITLIST`.

Ver [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) para el detalle completo de qué se testea en cada módulo y por qué.

```bash
npm test              # todos los tests
npm test -- bookings   # un módulo puntual
npm run test:cov       # con reporte de cobertura
```

---

## Setup local

### Backend

```bash
cd maletfit-backend
npm install
# Configurar .env (ver .env.example): DATABASE_URL, DIRECT_URL, JWT_SECRET, FRONTEND_URL
npx prisma migrate dev
npm run start:dev
```

Documentación interactiva de la API disponible en `http://localhost:3000/api/docs` una vez levantado.

### Frontend

```bash
cd maletfit-frontend
npm install
# Configurar .env.local: NEXT_PUBLIC_API_URL=http://localhost:3000
npm run dev
```

---

## Roadmap / mejoras futuras

- Sistema de comentarios del alumno hacia el instructor sobre una rutina asignada
- Campo `assignedById` en `Routine` para distinguir qué instructor asignó cada rutina
- Protección CSRF explícita (hoy mitigada parcialmente por `sameSite: 'lax'`)
- Rate limiting en `/auth/login`
- Tests de integración reales contra una base de datos de test, para validar la condición de carrera con concurrencia genuina (no solo la lógica de negocio con mocks)
- Soft delete para `Schedule`/`Booking`, preservando historial de asistencia
