# Changelog — 30 de abril 2026

## Nuevas funcionalidades

### Franjas de cursos (Pablo scheduling)
- Nueva sección en **Settings → Franjas de cursos** con CRUD completo: curso, día, horario, fecha tentativa de inicio y estado
- El webhook de Pablo lee las franjas activas en cada request y las inyecta dinámicamente en su prompt
- Pablo ahora menciona fechas y horarios concretos al recomendar un curso, y gestiona el rechazo de franjas (propone siguiente franja disponible o pregunta disponibilidad entre semana)
- El selector de cursos en el diálogo de franjas se popula desde `virtual_courses` (fuente de verdad única)

### Grupos Virtuales
- Nueva columna **Día** en la lista de grupos, derivada de la fecha de inicio (fácil identificación sábados vs. entre semana)
- Columna **Fin** ahora muestra la fecha de la última sesión del grupo (antes estaba vacía porque `end_date` no se rellenaba)
- Auto-completado: al cargar la página, cualquier grupo activo/formando cuya última sesión ya pasó se marca automáticamente como **Completado**

### Navegación
- **Pruebas** (clases de prueba) de vuelta en el menú principal entre Leads y Pablo

## Correcciones

- **Settings → Cursos Virtuales**: el icono de editar dejaba la página en blanco — el `Select` de "Siguiente curso" usaba `value=""` (cadena vacía) que crashea Radix UI; reemplazado por centinela `"none"`
- **Settings → Franjas de cursos**: el icono de editar dejaba la página en blanco — PostgreSQL devuelve `time` como `HH:MM:SS` pero los Select solo tenían opciones `HH:MM`; ahora se recorta al abrir el diálogo
