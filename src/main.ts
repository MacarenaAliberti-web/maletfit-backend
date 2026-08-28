import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // Falla ruidosamente si falta la variable, en vez de arrancar
  // en silencio con un secreto hardcodeado e inseguro.
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET no está definida en las variables de entorno. La app no puede arrancar sin ella.',
    );
  }

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('MaletFit API')
    .setDescription('API Backend para la gestión de turnos y reservas en gimnasio')
    .setVersion('1.0')

    //Esto describe el flujo de Bearer token en header — pero migraste hace varias conversaciones a cookies httpOnly. Tu /auth/login ya no devuelve el token en el body para que alguien lo "ingrese" en Swagger; la cookie se setea automáticamente. Este addBearerAuth está describiendo un mecanismo de auth que tu API real ya no usa — cualquiera que pruebe tu API por primera vez desde /api/docs y siga esta instrucción se va a confundir, porque no hay ningún token que copiar del body de la respuesta.

    //No lo cambio ahora para no mezclar dos refactors en la misma pasada — pero anotalo como pendiente: cuando llegues a la tarea de "pulir Swagger" en tu roadmap, esa sección de DocumentBuilder necesita actualizarse para reflejar que la auth es vía cookie, no vía header (Swagger UI tiene soporte para documentar cookies también, aunque probar cookies httpOnly desde la interfaz de Swagger tiene sus propias limitaciones que vale la pena investigar en su momento).




    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa el token JWT obtenido en /auth/login',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();