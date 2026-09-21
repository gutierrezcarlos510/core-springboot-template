---
name: Git Commits
description: Reglas y guía para Conventional Commits.
---

# Reglas para Commits de Git

Seguir especificación **Conventional Commits**:

## 1. Estructura del Mensaje
```
<tipo>[scope opcional]: <descripción corta>

[cuerpo opcional detallando el porqué de los cambios]
```

## 2. Tipos Permitidos
- **feat**: Nueva característica.
- **fix**: Corrección error.
- **docs**: Cambios documentación.
- **style**: Cambios formato/estilo (no lógica).
- **refactor**: Cambios código (no feat/fix).
- **perf**: Mejora rendimiento.
- **test**: Agregar/corregir pruebas.
- **chore**: Cambios build, herramientas, dependencias.

## 3. Reglas de Formato
- Primera línea <= 50 caracteres.
- Modo imperativo y presente en descripción (ej. "add feature").
- Sin punto al final de primera línea.
- Si rompe compatibilidad: añadir `!` antes de `:` (ej: `feat!: ...`) o `BREAKING CHANGE:` en pie.
- Cuerpo opcional envuelto a 72 caracteres.

## 4. Idioma
- Mensaje en **español**.
- Tipo en inglés, resto en español.

> **Ejemplo:**
> ```
> feat: agregar validación de IP en TenantFilter
>
> Se agrega una validación en el filtro TenantFilter para asegurar que
> la dirección IP del cliente sea válida antes de permitir el acceso.
> ```

## 5. Micro-Commits (Buenas Prácticas)
Commits **atómicos, pequeños, enfocados**:
- **Un cambio lógico por commit:** No mezclar cambios no relacionados.
- **Frecuencia constante:** Commits incrementales tras completar microtareas.
- **Build estable:** Cada commit debe compilar (`BUILD SUCCESS`).
- **Mensaje preciso:** Describir cambio exacto (ej. `style: remover imports no usados en DataSourceConfig`).

> **Nota:** **Nunca hacer `git push` automáticamente**.
