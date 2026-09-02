# Guía de Testing — MaletFit Backend

Este documento explica **qué son los tests unitarios, cómo funcionan las herramientas que usamos, y qué se testeó en cada módulo del proyecto** — pensado tanto como referencia rápida como para estudiarlo con más calma más adelante.

---

## Parte 1 — Conceptos base

### ¿Qué es un test unitario?

Un test unitario verifica que **una pieza pequeña y aislada de código** (en nuestro caso, un método de un `Service`) hace lo que se espera, **sin depender de sistemas externos reales** — sin conectarse a la base de datos, sin hacer llamadas HTTP reales, sin nada que pueda fallar por motivos ajenos a la lógica que estás probando.

La palabra clave es **aislado**: si `BookingsService.create()` fallara porque la base de datos de test no estaba levantada, ese no sería un test unitario fallando por un bug real — sería un problema de infraestructura disfrazado de bug. Por eso, en todos los módulos, **reemplazamos `PrismaService` por un mock** (un objeto falso que simula su comportamiento) en vez de conectarnos a Postgres de verdad.

### ¿Qué es un mock?

Un **mock** es un objeto que imita la forma de otro (en nuestro caso, `PrismaService`) pero cuyo comportamiento **vos controlás manualmente** dentro del test. En vez de que `prisma.schedule.findUnique(...)` golpee la base de datos real, el mock simplemente devuelve lo que vos le dijiste que devuelva:

```typescript
const mockPrismaService = {
  schedule: {
    findUnique: jest.fn(),
  },
};

// En el test:
mockPrismaService.schedule.findUnique.mockResolvedValue({
  id: 'schedule-1',
  capacity: 5,
});
```

`jest.fn()` crea una **función espía** — una función falsa que, además de poder devolver lo que le configures, **recuerda cómo fue llamada** (con qué argumentos, cuántas veces). Eso nos permite después verificar cosas como:

```typescript
expect(mockPrismaService.schedule.findUnique).toHaveBeenCalledWith({
  where: { id: 'schedule-1' },
});
```

Es decir: no solo comprobamos _qué devolvió_ el método que estamos testeando, sino _cómo interactuó_ con sus dependencias.

### La estructura de un test: `describe`, `it`, `expect`

```typescript
describe('SchedulesService', () => {
  // Agrupa todos los tests de este service
  describe('getAvailability', () => {
    // Agrupa los tests de un método específico
    it('debe lanzar NotFoundException si el turno no existe', async () => {
      // Un caso puntual
      // Arrange (preparar el escenario)
      mockPrismaService.schedule.findUnique.mockResolvedValue(null);

      // Act + Assert (ejecutar y verificar, juntos cuando esperamos un error)
      await expect(service.getAvailability('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

Este patrón se conoce como **AAA (Arrange — Act — Assert)**:

1. **Arrange:** preparás el escenario (qué va a devolver el mock)
2. **Act:** ejecutás el método que estás probando
3. **Assert:** verificás que el resultado (o el error) sea el esperado

Casi todos los tests del proyecto siguen esta estructura, aunque no siempre esté comentada explícitamente.

### `beforeEach` — resetear el estado entre tests

```typescript
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SchedulesService,
      { provide: PrismaService, useValue: mockPrismaService },
    ],
  }).compile();

  service = module.get<SchedulesService>(SchedulesService);
  jest.clearAllMocks();
});
```

Esto corre **antes de cada `it(...)`**, no una sola vez para todo el archivo. Es fundamental: si un test configuró `mockResolvedValue(null)` para simular "no existe", y el siguiente test no reseteara eso, heredaría esa configuración por accidente y podría dar un falso positivo o negativo. `jest.clearAllMocks()` borra el historial de llamadas y las configuraciones de cada mock antes de arrancar el siguiente test.

### `mockResolvedValue` vs `mockImplementation`

- **`mockResolvedValue(x)`**: la forma simple — "esta función async, cuando se llame, va a resolver con `x`". Usalo cuando el valor de retorno es siempre el mismo, sin importar los argumentos.
- **`mockImplementation((args) => {...})`**: la forma flexible — le das una función real que decide qué devolver _según los argumentos recibidos_. La usamos, por ejemplo, en el test de concurrencia de `bookings`, donde el mock necesita simular un contador que cambia según cuántas reservas ya se crearon.

### `toEqual` vs `toHaveBeenCalledWith`

- **`expect(result).toEqual(x)`**: verifica el **valor de retorno** del método testeado.
- **`expect(mock).toHaveBeenCalledWith(x)`**: verifica **cómo se llamó** a una dependencia (el mock). Esto es clave cuando el comportamiento importante no es el retorno final, sino la query exacta que se le mandó a Prisma — por ejemplo, confirmar que `create()` convierte un string ISO a un objeto `Date` antes de guardarlo.

---

## Parte 2 — Por qué probamos condiciones de carrera de forma especial

El caso de `bookings.service.spec.ts` merece su propia sección porque tiene el patrón más avanzado del proyecto.

### El problema que se está probando

Cuando dos usuarios reservan el **mismo turno al mismo tiempo**, y solo queda 1 cupo libre, existe el riesgo de que ambas requests "vean" el mismo estado (4 de 5 cupos ocupados) antes de que ninguna termine de escribir — y las dos terminen confirmando su reserva, superando la capacidad máxima. Este es el problema de fondo que resolvimos con `isolationLevel: 'Serializable'` + reintentos ante el error `P2034` de Prisma (ver el propio `bookings.service.ts` para el detalle de la implementación).

### Por qué el mock de `$transaction` necesitó un diseño especial

En los tests de "8 solicitudes simultáneas", el mock de `$transaction` **encola las llamadas** para simular que se ejecutan de a una (no realmente en paralelo). Esto es una limitación consciente: un mock en memoria de JavaScript no puede replicar fielmente el comportamiento real del motor de PostgreSQL bajo `Serializable` — eso solo se puede probar con una base de datos real (un test de integración, no unitario).

**Lo que sí logramos probar con el mock:**

- Que la _lógica de negocio_ (contar reservas confirmadas, comparar contra la capacidad, decidir `CONFIRMED` vs `WAITLIST`) es correcta cuando las operaciones llegan de a una.
- Que el mecanismo de reintento realmente se dispara cuando Prisma devuelve el código de error `P2034` (simulado explícitamente en un test dedicado).
- Que `$transaction` se llama con `{ isolationLevel: 'Serializable' }` — si alguien borrara accidentalmente ese segundo argumento en el código real, este test lo detectaría.

**Lo que NO prueba (y por qué eso está bien):** la condición de carrera _real_ entre dos transacciones de Postgres compitiendo por el mismo recurso. Eso requeriría un test de integración contra una base de datos de verdad (por ejemplo, con Docker), algo que documentamos como mejora futura en `BACKEND_CHECKLIST.md`, no como una carencia oculta.

---

## Parte 3 — Detalle de lo que se testeó en cada módulo

### `bookings.service.spec.ts`

- Asignación de `CONFIRMED` cuando hay cupo disponible
- Asignación automática de `WAITLIST` cuando el turno está lleno
- Rechazo (`ConflictException`) si el usuario ya tiene una reserva activa o en espera para ese turno
- Distribución correcta de 8 solicitudes → 5 `CONFIRMED` + 3 `WAITLIST` (lógica de negocio, no concurrencia real — ver Parte 2)
- Reintento automático ante un error de serialización (`P2034`) de Prisma
- Ascenso automático del primero en `WAITLIST` al cancelarse una reserva `CONFIRMED`
- Que **no** se busque en la lista de espera si la reserva cancelada no estaba `CONFIRMED`
- Que no se intente ascender a nadie si no había nadie esperando

### `schedules.service.spec.ts`

- `create()`: conversión correcta de fechas string → `Date`, y el valor por defecto de `capacity` (5) cuando no se especifica
- `findMySchedules()`: resolución del `Instructor.id` real a partir del `userId` del JWT (y el error si no existe perfil de instructor)
- `getAvailability()`: cálculo de cupos disponibles, y que nunca sea negativo aunque el turno esté sobre-reservado
- `getRoster()`: separación correcta entre `confirmed` (incluyendo `ATTENDED`/`NO_SHOW`) y `waitlist`

### `class-types.service.spec.ts`

- `findAll()` y `create()` — el módulo más simple del proyecto, sin lógica de negocio más allá de pasar datos a Prisma. El test cubre el caso con y sin el campo opcional `description`.

### `instructors.service.spec.ts`

- `findAll()`: que la consulta incluya los datos del `User` asociado (crítico para resolver `Instructor.id` vs `User.id` en el frontend)
- `findMyProfile()`: éxito y el caso de "no tiene perfil de instructor" (`NotFoundException`)

### `routines.service.spec.ts`

- `create()`: armado correcto de los ejercicios anidados, con `orderIndex` automático (según posición en el array) o respetando el valor explícito si viene en el DTO
- `findOne()`: la matriz completa de permisos — dueño, `ADMIN`, `INSTRUCTOR` pueden ver la rutina; otro alumno no (`ForbiddenException`); rutina inexistente (`NotFoundException`)
- `update()`: que **no** se toquen los ejercicios existentes si el update no incluye `exercises`, y que si se incluyen, se borren y recreen todos (la decisión de diseño "reemplazo total" en vez de un diff fino)
- `remove()`: éxito y el caso de rutina inexistente

---

## Cómo correr los tests

```bash
# Todos los tests del proyecto
npm test

# Solo un módulo específico
npm test -- bookings
npm test -- schedules
npm test -- routines

# Con reporte de cobertura
npm run test:cov
```

## Lo que queda como mejora futura (no implementado)

- **Tests de integración reales** contra una base de datos de test (Docker + Postgres), para probar la condición de carrera de `bookings` de forma genuina, no solo la lógica de negocio con mocks.
- **Tests e2e** (end-to-end) que levanten la app completa y prueben flujos HTTP reales de punta a punta, en vez de testear cada `Service` de forma aislada.
- Cobertura de los `Controller` en sí (hoy los tests son solo de la capa de `Service` — los `Controller` son delgados y delegan todo al service, por lo que el riesgo de bugs ahí es bajo, pero no está formalmente cubierto).
