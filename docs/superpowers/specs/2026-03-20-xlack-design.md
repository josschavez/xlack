# xlack — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Mini demo de mensajería en tiempo real (estilo Slack) para demostrar manejo de estados, arquitectura real y capacidades realtime. Flujo único: registro/login → seleccionar/crear canal → enviar y recibir mensajes en tiempo real.

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
  layouts/
    AppLayout.vue
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
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  username    text NOT NULL
  created_at  timestamp DEFAULT now()

channels
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name        text NOT NULL UNIQUE
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL
  created_at  timestamp DEFAULT now()

messages
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  content     text NOT NULL
  channel_id  uuid REFERENCES channels(id) ON DELETE CASCADE
  user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL
  created_at  timestamp DEFAULT now()
```

### Creación de perfil al registrarse

Al crear un usuario en `auth.users`, se debe crear automáticamente un registro en `profiles`. Esto se implementa con un trigger de Supabase:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

El campo `username` se pasa como metadata al registrarse en `authStore.register()`.

### Row Level Security (RLS)

| Tabla | Leer | Crear | Editar/Borrar |
|---|---|---|---|
| `profiles` | Autenticado | — (trigger) | Solo propio |
| `channels` | Autenticado | Autenticado | — |
| `messages` | Autenticado | Autenticado | Solo autor (forward-looking, no hay UI de borrado en v1) |

### Realtime

Subscripción activa en `messages` filtrada por `channel_id`. Al recibir un evento INSERT, `messageStore` agrega el mensaje al array local.

**Estrategia de mensajes propios:** No se hace append optimista local. El mensaje del emisor también llega vía Realtime como cualquier otro cliente. Esto simplifica la lógica (no hay deduplicación por ID) y garantiza consistencia — si el INSERT falla, el mensaje nunca aparece.

## Flujo de usuario

```
/login
  -> LoginView: form con tabs Login / Registro
  -> Registro: email + username + password -> authStore.register()
               -> Supabase signUp() con metadata {username}
               -> trigger crea profile automáticamente
  -> Login: email + password -> authStore.login()
  -> redirect a /app

/app
  -> carga lista de canales (channelStore.fetchChannels())
  -> usuario selecciona o crea canal
  -> channelStore.setActive(channel)
       -> llama messageStore.unsubscribe() para limpiar canal anterior
       -> llama messageStore.fetchMessages(channel.id)
       -> llama messageStore.subscribeToChannel(channel.id)
  -> subscripción Realtime activa en canal seleccionado

  -> usuario escribe mensaje + Enter
  -> messageStore.send(content) -> INSERT en Supabase messages
  -> Realtime event INSERT llega a todos los clientes (incluyendo emisor)
  -> messageStore.messages.push(newMessage)
  -> MessageList re-renderiza reactivamente con scroll automático al final
```

## Componentes

| Componente | Responsabilidad |
|---|---|
| `LoginView.vue` | Tabs Login/Registro, llama `authStore.login()` o `authStore.register()` |
| `AppLayout.vue` | Layout principal: sidebar izquierdo + area de chat |
| `ChannelSidebar.vue` | Lista canales del store, botón "Nuevo canal" |
| `CreateChannelModal.vue` | Input nombre + submit -> `channelStore.create()` |
| `MessageList.vue` | Renderiza mensajes, auto-scroll al ultimo |
| `MessageInput.vue` | Input texto + Enter -> `messageStore.send()` |

## Stores Pinia

### authStore
- `user` — usuario actual (null si no autenticado)
- `login(email, password)` — autentica con Supabase
- `register(email, username, password)` — registra usuario con metadata username
- `logout()` — cierra sesion y redirige a /login
- `init()` — restaura sesion desde Supabase al cargar la app

### channelStore
- `channels` — lista de canales
- `activeChannel` — canal seleccionado actualmente
- `fetchChannels()` — carga todos los canales
- `create(name)` — crea nuevo canal y lo selecciona
- `setActive(channel)` — cambia canal activo; coordina `messageStore.unsubscribe()`, `messageStore.fetchMessages()` y `messageStore.subscribeToChannel()`

### messageStore
- `messages` — mensajes del canal activo
- `loading` — estado de carga inicial
- `fetchMessages(channelId)` — carga historico de mensajes
- `send(content)` — inserta mensaje en Supabase (sin append optimista)
- `subscribeToChannel(channelId)` — activa Realtime listener; eventos INSERT agregan al array
- `unsubscribe()` — limpia subscripcion al cambiar de canal

## Routing

```
/login    -> LoginView (publica)
/app      -> AppLayout (requiere auth, redirect a /login si no autenticado)
```

Guard de navegacion en el router verifica sesion activa via `authStore.user`.

## Consideraciones de deploy (Netlify)

- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `netlify.toml` con redirect `/* -> /index.html` para SPA routing
