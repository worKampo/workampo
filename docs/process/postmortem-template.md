# Postmortem template

Postmortem sin culpables para incidentes SEV1 y SEV2 ([ADR-0039](../adr/0039-operations-and-incidents.md)). Se centra en el sistema y el proceso, no en personas. Se copia en el issue `sev:*` del incidente.

```markdown
## Summary
Qué pasó, en dos o tres líneas. Severidad (`sev:1` / `sev:2`).

## Timeline
Hora UTC · evento (detección, mitigación, arreglo, cierre).

## Impact
Quién se vio afectado, cuánto tiempo, qué datos o cobros.

## Root cause
Por qué ocurrió, hasta la causa del sistema o del proceso. PR causante: #N.

## What worked
Qué detectó o limitó el problema.

## Actions
Una por línea, cada una con su issue.
- [ ] #N · Acción

## Learnings
Líneas candidatas para `docs/learnings.md`, o el check automático, la línea de `AGENTS.md` o el procedimiento que las sustituye.
```

Las acciones entran como tickets; los aprendizajes siguen [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md).
