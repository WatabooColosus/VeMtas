# Flujos end-to-end

## F01 — Registro usuario

1. usuario inicia registro;
2. verifica identidad de contacto;
3. se crea User;
4. se crea Profile;
5. AuditEvent UserRegistered;
6. sesión autenticada.

### Aceptación
- duplicados controlados;
- contacto no verificado no obtiene privilegios financieros;
- reintento no crea dos usuarios.

## F02 — Afiliación NFC

1. operador autorizado selecciona usuario;
2. lector obtiene credencial;
3. backend valida que no esté vinculada activamente;
4. crea Credential PENDING;
5. confirma emisión;
6. Credential ACTIVE;
7. audit.

### Aceptación
- misma credencial no queda activa en dos usuarios;
- no se expone secreto NFC;
- reemplazo conserva cuenta/saldo.

## F03 — Alta negocio

1. solicitante crea borrador;
2. añade datos;
3. envía;
4. VeMtas revisa;
5. aprueba/rechaza;
6. ACTIVE habilita operación.

### Aceptación
- negocio no ACTIVE no cobra saldo;
- decisiones quedan auditadas.

## F04 — Autorizar terminal

1. Owner/Admin registra terminal;
2. terminal obtiene identidad técnica;
3. backend la liga a branch/register;
4. se autoriza;
5. sesiones de caja usan ese terminal.

### Aceptación
- terminal suspendido no inicia cobros;
- un terminal no cambia de negocio silenciosamente.

## F05 — Venta en efectivo con NFC

1. cajero crea Sale;
2. añade líneas;
3. presenta NFC;
4. identifica usuario;
5. Growth calcula beneficio elegible;
6. cajero selecciona CASH;
7. Sale COMPLETED;
8. se emite receipt;
9. fidelización/eligibilidad review se actualiza.

No se crea salida de saldo VeMtas.

## F06 — Compra con saldo VeMtas

1. Sale READY_FOR_PAYMENT;
2. servidor crea PaymentIntent con monto inmutable;
3. terminal lee NFC;
4. Credential resuelve User;
5. Guardian evalúa;
6. si corresponde, crea SecurityChallenge;
7. usuario autoriza;
8. Money valida fondos;
9. transacción atómica contabiliza:
   - disminución disponibilidad usuario;
   - aumento merchant payable;
   - aumento revenue/fee VeMtas según regla;
10. Payment COMPLETED;
11. Sale COMPLETED;
12. ReceiptIssued;
13. efectos Growth/notifications asíncronos.

### Aceptación
- doble tap no duplica;
- dos compras concurrentes no gastan el mismo saldo;
- cambio de monto invalida autorización;
- fallo antes del post no deja medio asiento.

## F07 — Recarga sandbox

1. usuario solicita monto;
2. TopUp CREATED;
3. ProviderAdapter crea operación sandbox;
4. webhook firmado/simulado llega;
5. webhook se deduplica;
6. TopUp CONFIRMED;
7. ledger postea;
8. saldo disponible cambia;
9. receipt/comprobante.

### Aceptación
- frontend no puede confirmar;
- webhook duplicado = una recarga;
- referencia externa única.

## F08 — Devolución

1. rol permitido solicita refund;
2. valida pago original y monto restante reembolsable;
3. Guardian/approval según umbral;
4. ledger crea compensación;
5. Refund POSTED;
6. comprobante;
7. efectos de beneficios se ajustan mediante eventos, nunca borrando historia.

## F09 — Bloqueo/reemplazo tarjeta

1. usuario bloquea;
2. Credential BLOCKED;
3. intentos posteriores rechazados;
4. nueva credencial se emite;
5. anterior REPLACED;
6. cuenta y ledger permanecen intactos.

## F10 — Ruta

1. VeMtas publica ruta;
2. usuario se une/participa;
3. compra qualifying sale;
4. checkpoint se completa idempotentemente;
5. al cumplir reglas, progreso COMPLETED;
6. beneficio se concede una sola vez.

## F11 — Reseña

1. Sale elegible genera ReviewEligibility;
2. usuario envía review;
3. eligibility queda consumida;
4. una compra no genera múltiples reseñas.

## F12 — Conciliación

1. se importa/consulta reporte del proveedor;
2. se compara con referencias internas;
3. matches quedan reconciled;
4. diferencias crean reconciliation item/incidente;
5. contabilidad puede exportar evidencia.

## F13 — Proveedor caído

1. Connect detecta error;
2. operación queda en estado seguro;
3. no se acredita ni debita sin certeza;
4. reintento idempotente;
5. UNKNOWN exige reconciliación.

## F14 — Core sin conexión

No se permite gasto de saldo.

Terminal ofrece métodos alternos permitidos y muestra estado claro.
