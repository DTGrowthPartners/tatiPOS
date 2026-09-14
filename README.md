# TatiPOS · Sistema de pedidos y operación de Floristería Tati Ramos

Aplicación web (PWA, instalable en el celular) para la sede principal y el equipo en calle.
Construida por DT Growth Partners según la propuesta comercial de septiembre 2026.

**Producción:** https://tatipos.dtgp.ai · VPS 149.56.133.201 · `pm2 tatipos` en `127.0.0.1:3520` · nginx + certbot.

## Módulos
| Módulo | Dónde |
|---|---|
| Pedidos y estados (nuevo → confirmado → preparación → listo → en ruta → entregado) | `/pedidos` |
| Guía de entrega automática (imprimir, PDF o WhatsApp al domiciliario) | `/pedidos/:id/guia` |
| Agenda por franja horaria con capacidad | `/agenda` |
| Producción (tablero: quién prepara, para cuándo) | `/produccion` |
| Domiciliarios, ruta por WhatsApp y foto de evidencia | `/entregas` |
| Dashboard diario | `/` |
| Clientes (CRM automático: historial, valor, fechas importantes) | `/clientes` |
| Reportes (día/semana, ticket, canal, estado, productos, zonas) + Excel | `/reportes` (admin) |
| Cuadre de caja por medio de pago | `/caja` |
| Seguimientos automáticos por WhatsApp (confirmación, entrega, pago pendiente, recompra) | `/seguimientos` + Configuración |
| Integración con el agente de WhatsApp (Chatsuite) | `POST /api/integraciones/bot/pedido` |

Roles: `admin` (todo) y `trabajador` (operación; sin reportes, cierre de caja ni configuración).

## Stack
Node 24 + Express + SQLite (`node:sqlite`, archivo `data/tatipos.db`, WAL) · React 19 + Vite + Tailwind 4 · sin base de datos externa.

```
server/          API (Express). rutas/: auth, pedidos, catalogo (productos, zonas, domiciliarios, clientes), operacion, reportes, sistema
client/          SPA (React). paginas/ una por sección; api.ts tipado; lib/estados.ts el flujo de estados
scripts/         importar_catalogo.js (carga inicial desde el bot de Chatsuite), respaldo.js (cron diario)
data/            tatipos.db, fotos/ (catálogo), uploads/ (comprobantes y evidencias), respaldos/   ← NO va al repo
```

## Correr
```bash
npm install && (cd client && npm install)
npm run build                        # compila el cliente en client/dist
node scripts/importar_catalogo.js    # primera vez: productos, fotos, zonas, domiciliarios, usuarios
pm2 start ecosystem.config.cjs
```
Variables: `PUERTO` (3520), `DATA_DIR`, `TZ=America/Bogota`. Sin usuarios, el primer arranque crea `admin / admin123`.

## Integración con el bot
El bot de Tati (`/srv/chatsuite/tatiramos/bot/perfil.json` → `tienda.pos`) hace `POST` con `x-api-key` cuando el cliente confirma. El pedido entra como **Nuevo** con origen 🤖 para que el equipo lo confirme. Idempotente por `bot_pedido_id`. La llave se ve y regenera en Configuración → Sistema.

## Seguimientos por WhatsApp
Salen por Evolution API (la misma línea del agente). Vienen **apagados** (`seguimientos.activo=false`): se encolan y se ven en Mensajes, pero no se envían hasta activarlos en Configuración → Mensajes, después de que la floristería apruebe los textos.
