# xlack

Mini demo de mensajería en tiempo real estilo Slack. Demuestra manejo de estados, arquitectura feature-based y capacidades realtime con un stack moderno.

## Stack

- **Vue 3** + Vite + TypeScript
- **Pinia** — estado global
- **Supabase** — base de datos PostgreSQL, autenticación y Realtime
- **Vue Router 4** — navegación con guard de autenticación
- **Vitest** — tests unitarios
- **Netlify** — deploy

## Funcionalidades

- Registro e inicio de sesión con Supabase Auth
- Crear y seleccionar canales
- Enviar y recibir mensajes en tiempo real
- Mensajes sincronizados entre pestañas/clientes vía Supabase Realtime

## Arquitectura

Feature-based: cada dominio (auth, channels, messages) tiene su propio composable, store Pinia y componentes. Los componentes nunca tocan Supabase directamente.

```
Supabase DB <-> Composable <-> Pinia Store <-> Componente Vue
                    ^
             Supabase Realtime
```

## Correr localmente

```bash
nvm use 20
npm install
cp .env.example .env.local  # agregar credenciales de Supabase
npm run dev
```

## Tests

```bash
npm test
```
