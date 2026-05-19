# Instrucciones del Proyecto - FITLAB CHAT

## Flujo de Trabajo
- **Git Automático**: Después de realizar cualquier cambio exitoso o completar una tarea, el agente DEBE realizar un `git commit` con un mensaje descriptivo y un `git push origin main` de forma automática. No es necesario pedir confirmación para estas acciones de Git.

## Arquitectura y Estilo
- El proyecto utiliza React 19 con TypeScript y Vite.
- Base de datos: Supabase (tablas con prefijo `tj_`).
- Estilos: Tailwind CSS con estética "dark mode" y acentos en verde neón (`#CCFF00`) y morado (`Anytime Fitness`).
