# ADR-004 — Proveedores externos como adaptadores

## Estado

Aceptado.

## Decisión

VeMtas no dependerá estructuralmente de Wompi, ePayco, Mercado Pago, PSE, Addi, Sistecrédito, Filipo, Odoo u otro proveedor específico.

Cada integración implementará contratos internos.

## Consecuencias

- proveedores sustituibles;
- sandbox/mock disponible;
- menor acoplamiento;
- el dominio VeMtas sigue siendo fuente de verdad.
