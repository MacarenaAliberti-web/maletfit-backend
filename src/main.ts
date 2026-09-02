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
    .setDescription(
      'API Backend para la gestión de turnos y reservas en gimnasio.\n\n' +
      'Autenticación: esta API usa cookies httpOnly (no Bearer token). ' +
      'Para probar endpoints protegidos desde esta interfaz, primero iniciá sesión ' +
      'en /auth/login desde el mismo navegador — la cookie viaja automáticamente ' +
      'en las siguientes requests que hagas desde acá.',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();