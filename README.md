# Melodi Music - Guía de Despliegue en Hostinger

## 1. CONFIGURAR REGLAS DE SEGURIDAD EN FIREBASE

### Firestore Rules
1. Ve a **Firebase Console** → **Firestore Database** → pestaña **Reglas**
2. Borra todo el contenido actual
3. Copia y pega el contenido del archivo `firestore.rules`
4. Haz clic en **Publicar**

### Storage Rules
1. Ve a **Firebase Console** → **Storage** → pestaña **Reglas**
2. Borra todo el contenido actual
3. Copia y pega el contenido del archivo `storage.rules`
4. Haz clic en **Publicar**

### Authentication - Dominio autorizado
1. Ve a **Firebase Console** → **Authentication** → **Settings** → **Authorized domains**
2. Añade tu dominio: `mcadance.es`
3. También añade: `www.mcadance.es`

---

## 2. COMPILAR EL PROYECTO

En tu ordenador, necesitas tener **Node.js 18+** instalado.

```bash
# 1. Descomprime el proyecto
# 2. Abre terminal en la carpeta del proyecto
cd melodi-app

# 3. Instala dependencias
npm install

# 4. Compila para producción
npm run build
```

Esto creará una carpeta `dist/` con los archivos estáticos.

---

## 3. SUBIR A HOSTINGER

### Opción A: File Manager (más fácil)
1. Entra en tu **Panel de Hostinger** → **File Manager**
2. Navega a la carpeta `public_html` de tu dominio `mcadance.es`
3. **BORRA** todo el contenido actual de `public_html` (si hay algo)
4. Sube **TODO el contenido** de la carpeta `dist/` (NO la carpeta en sí, sino su contenido)
5. Asegúrate de que `index.html` quede directamente en `public_html/`

### Opción B: FTP
1. Usa FileZilla o similar con los datos FTP de Hostinger
2. Sube el contenido de `dist/` a `public_html/`

---

## 4. CONFIGURAR .htaccess (IMPORTANTE)

Como la app usa HashRouter (#), normalmente no necesitas configuración extra.
Pero por si acaso, crea un archivo `.htaccess` en `public_html/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Cache para assets estáticos
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
```

---

## 5. VERIFICAR

1. Abre `https://mcadance.es` en tu navegador
2. Deberías ver la pantalla de login de Melodi Music
3. Inicia sesión con `caroslogar@gmail.com` o `mariluz151121@gmail.com`
4. Prueba a subir una canción o vídeo pequeño

---

## ESTRUCTURA DEL PROYECTO

```
melodi-app/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── ui/
│   │   │   ├── GlassCard.tsx
│   │   │   ├── StorageMonitor.tsx   # Monitor de consumo Firebase
│   │   │   └── UploadProgress.tsx   # Barra de progreso de subida
│   │   ├── Layout.tsx
│   │   ├── PlayerBar.tsx
│   │   └── Sidebar.tsx
│   ├── context/
│   │   └── AppContext.tsx    # Estado central con Firebase
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx         # Login con Firebase Auth
│   │   ├── Music.tsx         # Subida a Firebase Storage
│   │   ├── Videos.tsx        # Subida a Firebase Storage
│   │   ├── Playlists.tsx
│   │   ├── Settings.tsx      # Panel admin + Storage monitor
│   │   └── Trash.tsx         # Auto-limpieza a 5 días
│   ├── services/
│   │   ├── authService.ts    # Firebase Authentication
│   │   ├── firebase.ts       # Configuración Firebase
│   │   ├── playlistService.ts
│   │   ├── storageService.ts # Upload + monitoring + alertas
│   │   └── trackService.ts   # CRUD Firestore
│   ├── types.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── firestore.rules           # ← Copiar en Firebase Console
├── storage.rules             # ← Copiar en Firebase Console
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## NOTAS IMPORTANTES

- **Límite gratuito Storage:** 5 GB total. El monitor en la app te avisará al 80% y 95%.
- **Límite descarga diaria:** 1 GB/día. Con pocos usuarios no será problema.
- **Tamaño máximo por archivo:** 50 MB (configurable en Storage rules).
- **Solo los ADMIN pueden subir/editar/eliminar contenido.**
- **Los usuarios normales solo pueden ver y reproducir.**
- **La papelera se auto-limpia a los 5 días** eliminando también los archivos de Storage.
