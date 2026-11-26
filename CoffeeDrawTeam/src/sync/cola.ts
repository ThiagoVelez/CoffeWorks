// Cola de tareas en orden: cada una empieza cuando termina la anterior (bien o mal).

export function crearCola() {
  let ultima: Promise<unknown> = Promise.resolve();
  return function encolar<T>(tarea: () => Promise<T>): Promise<T> {
    const p = ultima.then(tarea, tarea);
    ultima = p.catch(() => undefined);
    return p;
  };
}
