# Balam Xchange

**Motor inteligente de arbitraje de Bitcoin en tiempo real**

> *Cazando oportunidades de arbitraje de Bitcoin en tiempo real.*

Balam Xchange es una web app full-stack para hackathon que monitorea order books públicos de BTC en exchanges líderes, detecta divergencias cross-exchange, calcula rentabilidad neta considerando fees, slippage, liquidez y latencia, ejecuta trades **100% simulados** contra wallets virtuales y presenta todo en un dashboard en vivo.

> **Solo simulación.** Sin trading real. Sin API keys privadas. Diseñado para evaluación técnica del challenge.

---

## 1. Descripción del proyecto

Bitcoin cotiza de forma simultánea en múltiples exchanges. Los precios bid/ask no están perfectamente alineados: en ventanas breves puede ser más barato comprar BTC en un venue y venderlo en otro que operar en un solo mercado.

Balam Xchange implementa el ciclo completo de un motor de arbitraje simulado:

1. **Recolección** de order books públicos vía CCXT (Binance, Kraken, Coinbase, OKX).
2. **Detección** de oportunidades cuando `buyExchange.ask < sellExchange.bid`.
3. **Evaluación** de rentabilidad neta con fees, slippage, latencia y balances simulados.
4. **Ejecución simulada** con soporte de fills parciales y motor de riesgo.
5. **Visualización** en tiempo real por WebSocket en un dashboard responsive.

El sistema demuestra cómo razonaría un desk de arbitraje en producción, sin mover capital real.

---

## 2. Objetivo del challenge

El challenge pide construir un sistema que:

- Monitoree precios y order books de BTC en múltiples exchanges.
- Detecte oportunidades de arbitraje cross-exchange.
- Calcule si el spread sigue siendo rentable después de costos operativos.
- Simule la ejecución y presente resultados de forma clara para revisión técnica.

Balam Xchange cumple ese objetivo de extremo a extremo: datos públicos → oportunidades puntuadas → ejecución simulada → historial, P&L acumulado y salvaguardas de riesgo, dentro del alcance de un MVP de hackathon.

---

## 3. Stack tecnológico

### Frontend

| Tecnología | Uso |
|------------|-----|
| React 19 + TypeScript | UI del dashboard |
| Vite | Dev server y build |
| TailwindCSS | Diseño oscuro responsive |
| Recharts | Gráfica de P&L acumulado |
| WebSocket client | Estado en vivo + reconexión automática |
| localStorage | Persistencia de historial al recargar |

### Backend

| Tecnología | Uso |
|------------|-----|
| Node.js + TypeScript | Runtime y tipado |
| Express | REST (`/health`, `/api/state`) |
| ws | Broadcast WebSocket dedicado |
| CCXT | Order books públicos (sin API keys) |
| In-memory state | Orquestación vía `AppOrchestrator` |

### Deployment

| Entorno | Estado |
|---------|--------|
| Local (npm workspaces) | ✅ Implementado |
| Docker + Docker Compose | 🔜 Planificado |
| Coolify | 🔜 Planificado (compatible con empaquetado Docker) |

---

## 4. Arquitectura del proyecto

```
balam-xchange/
├── backend/
│   ├── src/
│   │   ├── config.ts
│   │   ├── index.ts
│   │   ├── types/
│   │   ├── services/
│   │   │   ├── orderBookService.ts    # CCXT + normalización
│   │   │   ├── mockDataService.ts     # Fallback si falla un exchange
│   │   │   ├── arbitrageEngine.ts     # Detección de oportunidades
│   │   │   ├── slippageService.ts     # Slippage, latencia, score
│   │   │   ├── walletService.ts       # Wallets y ejecución simulada
│   │   │   ├── riskEngine.ts          # Validación y circuit breaker
│   │   │   └── orchestrator.ts        # Polling + auto-ejecución
│   │   └── websocket/
│   │       └── wsServer.ts
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/                # Secciones del dashboard
│   │   ├── hooks/useWebSocket.ts
│   │   ├── types/
│   │   └── utils/format.ts
│   ├── .env.example
│   └── vite.config.ts
├── screenshots/
├── package.json
├── .gitignore
└── README.md
```

### Flujo de datos

```
CCXT (APIs públicas)
    → OrderBookService (normalización + fallback mock)
    → ArbitrageEngine (detección + score)
    → RiskEngine + WalletService (validación + ejecución simulada)
    → AppOrchestrator (estado unificado)
    → WebSocket broadcast
    → Dashboard React
```

**Decisión técnica:** HTTP (`PORT`) y WebSocket (`WS_PORT`) usan puertos separados en desarrollo para simplificar el debug. El empaquetado Docker futuro unificará ambos detrás de un reverse proxy.

---

## 5. Instalación

### Requisitos

- Node.js 20+
- npm 10+
- Acceso a internet (APIs públicas de exchanges)

### Pasos

```bash
git clone https://github.com/ManuelCanulDev/Coding_Challenge_Mexico.git
cd Coding_Challenge_Mexico
npm install
```

Opcional — variables de entorno:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

---

## 6. Ejecución local

Desde la **raíz del repositorio**:

```bash
npm run dev
```

Levanta backend y frontend en paralelo.

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend (HTTP) | http://localhost:3001 |
| WebSocket | ws://localhost:3002 |

### Servicios individuales

```bash
npm run dev:backend   # solo backend (desde la raíz)
npm run dev:frontend  # solo frontend (desde la raíz)
```

Desde `backend/`:

```bash
npm run dev
```

### Build de producción

```bash
npm run build
cd backend && npm start   # API compilada en backend/dist
```

---

## 7. Docker / Coolify

> **Estado actual:** no incluido en el repositorio. Planificado como mejora de deployment.

La ruta prevista es un `Dockerfile` + `docker-compose.yml` que:

- Compile frontend y backend.
- Sirva el dashboard estático y la API/WebSocket detrás de un solo puerto expuesto.
- Sea desplegable en **Coolify** con variables de entorno inyectadas.

**Comando objetivo (futuro):**

```bash
docker compose up --build
```

**URL objetivo en producción (futuro):** http://localhost:4000

Hasta entonces, usar la ejecución local descrita en la sección 6.

---

## 8. Variables de entorno

### Backend (`backend/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto HTTP |
| `WS_PORT` | `3002` | Puerto WebSocket |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido del frontend |
| `POLL_INTERVAL_MS` | `1500` | Intervalo de polling |
| `AUTO_EXECUTE` | `true` | Auto-ejecutar trades simulados |
| `MIN_NET_PROFIT_PCT` | `0.02` | Beneficio neto mínimo (%) |
| `MIN_VOLUME_BTC` | `0.001` | Volumen mínimo ejecutable |
| `MAX_COMBINED_LATENCY_MS` | `2000` | Latencia combinada máxima |
| `CIRCUIT_BREAKER_THRESHOLD` | `3` | Trades negativos antes de pausar |
| `CIRCUIT_BREAKER_COOLDOWN_MS` | `60000` | Cooldown del circuit breaker (ms) |
| `DEMO_MODE` | `true` | Offsets demo en bps (`false` = precios reales sin alterar) |

Ejemplo:

```env
PORT=3001
WS_PORT=3002
CORS_ORIGIN=http://localhost:5173
DEMO_MODE=false
```

### Frontend (`frontend/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:3002` | Endpoint WebSocket |
| `VITE_API_URL` | `http://localhost:3001` | Base URL REST (fallback) |

**No se requieren API keys.** CCXT consume únicamente endpoints públicos.

---

## 9. Capturas de pantalla

Añadir capturas en `/screenshots` antes de la entrega:

![Vista general del dashboard](./screenshots/dashboard-overview.png)

![Oportunidades en vivo](./screenshots/live-opportunities.png)

![Historial de trades y P&L](./screenshots/trade-history-pnl.png)

*(Directorio placeholder incluido — reemplazar con capturas reales de la demo.)*

---

## 10. Motor de arbitraje

El `ArbitrageEngine` compara **todos los pares de exchanges** en cada ciclo de polling.

**Condición de detección:**

```
buyExchange.ask < sellExchange.bid
```

Para cada par válido el motor calcula:

- Spread bruto (USD y %)
- Fees estimados de compra y venta
- Slippage sobre los primeros 10 niveles del book
- Penalización por latencia combinada
- Beneficio neto y volumen máximo ejecutable
- Opportunity Score y rating

Las oportunidades se ordenan por score descendente. Con `AUTO_EXECUTE=true`, el orchestrator intenta ejecutar la mejor oportunidad aprobada por el risk engine (cooldown de 3 s entre intentos).

**Exchanges soportados:**

| Exchange | Par | Fee default |
|----------|-----|-------------|
| Binance | BTC/USDT | 0.10% |
| Kraken | BTC/USD | 0.26% |
| Coinbase | BTC/USD | 0.60% |
| OKX | BTC/USDT | 0.10% |

---

## 11. Cálculo de rentabilidad neta

```
notional = volumeBtc * buyPrice

buyFeeUsd = notional * buyFeeRate
sellFeeUsd = volumeBtc * sellPrice * sellFeeRate

grossProfitUsd = (sellPrice - buyPrice) * volumeBtc

netProfitUsd = grossProfitUsd
               - buyFeeUsd
               - sellFeeUsd
               - slippageUsd
               - latencyPenaltyUsd

netProfitPct = netProfitUsd / notional * 100
```

**Penalización por latencia:** `0.01%` del nocional por cada **500 ms** de latencia combinada de fetch (compra + venta).

**Slippage:** precio promedio ponderado en los 10 primeros niveles del order book; la diferencia vs. mejor precio se convierte en costo USD.

Una oportunidad se marca `executable` cuando `netProfitUsd > 0` y `netProfitPct > 0.02%`.

---

## 12. Simulación de ejecución

La ejecución es **100% simulada** en memoria. No se envían órdenes a exchanges.

Flujo cuando el risk engine aprueba:

1. Se calcula volumen máximo viable (liquidez + balances).
2. `WalletService.executeTrade()` aplica precios con slippage.
3. Se actualizan balances fiat/BTC en ambos exchanges.
4. Se registra el trade con status `executed`, `partial` o `rejected` y un campo `reason`.

Estados posibles del trade:

| Status | Significado |
|--------|-------------|
| `executed` | Fill completo dentro de límites |
| `partial` | Fill reducido por liquidez o balance |
| `rejected` | No ejecutado (riesgo, balance o liquidez) |

---

## 13. Manejo de wallets simuladas

Cada exchange mantiene balances independientes en memoria:

| Exchange | Fiat inicial | BTC inicial |
|----------|--------------|-------------|
| Binance | 100,000 USDT | 1 BTC |
| Kraken | 100,000 USD | 1 BTC |
| Coinbase | 100,000 USD | 1 BTC |
| OKX | 100,000 USDT | 1 BTC |

**Al comprar (exchange A):** debita fiat (+ fee), acredita BTC.

**Al vender (exchange B):** debita BTC, acredita fiat (− fee).

El dashboard muestra fiat, BTC y valor total estimado por exchange. Los balances se reinician al reiniciar el backend (estado en memoria).

---

## 14. Manejo de órdenes parciales

Si el volumen objetivo no cabe en el book o en los balances simulados:

- Se ejecuta el **máximo volumen viable** (`min` entre liquidez bid/ask, balance fiat de compra y balance BTC de venta).
- El trade se marca `partial` si el fill es menor al objetivo o si algún lado del book no tiene liquidez suficiente en 10 niveles.
- Si el volumen resultante es `< 0.001 BTC`, se rechaza.

Esto refleja la realidad operativa: el arbitraje raramente llena el tamaño teórico completo.

---

## 15. Motor de riesgo

El `RiskEngine` valida cada oportunidad antes de simular ejecución:

| Regla | Umbral default |
|-------|----------------|
| Beneficio neto insuficiente | `netProfitPct ≤ 0.02%` |
| Beneficio USD no positivo | `netProfitUsd ≤ 0` |
| Liquidez insuficiente | `maxExecutableBtc ≤ 0` |
| Volumen bajo mínimo | `< 0.001 BTC` |
| Latencia combinada alta | `> 2000 ms` |
| Balance insuficiente | Validado en `WalletService` |
| Circuit breaker activo | Pausa tras 3 trades negativos seguidos |

**Circuit breaker:** tras 3 trades simulados con `netProfitUsd < 0`, la auto-ejecución se pausa **60 segundos**. El dashboard muestra el estado ON/OFF y el bot pasa a `Paused`.

Cada rechazo incluye un string `reason` visible en la UI.

---

## 16. Opportunity Score

Puntuación **0–100** para priorizar oportunidades:

```
score = netProfitPct * 10_000
        + liquidityScore
        - latencyPenaltyScore
        - riskPenalty

score = clamp(score, 0, 100)
```

| Score | Rating |
|-------|--------|
| 80–100 | Excellent |
| 60–79 | Good |
| 40–59 | Moderate |
| < 40 | Weak |

Factores considerados: rentabilidad neta, volumen ejecutable, latencia y penalizaciones de riesgo contextual.

---

## 17. Limitaciones actuales

- **Solo simulación** — sin órdenes reales ni settlement.
- **Sin APIs privadas** — order books públicos únicamente.
- **Estado en memoria** — el backend pierde estado al reiniciar.
- **USDT ≈ USD** — tratados como equivalentes en el MVP (sin capa FX).
- **Polling REST cada 1.5 s** — no es arquitectura HFT ni WebSocket nativo de exchanges.
- **Fallback mock** — si CCXT falla, se inyectan precios simulados (exchange `offline`).
- **`DEMO_MODE`** — offsets en bps para demos cuando mercados reales son demasiado eficientes.
- **Sin Docker/Coolify en repo** — deployment containerizado pendiente.
- **Modelado simplificado** — sin costos de retiro, transferencias inter-exchange ni confirmaciones on-chain.

---

## 18. Mejoras futuras

- [ ] `Dockerfile` + `docker-compose.yml` para Coolify y puerto único
- [ ] WebSocket feeds nativos por exchange
- [ ] Base de datos persistente (PostgreSQL)
- [ ] Backtesting con datos históricos
- [ ] Soporte multi-activo (ETH, SOL, …)
- [ ] Arbitraje triangular
- [ ] Modelado avanzado de latencia y FX USDT/USD
- [ ] Replay histórico de mercado
- [ ] Autenticación y multi-usuario
- [ ] Perfiles de fees maker/taker por tier
- [ ] Eliminar fallback mock en modo producción estricto

---

## 19. Disclaimer

Balam Xchange es un **proyecto educativo para hackathon**. Demuestra análisis de mercado, modelado de arbitraje y simulación con controles de riesgo.

- **No es asesoría financiera.**
- **No es un producto de trading.**
- **No ejecuta operaciones reales.**

No utilices este software para operar capital real sin revisión profesional, cumplimiento regulatorio y infraestructura de producción adecuada.

---

## Autor

Desarrollado para el **Bitcoin Arbitrage Hackathon Challenge**.

## Licencia

MIT — proyecto de demostración para hackathon.
