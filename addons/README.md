# Complementos de CoffeeWorks

Herramientas opcionales que no van en el instalador. El Launcher las descarga
desde **Complementos** en `%LOCALAPPDATA%\CoffeeWorks\Addons\<id>` y las
comparten todas las aplicaciones (catálogo en `crates/coffee-core/src/addons.rs`).

| Complemento | Para | Origen |
|---|---|---|
| `accdb` — Compatibilidad con Access | CoffeeDataBase | `addons/coffee-accdb` (este repositorio) |
| `ffmpeg` — Motor de video FFmpeg | CoffeeLive | builds públicos de FFmpeg |

## coffee-accdb

Programa de línea de órdenes basado en [Jackcess](https://jackcess.sourceforge.io)
y compilado con GraalVM `native-image`, así que no necesita Java.

```
coffee-accdb version
coffee-accdb export entrada.json salida.accdb   # o salida.mdb
```

La entrada (la genera CoffeeDataBase) describe tablas, columnas, filas y relaciones.
El flujo `.github/workflows/addons.yml` lo compila en Windows, lo prueba y, en
`main`, lo publica en la versión `addons` del repositorio.

Compilarlo a mano:

```bash
cd addons/coffee-accdb
mvn -q package
native-image --no-fallback -O2 -jar target/coffee-accdb.jar -o target/coffee-accdb
```

La configuración de `src/main/resources/META-INF/native-image` se generó con el
agente de GraalVM (`-agentlib:native-image-agent`).
