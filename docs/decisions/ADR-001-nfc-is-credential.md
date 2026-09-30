# ADR-001 — NFC es credencial, no saldo

## Estado

Aceptado.

## Decisión

La tarjeta NFC de VeMtas identifica una credencial asociada a una cuenta. No almacena el saldo ni representa por sí sola autorización ilimitada para mover dinero.

## Consecuencias

- una tarjeta perdida puede bloquearse;
- una nueva tarjeta puede vincularse a la misma cuenta;
- copiar una credencial no debe bastar para autorizar operaciones sensibles;
- el servidor conserva la fuente de verdad;
- la seguridad puede elevarse según riesgo.
