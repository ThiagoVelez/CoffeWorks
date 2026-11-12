# Diccionarios ortográficos

Diccionarios Hunspell que usa el corrector ortográfico de la suite (CoffeeDoc,
CoffeeView, CoffeeCalc, CoffeePDF, CoffeePage y CoffeeDataBase).

| Archivo | Idioma | Origen | Licencia |
|---|---|---|---|
| `es.aff`, `es.dic` | Español | [RLA-ES](https://github.com/sbosio/rla-es) vía [`dictionary-es`](https://github.com/wooorm/dictionaries) | GPL-3.0, LGPL-3.0 o MPL-1.1 (se usa MPL-1.1) |
| `en.aff`, `en.dic` | Inglés (EE. UU.) | [SCOWL](http://wordlist.aspell.net) vía [`dictionary-en`](https://github.com/wooorm/dictionaries) | MIT y BSD (ver `LICENSE-en.txt`) |

El instalador los deja en `packages\dictionaries` y el Launcher los copia a
`%LOCALAPPDATA%\CoffeeWorks\Dictionaries`, donde los leen todas las apps.
Las palabras que el usuario añade se guardan en `%APPDATA%\CoffeeWorks\diccionario-usuario.txt`.
