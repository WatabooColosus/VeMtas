# VeMtas

VeMtas es una plataforma comercial local basada en identidad NFC/digital que conecta personas, comercios, beneficios, descubrimiento, pagos y experiencias de economía local.

## Principio central

Una persona puede usar una identidad VeMtas —principalmente mediante tarjeta NFC— para identificarse, comprar, recibir beneficios, participar en rutas y acceder a servicios dentro de una red de comercios afiliados.

## Estado

**Fase actual:** definición funcional y arquitectura inicial.

Todavía no se debe conectar dinero real a producción. El desarrollo inicial debe operar con proveedores sandbox/mock y conservar las mismas invariantes contables y de seguridad previstas para producción.

## Productos

- **VeMtas App:** consumidor.
- **VeMtas Business:** aplicación/POS para comercios.
- **VeMtas Web Terminal:** PC + lector NFC USB.
- **VeMtas Control:** administración, conciliación y gobierno.
- **VeMtas Connect:** integraciones externas.

## Núcleos

- Core
- Commerce
- Money
- Guardian
- Discovery
- Growth
- Experiences
- Connect
- Control

## Documentación

La especificación base vive en `docs/`.

Comienza por:

1. `docs/MASTER_SPEC.md`
2. `docs/architecture/OVERVIEW.md`
3. `docs/security/INVARIANTS.md`
4. `docs/decisions/`

## Gobierno técnico

Las decisiones arquitectónicas relevantes deben documentarse como ADRs antes de cambiar los principios del sistema.

VeMtas se diseña inicialmente como un **monolito modular**, no como una colección prematura de microservicios.

## Operación

Proyecto impulsado por Agencia Digital Wataboo y desarrollado de forma articulada con Tríade y Codex.
