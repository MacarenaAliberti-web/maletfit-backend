# 🏋️‍♂️ MaletFit — API Backend

Backend para la plataforma de gestión de turnos, clases y reservas en gimnasio y centros deportivos. Construido con arquitectura modular en NestJS, TypeScript y Prisma ORM.

---

## 🚀 Tecnologías & Stack

* **Framework:** NestJS (Node.js)
* **Lenguaje:** TypeScript
* **Base de Datos:** PostgreSQL (vía Supabase)
* **ORM:** Prisma ORM
* **Autenticación:** Passport JWT + Bcrypt
* **Documentación:** Swagger / OpenAPI
* **Pruebas de API:** Thunder Client

---

## 📋 Módulos Principales

* **Auth:** Registro, Login e integración con tokens JWT.
* **Users:** Perfil de usuario (`/users/me`) y gestión con control de acceso por roles (`RolesGuard`).
* **Schedules:** Creación y consulta de turnos de clases con capacidad delimitada y verificación de disponibilidad.
* **Bookings:** Lógica de reservas atómicas (`$transaction`) con control estricto de cupo, prevención de duplicados y cancelación (*soft delete*).

---

## 📚 Documentación Adjunta

* 📜 **[Guía de Pruebas Thunder Client](./THUNDER_CLIENT.md):** Flujo paso a paso para probar los endpoints, incluyendo la simulación de concurrencia.
* ✅ **[Checklist de Revisión Backend](./BACKEND_CHECKLIST.md):** Lista de verificación de arquitectura, seguridad y buenas prácticas.
* 📄 **Swagger UI:** Accesible localmente en `http://localhost:3000/api/docs`.

---

## 🛠️ Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/MacarenaAliberti-web/maletfit-backend.git](https://github.com/MacarenaAliberti-web/maletfit-backend.git)
   cd maletfit-backend
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**  
   Crea un archivo `.env` en la raíz con las siguientes claves:
   ```env
   PORT=3000
   DATABASE_URL="tu_database_url_de_supabase"
   DIRECT_URL="tu_direct_url_de_supabase"
   JWT_SECRET="tu_secreto_jwt_seguro"
   JWT_EXPIRES_IN="1d"
   ```

4. **Ejecutar migraciones/esquema de Prisma:**
   ```bash
   npx prisma db push
   ```

5. **Iniciar en modo desarrollo:**
   ```bash
   npm run start:dev
   ```

---

## 👩‍💻 Autora

* **Macarena Aliberti** — *Desarrollo Full Stack*
* **GitHub:** [@MacarenaAliberti-web](https://github.com/MacarenaAliberti-web)
* **LinkedIn:** https://www.linkedin.com/in/macarena-aliberti-440b03373/
