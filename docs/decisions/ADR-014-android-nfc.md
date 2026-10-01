# ADR-014 — Android NFC

Status: ACCEPTED

## Decisión

El flujo NFC Android usa capacidad nativa y un adapter VeMtas; no se asume Web NFC como base del pago presencial.

## Arquitectura

NfcReader interface → AndroidNfcAdapter.

La app puede compartir contratos TypeScript con el ecosistema, pero el acceso NFC crítico debe poder usar código nativo Android.

## Piloto

NTAG/credenciales simples pueden servir para probar identidad y UX, pero no se consideran por sí mismas credencial criptográfica suficiente para dinero real.

La selección de tarjeta segura para producción es un gate posterior.
