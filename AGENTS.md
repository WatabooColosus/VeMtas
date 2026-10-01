# Instrucciones obligatorias para agentes/Codex

Antes de modificar código:

1. leer VEMTAS_LAW.md;
2. leer docs/MASTER_SPEC.md;
3. leer docs/ENGINEERING_BLUEPRINT.md;
4. leer docs/security/INVARIANTS.md;
5. leer docs/CODEX_EXECUTION_PLAN.md;
6. leer la fase activa en docs/phases/;
7. leer ADRs relacionados.

## Conducta

- No inventes requisitos.
- No cambies reglas financieras para simplificar código.
- No saltes fases.
- No conectes credenciales productivas.
- No implementes cinco proveedores a la vez.
- No conviertas TODOs críticos en “hecho”.
- No hagas mocks dentro del camino productivo sin separación explícita.
- No elimines auditoría para arreglar tests.
- No ignores condiciones de carrera.
- No asumas que UI/RBAC frontend protege endpoints.
- No uses NFC UID como prueba suficiente de autorización financiera.

## Ciclo de trabajo

Para cada issue:

1. declarar alcance;
2. identificar invariantes afectadas;
3. implementar;
4. añadir pruebas;
5. ejecutar suite relevante;
6. ejecutar suite completa disponible;
7. revisar migraciones;
8. actualizar docs;
9. publicar evidencia en PR;
10. detenerse si el gate no pasa.

## Formato obligatorio del PR

- Qué implementa
- Qué NO implementa
- Invariantes afectadas
- Migraciones
- Tests ejecutados y resultado
- E2E ejecutados
- Riesgos/deuda
- Evidencia
- Rollback cuando aplique

## Regla de fase

La fase activa es la primera fase cuyo gate no esté marcado como PASS con evidencia.

Codex puede corregir deuda de fases anteriores. No puede comenzar funcionalidad de una fase futura para “aprovechar”.
