# ADR-015 — USB NFC en PC

Status: ACCEPTED

## Decisión

Lector USB se integra mediante PC/SC a través de un bridge local VeMtas con permisos mínimos.

Web Terminal se comunica con el bridge por canal local autenticado.

## Reglas

- browser no accede arbitrariamente al sistema;
- pairing terminal/bridge;
- versión/protocolo explícitos;
- allowlist de origen;
- credential material minimizado;
- Core recibe abstracción NfcReader, no comandos de lector.
