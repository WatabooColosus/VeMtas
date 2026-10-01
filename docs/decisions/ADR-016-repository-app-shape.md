# ADR-016 — Forma del repositorio

Status: ACCEPTED

## Estructura objetivo

apps/
- consumer-web
- business-web
- control-web
- web-terminal
- api
- worker

packages/
- contracts
- domain
- db
- auth
- observability
- nfc
- providers
- ui
- config
- testing

infra/
- docker
- scripts

## Regla

Compartir contratos y primitivas; no crear un paquete “shared” sin ownership claro.
