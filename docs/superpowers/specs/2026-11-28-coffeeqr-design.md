# CoffeeQR: diseño

Fecha: 2026-11-28 · Estado: aprobado por el usuario («A» para las imágenes; «Hazlo» al resumen).

## Para qué

Generador de códigos QR llamativos, en la categoría **Office** (junto a CoffeeDoc), para negocios y
personas: una tienda de plantas con hojas en su QR, el menú de un restaurante, el Wi-Fi de un café.
Lo pidió el usuario:

1. Diseños personalizados: módulos redondos y otras formas, y adornos temáticos (p. ej., hojas) que no impiden leerlo.
2. Cualquier color.
3. No solo enlaces: también imágenes como el menú de un restaurante.
4. Descargar con o sin fondo.
5. «Sorpréndeme».
6. Nombre **CoffeeQR**, en Office.

**Éxito:** en un minuto, alguien elige una plantilla de su negocio, pone su enlace o su Wi-Fi, ajusta
colores y adornos, ve el semáforo en verde y descarga un PNG/SVG/PDF que cualquier celular escanea.

## Decisiones

- **Imágenes y menús (opción A, elegida):** un QR no puede llevar una imagen dentro (máx. ~3 KB). La
  imagen o el PDF viven en un lugar del usuario (Google Drive, su web, Instagram…) y el QR lleva el
  enlace. CoffeeQR guía: explica cómo hacer público el archivo en Drive y reconoce enlaces de Drive.
  No hay servidores propios ni nada que caduque.
- **Todo sin internet**, en la app: el QR se genera aquí (qrcode-generator, MIT), se dibuja en SVG y
  se verifica con un lector incluido (jsQR, Apache-2.0).

## Qué hace

- **Contenido:** enlace; imagen o PDF alojado (enlace con guía); texto; Wi-Fi (`WIFI:`); contacto (vCard 3.0); WhatsApp (`wa.me`); correo (`mailto:`); teléfono; SMS; ubicación (Google Maps).
- **Formas de los módulos:** cuadrado, redondeado, puntos, gotas, diamantes, estrellas, barras verticales y horizontales (unidas), «líquido» (módulos vecinos fundidos).
- **Esquinas (ojos):** marco cuadrado, redondeado, círculo u hoja; centro cuadrado, punto, redondeado, hoja, diamante. Color propio opcional.
- **Color:** sólido o degradado (lineal con ángulo, o radial) en los módulos; fondo de color o transparente.
- **Adornos por tema** (dibujos originales en SVG): plantas, café, comida, música, ropa, mascotas, fiestas, salud y tecnología. Van en el centro (insignia) y/o alrededor (borde decorativo fuera de la zona de lectura). Logo propio en el centro (imagen). Lo del centro tapa como máximo ~15 % y el QR usa corrección H.
- **Marco con texto:** «Escanéame», «Ver el menú», «Wi-Fi gratis»… con su color y estilo.
- **Semáforo de lectura (sorpresa):** tras cada cambio, la app dibuja el QR y lo lee con jsQR en tamaño grande y en tamaño chico (como una foto); verde si lee bien en ambos y el contraste es suficiente, amarillo si es justo, rojo si no lee. Explica por qué (contraste, adorno, colores invertidos).
- **Plantillas por negocio (sorpresa):** tienda de plantas, restaurante (menú), cafetería (Wi-Fi), música/evento, tienda de ropa, veterinaria, consultorio, tecnología, fiesta.
- **Descargar:** PNG (512–4096 px) con o sin fondo, SVG, PDF para imprimir; **hoja de stickers** (sorpresa): PDF A4 con el QR repetido a un tamaño elegido.
- **Archivos:** documento `.cqr` (JSON con contenido y diseño) en la Bóveda, recientes y guardado automático, como las demás apps de Office.

## No objetivos

- QR dinámicos con estadísticas (necesitan un servidor).
- Subir archivos a internet.
- Leer QR con la cámara.

## Anti-objetivos

- Que se pueda descargar un QR que no se lee sin avisarlo claramente (semáforo rojo con explicación).
- Adornos copiados de marcas o de otras apps: todos los dibujos son originales.

## Integración

App Tauri `CoffeeQR/`, puerto **1445**, categoría **Office**, color **violeta índigo `#5f3dc4`**,
icono propio (un QR con esquinas redondas y una hoja), tema claro/oscuro de la suite, catálogo del
Launcher y «Nuevo documento», instalador, CI, README. Versión **2.18.0**.

## Pruebas

- Lógica pura (Node): textos de cada tipo de contenido (Wi-Fi con caracteres especiales, vCard, WhatsApp…), matriz del QR, SVG de cada forma/ojo/adorno.
- **Lectura real:** cada combinación de formas, ojos, degradados, adornos de cada tema, logo y marco se rasteriza (resvg en Node) y se lee con jsQR; debe devolver el contenido exacto.
- Navegador (Playwright): plantilla, cambiar forma y color, semáforo, descargar PNG sin fondo y SVG.
