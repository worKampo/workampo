# Definition of Done

Un ticket está hecho cuando la ventana de observación de su Release sale limpia. Fuente: [ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md), [ADR-0020](../adr/0020-ticket-lifecycle.md), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md).

Esa condición incluye:

- [ ] `pnpm check` verde.
- [ ] Verify sin hallazgos abiertos.
- [ ] Document hecho: la living spec cubre todo el comportamiento cambiado; ayuda, changelog y capturas si el cambio es visible.
- [ ] Todos los ejemplos con su test (matriz "Verification" de CI).
- [ ] Momento 2: PR aprobada y mergeada con squash.
- [ ] Staging: smoke verde.
- [ ] Momento 3: lo marcado "Only verifiable in staging" probado y producción aprobada.
- [ ] Release: smoke de solo lectura y ventana de observación limpia (Sentry, métricas, SLOs).

Entonces el workflow de la ventana de observación cierra el issue. Si la ventana no sale limpia, el issue sigue abierto: si la persona ve que es una falsa alarma (una señal sin leer, un error ajeno a la release), la da por limpia y lo cierra con `pnpm work close <n>`; si es un fallo real, no se cierra y se sigue [ADR-0039](../adr/0039-operations-and-incidents.md) ([deploy](../runbooks/deploy.md#release-observation-window), [work](../procedures/work.md)).
