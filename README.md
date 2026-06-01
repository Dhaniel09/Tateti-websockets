# Ta-Te-Ti WebSocket Multisala

Juego de Ta-Te-Ti multijugador en tiempo real con **Node.js + Express + WebSocket (`ws`)**, con interfaz moderna y soporte de hasta **10 salas simultaneas**.

## Caracteristicas

- Partidas en tiempo real con WebSockets.
- Lobby con hasta 10 salas de juego.
- Asignacion automatica de jugadores:
  - Primer jugador en la sala: `X`
  - Segundo jugador en la sala: `O`
  - Tercero en adelante: espectador
- Validacion de turnos del lado servidor (fuente de verdad).
- Tablero sincronizado para todos los clientes de una sala.
- Deteccion de ganador y empate.
- Boton **Nueva Partida** sincronizado para todos.
- Contador por sala:
  - Victorias de X
  - Victorias de O
  - Empates
- UI responsive para PC y celular.

## Tecnologias

- Node.js
- Express
- WebSocket (`ws`)
- HTML / CSS / JavaScript
- Docker + Docker Compose

## Estructura del proyecto

```text
tateti-websocket/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
└── .env
```

## Requisitos

- Node.js 18+ (recomendado)
- npm
- Docker (opcional)
- Docker Compose (opcional)

## Variables de entorno

Archivo `.env` (en la raiz):

```env
PORT=3001
```

## Ejecucion local (sin Docker)

```bash
cd server
npm install
npm start
```

Abrir en navegador:

- [http://localhost:3001](http://localhost:3001)

## Ejecucion con Docker Compose

Desde la raiz del proyecto:

```bash
docker-compose up -d --build
```

Ver logs:

```bash
docker-compose logs -f
```

Detener contenedores:

```bash
docker-compose down
```

## Como jugar

1. Abri el juego en `localhost:3001`.
2. Elegi una sala en el lobby.
3. Comparti la misma sala con otra persona.
4. Juega `X` primero.
5. El servidor valida turnos y sincroniza el estado.
6. Si hay ganador o empate, el tablero se bloquea.
7. Presiona **Nueva Partida** para reiniciar en esa sala.

## Roadmap sugerido

- Sistema de nombre de jugador.
- Salas privadas con codigo de invitacion.
- Persistencia de ranking.
- Despliegue en cloud con HTTPS (`wss`).

## Autor

Proyecto academico de Ta-Te-Ti online en tiempo real
