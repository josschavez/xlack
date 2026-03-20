# xlack — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Mini demo de mensajería en tiempo real (estilo Slack) para demostrar manejo de estados, arquitectura real y capacidades realtime. Flujo único: login → seleccionar/crear canal → enviar y recibir mensajes en tiempo real.

## Stack

- **Frontend:** Vue 3 + Vite + TypeScript
- **Estado global:** Pinia
- **Backend/DB/Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Deploy:** Netlify

## Arquitectura

### Principio central

Los composables manejan la lógica y comunicación con Supabase. Los stores Pinia guardan el estado reactivo. Los componentes Vue solo leen del store y disparan acciones — nunca tocan Supabase directamente.

```
Supabase DB <-> Composable <-> Pinia Store <-> Componente Vue
                    ^
             Supabase Realtime
             (subscripción activa)
```

### Estructura de carpetas

```
src/
  features/
    auth/
      composables/useAuth.ts
      stores/authStore.ts
      components/LoginView.vue
    channels/
      composables/useChannels.ts
      stores/channelStore.ts
      components/ChannelSidebar.vue
      components/CreateChannelModal.vue
    messages/
      composables/useMessages.ts
      stores/messageStore.ts
      components/MessageList.vue
      components/MessageInput.vue
  lib/
    supabase.ts
  router/
    index.ts
  App.vue
```

## Base de datos

### Tablas

```sql
profiles
  id          uuid PRIMARY KEY (FK -> auth.users)
  username    text NOT NULL
  created_at  timestamp DEFAULT now()

channels
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name        text NOT NULL UNIQUE
  created_by  uuid REFERENCES profiles(id)
  created_at  timestamp DEFAULT now()

messages
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  content     text NOT NULL
  channel_id  uuid REFERENCES channels(id)
  user_id     uuid REFERENCES profiles(id)
  created_at  timestamp DEFAULT now()
```

### Row Level Security (RLS)

| Tabla | Leer | Crear | Editar/Borrar |
|---|---|---|---|
| `profiles` | Autenticado | — | Solo propio |
| `channels` | Autenticado | Autenticado | — |
| `messages` | Autenticado | Autenticado | Solo autor |

### Realtime

Subscripción activa en `messages` filtrada por `channel_id`. Al recibir un evento INSERT, `messageStore` agrega el mensaje al array local sin recargar la página.

## Flujo de usuario

```
/login
  -> Supabase Auth (email/password)
  -> redirect a /app

/app
  -> carga lista de canales (channelStore)
  -> usuario selecciona o crea canal
  -> carga mensajes del canal activo (messageStore)
  -> subscripción Realtime activa en canal seleccionado

  -> usuario escribe mensaje + Enter
  -> INSERT en Supabase messages
  -> Realtime event llega a todos los clientes conectados
  -> messageStore.messages actualiza
  -> MessageList re-renderiza reactivamente
```

## Componentes

| Componente | Responsabilidad |
|---|---|
| `LoginView.vue` | Form email/password, llama `authStore.login()` |
| `AppLayout.vue` | Layout principal: sidebar izquierdo + area de chat |
| `ChannelSidebar.vue` | Lista canales del store, botón "Nuevo canal" |
| `CreateChannelModal.vue` | Input nombre + submit -> `channelStore.create()` |
| `MessageList.vue` | Renderiza mensajes, auto-scroll al ultimo |
| `MessageInput.vue` | Input texto + Enter -> `messageStore.send()` |

## Stores Pinia

### authStore
- `user` — usuario actual (null si no autenticado)
- `login(email, password)` — autentica con Supabase
- `logout()` — cierra sesion y redirige a /login
- `init()` — restaura sesion desde Supabase al cargar la app

### channelStore
- `channels` — lista de canales
- `activeChannel` — canal seleccionado actualmente
- `fetchChannels()` — carga todos los canales
- `create(name)` — crea nuevo canal y lo selecciona
- `setActive(channel)` — cambia canal activo, dispara carga de mensajes

### messageStore
- `messages` — mensajes del canal activo
- `loading` — estado de carga inicial
- `fetchMessages(channelId)` — carga historico de mensajes
- `send(content)` — inserta mensaje en Supabase
- `subscribeToChannel(channelId)` — activa Realtime listener
- `unsubscribe()` — limpia subscripcion al cambiar de canal

## Routing

```
/login    -> LoginView (publica)
/app      -> AppLayout (requiere auth, redirect a /login si no)
```

Guard de navegacion en el router verifica sesion activa via `authStore.user`.

## Consideraciones de deploy (Netlify)

- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `netlify.toml` con redirect `/* -> /index.html` para SPA routing
