# VeMtas Master Spec — v0.1

## 1. Visión

VeMtas es un ecosistema comercial local que permite a personas y negocios interactuar mediante identidad NFC/digital para comprar, descubrir establecimientos, recibir beneficios, participar en fidelización, rutas y eventos, y utilizar múltiples medios de pago e integraciones financieras.

La tarjeta NFC es una **llave de identidad**, no una billetera física ni un contenedor de saldo.

## 2. Objetivo de producto

Servir desde el negocio de barrio hasta cadenas, centros comerciales y zonas comerciales completas.

VeMtas debe permitir:

- registro abierto de usuarios;
- aprobación de comercios por VeMtas;
- perfiles de negocio, sucursales, empleados, cajas y terminales;
- catálogo de productos y servicios;
- compras con saldo VeMtas o registro de otros métodos;
- beneficios y fidelización;
- mapa y descubrimiento;
- rutas y festivales;
- calificaciones verificadas por compra;
- financiación mediante terceros cuando exista integración;
- conciliación y comprobantes;
- seguridad antifraude y auditoría.

## 3. Modelo comercial inicial

Modelo principal previsto: comisión configurable por transacción VeMtas.

No se fijan todavía porcentajes ni valores permanentes.

Variables futuras:

- comisión por compra;
- costo de afiliación;
- beneficios;
- campañas;
- rutas;
- servicios premium;
- publicidad destacada;
- analítica.

Todas las variables comerciales deben ser configurables y auditables.

## 4. Actores

### Usuario

Puede:

- crear cuenta;
- vincular y bloquear tarjeta NFC;
- recargar saldo mediante proveedor externo;
- comprar;
- consultar movimientos;
- recibir comprobantes;
- explorar comercios;
- acceder a beneficios;
- completar rutas;
- participar en eventos;
- calificar compras verificadas;
- consultar opciones de financiación mediante terceros.

### Negocio

Puede:

- solicitar afiliación;
- crear sucursales;
- registrar empleados y roles;
- registrar terminales;
- gestionar productos/servicios;
- vender;
- aplicar beneficios;
- registrar pagos en efectivo u otros métodos;
- consultar liquidaciones y analítica.

### VeMtas Control

Administra:

- aprobación de negocios;
- seguridad y fraude;
- reglas comerciales;
- campañas;
- rutas;
- eventos;
- conciliación;
- comprobantes;
- incidencias;
- integraciones.

## 5. Terminales

Dos caminos iniciales:

1. Android con NFC mediante VeMtas Business.
2. PC + lector NFC USB mediante VeMtas Web Terminal.

El backend no depende de un modelo específico de hardware.

## 6. Compra VeMtas

Flujo base:

1. comercio construye la venta;
2. servidor crea `payment_intent`;
3. cliente acerca tarjeta NFC;
4. VeMtas resuelve la credencial;
5. Guardian evalúa riesgo;
6. se solicita autorización adicional si aplica;
7. Money valida saldo y contabiliza;
8. comercio recibe aprobación;
9. se generan comprobantes;
10. usuario recibe notificación;
11. se actualizan beneficios/fidelización.

## 7. Métodos de pago

VeMtas debe diseñarse con proveedores intercambiables.

Categorías previstas:

- saldo VeMtas;
- efectivo;
- pasarelas;
- PSE;
- proveedores de pago;
- financiación;
- bancos/cooperativas;
- futuros medios.

Integraciones mencionadas como candidatos, no dependencias del Core:

- Wompi;
- ePayco;
- Mercado Pago;
- PSE;
- Addi;
- Sistecrédito;
- otras entidades financieras o comerciales.

## 8. Dinero y contabilidad interna

VeMtas utilizará un ledger append-only.

Nunca se debe implementar el balance de usuario como un número editable manualmente sin asientos.

Deben existir al menos:

- cuentas de usuario;
- obligaciones con comercios;
- ingresos/comisiones VeMtas;
- recargas;
- pagos;
- reversos;
- reembolsos;
- liquidaciones;
- ajustes auditados;
- conciliación.

El dinero real y las implicaciones regulatorias se validarán antes de producción. El Core financiero debe permanecer independiente del proveedor que finalmente custodie o procese fondos.

## 9. Comprobantes

Tipos iniciales:

- CI — comprobante de ingreso;
- CE — comprobante de egreso;
- VT — comprobante de transacción;
- RC — comprobante de recarga;
- LIQ — liquidación;
- REV — reversión;
- REF — reembolso;
- AJU — ajuste.

No se deben eliminar comprobantes financieros confirmados; se compensan mediante nuevos eventos.

## 10. Negocio y geografía

Jerarquía prevista:

País → departamento → ciudad → comuna/localidad → barrio → zona → establecimiento → sucursal.

Entidades superiores permiten representar:

- zonas comerciales;
- centros comerciales;
- festivales;
- campañas barriales;
- rutas.

## 11. Descubrimiento

Mapa y búsqueda por:

- comercio;
- categoría;
- producto;
- distancia;
- promociones;
- apertura;
- calificación;
- rutas;
- eventos.

La publicidad patrocinada debe diferenciarse del ranking orgánico.

## 12. Fidelización

No existe obligación de crear una moneda universal de puntos.

Cada negocio puede tener su propio programa.

También pueden existir beneficios compartidos entre comercios certificados.

## 13. Rutas y eventos

VeMtas administra directamente rutas y festivales.

Una ruta puede requerir compras válidas en comercios participantes.

Un evento puede agrupar:

- mapa;
- comercios;
- promociones;
- rutas;
- actividades;
- premios;
- patrocinadores.

## 14. Reputación

Las reseñas deben estar ligadas a interacción o compra verificable.

## 15. Arquitectura inicial

Monolito modular.

Dominios:

- Core
- Commerce
- Money
- Guardian
- Discovery
- Growth
- Experiences
- Connect
- Control

El sistema podrá extraer servicios posteriormente si la carga operacional lo justifica.

## 16. MVP

Primer objetivo recomendado:

- 20 comercios;
- 200 usuarios;
- una zona piloto;
- NFC real;
- dinero simulado/sandbox;
- ledger real;
- compra completa;
- beneficio;
- comprobante;
- mapa;
- historial;
- seguridad;
- conciliación simulada.

## 17. No-MVP

No priorizar inicialmente:

- red social;
- chat;
- delivery;
- criptomonedas;
- sistema bancario propio;
- IA omnipresente;
- pagos offline de saldo;
- familia/menores;
- microservicios prematuros.

## 18. Métrica principal

La métrica principal no es cantidad de descargas ni tarjetas entregadas.

Debe medirse especialmente la **recompra/repetición mediante VeMtas**.
