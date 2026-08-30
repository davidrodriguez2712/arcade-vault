import type { NextConfig } from "next";
// SPEC 13 — Endurecimiento de seguridad.
// Headers estáticos aplicados a todas las respuestas (source '/(.*)').
// Sin Content-Security-Policy: va en su propia spec.
const securityHeaders = [
  // Evita MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Bloquea embedding en iframe (clickjacking). No hay iframes.
  { key: "X-Frame-Options", value: "DENY" },
  // No filtra path/query a terceros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Fuerza HTTPS. Solo surte efecto servido por HTTPS en prod.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Desactiva APIs del navegador que la app no usa.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Prefetch DNS controlado explícitamente.
  { key: "X-DNS-Prefetch-Control", value: "on" },
];
const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.18.49"],
  // Quita el header X-Powered-By: Next.js (fingerprinting).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};
export default nextConfig;
