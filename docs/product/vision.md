# Visión del producto

> Estado: borrador. Nombre: **workampo**. Sin dominio propio en esta etapa (`*.workampo.workers.dev`); `workampo.com` aparece en los ejemplos como dominio futuro.
> Este documento es la entrada del slicer para crear PRDs. Todo PRD hereda lo que dice aquí sin repetirlo.

## Visión

Una base SaaS multitenant sobre Cloudflare sobre la que montar cualquier negocio: empresas (`companies`), personas (`users`) y membresías (`members`), con una web pública editable por cada empresa. La base no contiene lógica de negocio; el modelo no debe impedir que distintas empresas usen negocios distintos, pero no se implementa nada para ello hasta que haga falta.

## Política de idioma

| Ámbito | Idioma |
|---|---|
| Código, identificadores, esquema de base de datos, rutas de API, variables de entorno, scripts | **Inglés** |
| Nombres de ficheros y carpetas, ramas, etiquetas de GitHub, dominios (`area:companies`), slugs de ramas | **Inglés** |
| Commits (conventional commits), títulos de PR, nombres de tests, comentarios de código | **Inglés** |
| Palabras clave de los ejemplos (`Given` / `When` / `Then`), nombres de pasos del ciclo (`Discover`, `Specify`…) | **Inglés** |
| `AGENTS.md`, definiciones de agentes, procedimientos (`docs/procedures/`), runbooks, ADRs | **Inglés** (base técnica que leen los agentes) |
| Descripción de procesos, PRDs, specs, discusión en issues y PRs | Español permitido |
| Interfaz de usuario, emails, ayuda (`/docs`), changelog, páginas legales | **Multiidioma (i18n) desde el inicio: `en` por defecto y `es` (es-ES)** (D47) |

- Los términos del sector se usan tal cual (PRD, spec, staging, release, rollback, hotfix, SLO…) y están definidos en `docs/glossary.md`.
- Las landings de empresa están en el idioma que elige cada empresa (su contenido lo escribe ella).

## Requisitos no funcionales globales

Todos los PRDs y tickets los heredan.

- **Aislamiento entre empresas**: ningún dato de una empresa es accesible desde otra. Comprobado por la suite de aislamiento (D29).
- **Seguridad**: checklist de D32; zonas críticas siempre con revisión de seguridad.
- **Accesibilidad**: WCAG 2.2 AA (D31).
- **Internacionalización**: ningún texto visible al usuario en el código; fechas, números y moneda con `Intl` (D47).
- **SEO**: páginas públicas con Lighthouse ≥ 90 en las cuatro categorías (D31).
- **Protección de datos**: RGPD (D27).
- **Fiabilidad**: SLOs de D39.
- **Coste**: cero en desarrollo y beta; producción con tráfico real probablemente en Workers Paid (5 $/mes).

## MVP

Lo imprescindible para que los primeros clientes prueben la herramienta, sin cobrar. Vive en el milestone [MVP](https://github.com/worKampo/workampo/milestone/1) de GitHub; lo planificado para después, en [Post-MVP](https://github.com/worKampo/workampo/milestone/2). Decidido por la persona el 2026-11-21 (#55).

**Ninguna idea se queda fuera del proyecto, solo fuera del MVP.** Todo lo nuevo (una idea, una issue, un hallazgo) se captura como issue y se clasifica en uno de los dos milestones. Si solo una parte es imprescindible, se parte: esa parte va al MVP y el resto a Post-MVP, enlazadas entre sí. Una issue sin milestone está sin clasificar (salvo el Dependency Dashboard de Renovate, #2).

| PRD | En el MVP |
|---|---|
| **Access and first company** (PRD #10) | Entero |
| **Team** (PRD #11) | Como mínimo, invitar y quitar miembros |
| **Marketing site, help and legal** (PRD #15) | Landing y textos legales (RGPD, cookies); precios, cuando haya planes |
| **Account deletion and data rights** (PRD #16) | Borrar la cuenta y exportar los datos |
| **Backups and recovery** (PRD #17) | Entero |

De plataforma entran los casos límite del despliegue y de la ventana de observación (#36), las alertas de Sentry (#48) y el check de palabras de cierre con `verify` sin credenciales (#57). En Post-MVP: Plans and billing (#13), porque las primeras etapas son para probar la herramienta, sin cobrar; Company public site (#12), Staff backoffice (#14), Global templates (#21), las mejoras del proceso (#18, #19, #20, #27, #32, #34), la guía de marca fuera del código (#60) y los spikes #22, #24 y #25. La lista viva es el milestone [Post-MVP](https://github.com/worKampo/workampo/milestone/2).

## Roadmap (Now / Next / Later)

Sin fechas comprometidas; ordenado por valor y riesgo. Cada fila es un PRD, nombrado por su título. Al crear su issue (`[PRD] <título>`) se añade su enlace, p. ej. "Team (PRD #11)": el único identificador es el número de issue (D42).

Columna "Dominios": specs vivas que toca el PRD (`access`, `companies`, `billing`, `public-site`); "(apoyo)" marca etiquetas que solo filtran el tablero (`platform`, `content`, `backoffice`), sin spec viva (D52).

Hecho: **Working foundation** (PRD #4), cerrado el 2026-11-20.

### Now
| PRD | Problema que resuelve | Dominios |
|---|---|---|
| **Access and first company** (PRD #10) | Nadie puede entrar ni tener una empresa | `access`, `companies` |

### Next (MVP)
| PRD | Problema que resuelve | Dominios |
|---|---|---|
| **Team** (PRD #11) | Una empresa tiene un solo usuario | `companies`, `access` |
| **Marketing site, help and legal** (PRD #15) | No hay escaparate, ayuda ni textos legales | `content` (apoyo) |
| **Account deletion and data rights** (PRD #16) | No se puede borrar ni exportar lo de una empresa | `companies` |
| **Backups and recovery** (PRD #17) | Solo hay 7 días de Time Travel. Obligatorio antes de abrir a clientes reales | `platform` (apoyo) |

### Later (después del MVP)
| PRD | Problema que resuelve | Dominios |
|---|---|---|
| **Plans and billing** (PRD #13) | No hay ingresos ni diferencia entre planes | `billing` |
| **Company public site** (PRD #12) | Las empresas no tienen presencia pública | `public-site` |
| **Staff backoffice** (PRD #14) | El equipo no puede ver ni gestionar empresas, dar soporte desde dentro ("Enter as", D50) ni ver la salud del sistema | `access`, `companies`, `backoffice` (apoyo) |
