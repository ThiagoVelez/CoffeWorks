// Plantillas de documento para CoffeeLatex (LaTeX y Markdown).

import type { Modo } from "./insertar";

export interface Plantilla {
  id: "informe" | "taller" | "articulo" | "blanco" | "md-blanco" | "md-notas";
  nombre: string;
  descripcion: string;
  modo: Modo;
  contenido: string;
}

const PREAMBULO = `\\documentclass[11pt,a4paper]{article}
\\usepackage[spanish]{babel}
\\usepackage{fontspec}
\\usepackage{amsmath,amssymb}
\\usepackage{siunitx}
\\usepackage{graphicx}
\\usepackage[margin=2.5cm]{geometry}
\\sisetup{output-decimal-marker={,}}
`;

const INFORME = `${PREAMBULO}
\\title{Informe de laboratorio: caída libre}
\\author{Nombre Apellido \\\\ Física Mecánica}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Objetivos}
Determinar experimentalmente la aceleración de la gravedad $g$ midiendo el tiempo de caída de un objeto desde distintas alturas.

\\section{Marco teórico}
Un cuerpo que cae libremente desde el reposo recorre una distancia
\\begin{equation}
  h = \\frac{1}{2} g t^2 ,
  \\label{eq:caida}
\\end{equation}
de modo que, despejando, $g = 2h/t^2$.

\\section{Procedimiento}
\\begin{enumerate}
  \\item Medir la altura $h$ con una cinta métrica.
  \\item Soltar el objeto y medir el tiempo $t$ con el cronómetro.
  \\item Repetir cinco veces para cada altura.
\\end{enumerate}

\\section{Resultados}
\\begin{table}[h]
\\centering
\\begin{tabular}{|c|c|c|}
\\hline
$h$ (m) & $t$ (s) & $g$ (m/s$^2$) \\\\
\\hline
1{,}00 & 0{,}45 & 9{,}88 \\\\
1{,}50 & 0{,}55 & 9{,}92 \\\\
\\hline
\\end{tabular}
\\caption{Tiempos medidos y valor de $g$ con la ecuación \\ref{eq:caida}.}
\\end{table}

\\section{Conclusiones}
El valor obtenido, $g \\approx 9{,}9\\ \\mathrm{m/s^2}$, se acerca al valor de referencia.

\\end{document}
`;

const TALLER = `${PREAMBULO}
\\title{Taller: cinemática y dinámica}
\\author{Nombre Apellido}
\\date{\\today}

\\begin{document}
\\maketitle

\\section*{Ejercicio 1}
Un bloque de masa $m = 2\\ \\mathrm{kg}$ se empuja con una fuerza $F = 10\\ \\mathrm{N}$ sobre una superficie sin fricción. ¿Cuál es su aceleración?

\\textbf{Solución.} Por la segunda ley de Newton,
\\[
  a = \\frac{F}{m} = \\frac{10\\ \\mathrm{N}}{2\\ \\mathrm{kg}} = 5\\ \\mathrm{m/s^2}.
\\]

\\section*{Ejercicio 2}
Un auto parte del reposo con aceleración constante $a = 3\\ \\mathrm{m/s^2}$. ¿Qué distancia recorre en $4\\ \\mathrm{s}$?

\\textbf{Solución.}
\\begin{align*}
  x &= v_0 t + \\tfrac{1}{2} a t^2 \\\\
    &= 0 + \\tfrac{1}{2}(3)(4)^2 = 24\\ \\mathrm{m}.
\\end{align*}

\\end{document}
`;

const ARTICULO = `${PREAMBULO}
\\title{Título del artículo}
\\author{Autora Uno \\and Autor Dos}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Resumen breve del trabajo: el problema, el método y el resultado principal.
\\end{abstract}

\\section{Introducción}
Contexto del problema y trabajos previos \\cite{newton1687}.

\\section{Método}
Describa el modelo. Por ejemplo, la energía mecánica se conserva:
\\begin{equation}
  E = \\frac{1}{2} m v^2 + m g h .
\\end{equation}

\\section{Resultados}
Presente los resultados con tablas y figuras.

\\section{Conclusiones}
Lo que se aprendió y lo que queda por hacer.

\\begin{thebibliography}{9}
\\bibitem{newton1687} I. Newton, \\emph{Philosophiæ Naturalis Principia Mathematica}, 1687.
\\end{thebibliography}

\\end{document}
`;

const BLANCO = `${PREAMBULO}
\\title{Documento}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introducción}


\\end{document}
`;

const MD_BLANCO = `# Documento

Escriba aquí. Las fórmulas van entre signos de dólar: $F = m a$.
`;

const MD_NOTAS = `# Notas de clase: movimiento rectilíneo

## Ideas clave

- La **velocidad** es el cambio de posición en el tiempo: $v = \\dfrac{dx}{dt}$.
- La **aceleración** es el cambio de velocidad: $a = \\dfrac{dv}{dt}$.

## Ecuaciones con aceleración constante

$$
x = x_0 + v_0 t + \\frac{1}{2} a t^2
$$

$$
v^2 = v_0^2 + 2 a (x - x_0)
$$

## Por repasar

1. Ejercicios 3 al 7.
2. Gráficas de $x(t)$ y $v(t)$.
`;

export const PLANTILLAS: Plantilla[] = [
  { id: "informe", nombre: "Informe de laboratorio", descripcion: "Objetivos, marco teórico, procedimiento, resultados y conclusiones", modo: "latex", contenido: INFORME },
  { id: "taller", nombre: "Taller o ejercicios resueltos", descripcion: "Enunciados con su solución paso a paso", modo: "latex", contenido: TALLER },
  { id: "articulo", nombre: "Artículo", descripcion: "Resumen, secciones y referencias", modo: "latex", contenido: ARTICULO },
  { id: "blanco", nombre: "LaTeX en blanco", descripcion: "Solo el preámbulo", modo: "latex", contenido: BLANCO },
  { id: "md-blanco", nombre: "Markdown en blanco", descripcion: "Texto con fórmulas $…$", modo: "markdown", contenido: MD_BLANCO },
  { id: "md-notas", nombre: "Notas de clase (Markdown)", descripcion: "Apuntes con títulos, listas y fórmulas", modo: "markdown", contenido: MD_NOTAS },
];
