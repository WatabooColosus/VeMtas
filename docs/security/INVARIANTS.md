# VeMtas — Invariantes de seguridad y dinero

Estas reglas deben convertirse en pruebas automatizadas.

1. Ningún peso aparece de la nada.
2. Ningún peso desaparece sin asiento correspondiente.
3. Una transacción no puede contabilizarse dos veces.
4. Una tarjeta NFC no contiene el saldo VeMtas.
5. Bloquear una tarjeta no elimina la cuenta.
6. Una devolución no elimina la compra original.
7. Un administrador no edita balances directamente.
8. Un proveedor externo no es la única fuente histórica de verdad.
9. Una operación financiera confirmada conserva evidencia.
10. Un comercio solo accede a la información necesaria del usuario.
11. Sin conexión al Core no se gasta saldo en el MVP.
12. Toda modificación financiera debe cuadrar en el ledger.
13. El frontend nunca acredita una recarga por sí mismo.
14. Un webhook duplicado nunca duplica una operación.
15. Un payment intent debe ser idempotente.
16. Las autorizaciones están ligadas a monto, comercio y operación.
17. El mismo saldo no puede gastarse concurrentemente dos veces.
18. Las operaciones críticas producen audit log.
19. Las promociones tienen límites y presupuesto cuando generan exposición económica.
20. El GPS nunca es prueba única de pago.
