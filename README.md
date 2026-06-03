# PapiGo - App Móvil

## Configuración para Build

### 1. Configurar Variables de Entorno

Edita `app.json` y cambia las URLs:

```json
"extra": {
  "API_URL": "http://TU_IP:3001/api",
  "SOCKET_URL": "http://TU_IP:3001"
}
```

### 2. Crear cuenta en EAS

```bash
# Login a Expo
npx expo login

# Configurar EAS
npx eas login
npx eas project:init
```

### 3. Build para Android (APK para pruebas)

```bash
# Build de desarrollo (más rápido)
npx eas build --platform android --profile preview

# Build de producción
npx eas build --platform android --profile production
```

### 4. Build para iOS

```bash
# Necesitas Mac con Xcode
npx eas build --platform ios --profile production
```

### 5. Instalar en dispositivo

El APK se descarga desde el link que EAS genera. También puedes:

```bash
# Instalar directamente en dispositivo conectado
npx expo run:android

# O usar ADB
adb install path/to/apk
```

## Estructura del Proyecto

```
mobile/
├── src/
│   ├── screens/          # Pantallas de la app
│   ├── context/         # Auth y API
│   ├── services/        # Socket.io
│   └── config.js        # URLs del servidor
├── assets/              # Iconos, splash
├── App.js               # Entry point
├── app.json             # Config de Expo
└── eas.json             # Config de EAS Build
```

## Requisitos

- Node.js 18+
- Expo CLI
- Cuenta de Expo (gratis)
- Cuenta de EAS Build (gratis para builds básicos)
- Google Maps API Key (opcional para producción)

## Notas Importantes

1. **Google Maps**: Para producción necesitas una API key de Google Cloud Platform
2. **Ubicación**: La app requiere permisos de ubicación
3. **Backend**: El servidor debe estar corriendo para que la app funcione
4. **URLs**: Cambia `localhost` por la IP de tu servidor para pruebas en dispositivo real
