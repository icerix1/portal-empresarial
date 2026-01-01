# Portal Empresarial

Portal web para gestión de documentos y publicaciones.

## Ejecutar Localmente

### Opción 1: Abrir directamente
Simplemente abre el archivo `index.html` en tu navegador.

### Opción 2: Servidor local (recomendado)
```bash
# Instalar servidor (solo primera vez)
npm install -g serve

# Ejecutar
npm start
```
Luego visita: http://localhost:3000

## Publicar en Internet

### Opción 1: Netlify (Gratis - Recomendado)
1. Ve a [netlify.com](https://netlify.com)
2. Crea una cuenta gratis
3. Arrastra esta carpeta completa a Netlify
4. ¡Listo! Tendrás una URL pública

### Opción 2: GitHub Pages (Gratis)
1. Crea un repositorio en GitHub
2. Sube estos archivos
3. Ve a Settings > Pages
4. Selecciona la rama "main"
5. Tu sitio estará en: `https://tuusuario.github.io/nombrerepo`

### Opción 3: Vercel (Gratis)
1. Ve a [vercel.com](https://vercel.com)
2. Conecta tu repositorio de GitHub
3. Se publicará automáticamente

## Estructura del Proyecto

```
├── index.html    # Página principal
├── styles.css    # Estilos
├── script.js     # Funcionalidad
├── package.json  # Configuración npm
└── README.md     # Este archivo
```

## Características

- ✅ Subida de archivos con drag & drop
- ✅ Sistema de publicaciones/blog
- ✅ Datos guardados en el navegador
- ✅ Diseño responsive
- ✅ Sin dependencias de servidor
