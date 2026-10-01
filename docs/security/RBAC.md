# RBAC y autorización

## Principio

Un rol otorga capacidades dentro de un scope. Ser miembro de un negocio no concede acceso global.

## Roles de plataforma

### PLATFORM_SUPPORT
Consulta limitada para soporte. No mueve dinero ni cambia ledger.

### PLATFORM_OPERATIONS
Gestiona altas operativas, incidencias y configuración no financiera.

### PLATFORM_RISK
Revisa riesgo, suspende credenciales/terminales/comercios según política.

### PLATFORM_FINANCE
Consulta conciliación, liquidaciones y comprobantes; crea solicitudes de ajuste.

### PLATFORM_FINANCE_APPROVER
Aprueba operaciones financieras sensibles separadas del solicitante cuando aplique.

### PLATFORM_ADMIN
Gobierno técnico/operativo. No obtiene una vía para editar balances directamente.

## Roles de negocio

### BUSINESS_OWNER
Gobierno completo del negocio y sus sucursales, salvo funciones reservadas a VeMtas.

### BUSINESS_ADMIN
Gestiona catálogo, empleados, terminales, promociones y reportes según scope.

### BRANCH_MANAGER
Opera una o varias sucursales asignadas.

### CASHIER
Crea ventas, cobra, registra efectivo y consulta su operación permitida.

### ANALYST
Solo lectura de métricas/reportes autorizados.

## Usuario consumidor

USER no es un rol de negocio. Controla su cuenta, credenciales, preferencias, movimientos y acciones de consumo.

## Matriz resumida

| Acción | User | Cashier | Manager | Owner | Risk | Finance |
|---|---|---|---|---|---|---|
| Ver saldo propio | Sí | No | No | No | Limitado | Limitado |
| Crear venta | No | Sí | Sí | Sí | No | No |
| Cobrar | Cliente autoriza | Sí | Sí | Sí | No | No |
| Bloquear NFC propio | Sí | No | No | No | Sí | No |
| Alta empleado | No | No | Scope | Sí | No | No |
| Autorizar terminal | No | No | Scope | Sí | Puede suspender | No |
| Editar balance | No | No | No | No | No | No |
| Solicitar ajuste | No | No | No | No | No | Sí |
| Aprobar ajuste sensible | No | No | No | No | No | Aprobador distinto |

## ABAC complementario

Además de RBAC se validan atributos:

- business_id;
- branch_id;
- ownership;
- estado del recurso;
- monto;
- riesgo;
- terminal;
- relación usuario/recurso.

## Regla de denegación

Default deny. Todo permiso debe concederse explícitamente.
