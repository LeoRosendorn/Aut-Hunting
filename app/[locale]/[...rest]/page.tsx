import { notFound } from "next/navigation";

// Cualquier ruta desconocida dentro de un idioma ("/es/lo-que-sea") muestra el 404 traducido.
export default function CatchAll() {
  notFound();
}
