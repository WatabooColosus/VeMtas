# VeMtas Law — Constitución técnica v1

## Autoridad

Este archivo es la autoridad operativa superior para implementación dentro del repositorio.

Orden de precedencia:

1. VEMTAS_LAW.md
2. ADRs aceptados en docs/decisions/
3. docs/security/INVARIANTS.md
4. docs/MASTER_SPEC.md
5. docs/ENGINEERING_BLUEPRINT.md
6. contratos API/datos/procesos
7. fase activa
8. issue/PR actual

Si dos documentos se contradicen, Codex debe detener la parte contradictoria, documentarla y solicitar decisión. No debe escoger silenciosamente.

## Misión

Construir VeMtas como sistema comercial real, auditable, seguro y evolutivo; no como demo visual.

## Leyes inmutables salvo ADR explícito aprobado

1. NFC identifica una credencial; nunca almacena saldo.
2. Ledger financiero es append-only.
3. Ningún balance se modifica directamente.
4. Todo movimiento financiero debe balancear.
5. Dinero usa enteros en unidad menor, nunca float.
6. Idempotencia obligatoria en escrituras financieras y callbacks externos.
7. El frontend no es autoridad de seguridad ni dinero.
8. Autorización se valida en backend y default-deny.
9. Usuario, comercio, terminal y proveedor no son confiables por defecto.
10. No hay gasto de saldo offline en MVP.
11. No hay dinero real productivo antes del gate de producción.
12. Proveedores externos son adaptadores reemplazables.
13. Operaciones confirmadas conservan evidencia.
14. Refund/reversal compensa; no borra historia.
15. Datos y secretos sensibles no se escriben en logs.
16. No se introducen microservicios sin evidencia y ADR.
17. Una fase no comienza hasta que el gate anterior está verde.
18. No se ocultan tests fallidos ni se debilitan para lograr verde.
19. No se insertan datos falsos para simular evidencia de funcionamiento.
20. Toda excepción temporal se registra como deuda técnica explícita con owner/razón/gate de eliminación.

## Fuente de verdad

Código + migraciones + tests + evidencia reproducible.

Una captura o un mensaje diciendo “funciona” no sustituye tests.

## Dinero real

Antes de habilitar producción deben existir, como mínimo:

- threat model actualizado;
- conciliación;
- restauración de backup probada;
- control de incidentes;
- secretos productivos fuera del repo;
- revisión de seguridad;
- revisión contable;
- revisión jurídica/regulatoria correspondiente;
- proveedor productivo autorizado/configurado;
- observabilidad;
- runbooks;
- gate firmado/documentado.

## Cambios de ley

Codex no modifica este archivo por iniciativa propia para facilitar una implementación.

Todo cambio requiere:
- explicación;
- impacto;
- ADR si es arquitectónico;
- PR separado o claramente identificado;
- aprobación humana.
