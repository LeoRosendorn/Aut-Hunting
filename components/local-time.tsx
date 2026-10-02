"use client";

import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Fecha y hora en la zona horaria de quien mira la página.
 * Formatear en el servidor usaría la zona de Vercel (UTC) y mostraría horas corridas en LATAM,
 * así que en el HTML inicial solo va el <time> y el texto se completa en el navegador.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const locale = useLocale();
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <time dateTime={iso} className={className}>
      {isClient
        ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
        : " "}
    </time>
  );
}
