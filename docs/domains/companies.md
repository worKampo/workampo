# Companies

## Purpose

El ciclo de vida de la empresa y todo lo que la compone: slug, ajustes, miembros y roles, invitaciones, propiedad y borrado. Una empresa es un tenant ([ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md), [vision](../product/vision.md)).

## Rules

```gherkin
@issue(#90)
Rule: Quien tiene sesión crea una empresa y entra en ella como propietario y contacto principal

  @id:companies-90-1
  Example: Crear la primera empresa lleva a su página de inicio
    Given tengo sesión y no pertenezco a ninguna empresa
    When pulso "Crear empresa", escribo el nombre "Northwind Logistics" y pulso "Crear empresa"
    Then se crea la empresa con la dirección /c/northwind-logistics
    And soy su propietario y su contacto principal
    And llego a /c/northwind-logistics y veo "Bienvenido a Northwind Logistics"

@issue(#90)
Rule: La URL de la empresa se propone desde el nombre y tiene que ser válida, no reservada y libre

  @id:companies-90-2
  Example: La URL se propone desde el nombre, sin acentos
    Given estoy en el formulario de crear empresa
    When escribo el nombre "Clínica Norte"
    Then la URL propuesta es "clinica-norte"
    And veo "Disponible"

  @id:companies-90-3
  Example: Una URL que ya tiene otra empresa no está disponible
    Given existe una empresa con el slug "clinica-norte"
    When escribo el slug "clinica-norte"
    Then veo "No disponible"
    And no puedo crear la empresa

  @id:companies-90-4
  Example: Una URL reservada no se puede usar
    Given estoy en el formulario de crear empresa
    When escribo el slug "api"
    Then veo que es un nombre reservado
    And no puedo crear la empresa

  @id:companies-90-5
  Scenario Outline: Una URL con un formato no válido se rechaza
    Given estoy en el formulario de crear empresa
    When escribo el slug "<slug>"
    Then veo que el formato no es válido

    Examples:
      | slug        |
      | ab          |
      | mi--empresa |
      | -norte      |
      | norte-stg   |

@issue(#90)
Rule: El formulario pide solo el nombre, la URL, el idioma por defecto y, si falta, el nombre de la persona

  @id:companies-90-6
  Example: No hay casilla de términos
    Given estoy en el formulario de crear empresa
    Then no hay ninguna casilla de aceptación de términos

  @id:companies-90-7
  Example: El idioma elegido queda como idioma por defecto de la empresa
    Given elijo "Español" como idioma por defecto
    When creo la empresa
    Then la empresa tiene "es" como idioma por defecto

  @id:companies-90-8
  Example: Una cuenta sin nombre lo da al crear la empresa
    Given mi cuenta no tiene nombre
    When abro el formulario de crear empresa
    Then veo el campo "Tu nombre"
    And si escribo "Ana" y creo la empresa, mi cuenta guarda el nombre "Ana"

  @id:companies-90-9
  Example: Una cuenta con nombre no lo vuelve a dar
    Given mi cuenta ya tiene nombre
    When abro el formulario de crear empresa
    Then no veo el campo "Tu nombre"

@issue(#90)
Rule: Una empresa se crea una sola vez, aunque se envíe a la vez o se repita la petición

  @id:companies-90-10
  Example: Dos personas que piden a la vez la misma URL crean una sola empresa
    Given dos personas envían a la vez una empresa con el slug "sol"
    Then solo se crea una
    And la otra ve "No disponible"

  @id:companies-90-11
  Example: Repetir la misma petición completa una empresa a medias una sola vez
    Given la empresa quedó registrada pero su parte en el shard no llegó a escribirse
    When vuelvo a enviar el formulario con la misma petición
    Then la empresa queda completa una sola vez
    And entro en ella como propietario

@issue(#90)
Rule: Solo sus miembros entran en una empresa, y para el resto es como si no existiera

  @id:companies-90-12
  Example: La empresa de otros responde igual que una que no existe
    Given soy miembro solo de "northwind"
    When abro /c/sol-bakery o llamo a /api/t/sol-bakery/
    Then recibo 404, lo mismo que para una empresa que no existe

  @id:companies-90-13
  Example: Sin sesión, la página de una empresa lleva a entrar
    Given no tengo sesión
    When abro /c/northwind
    Then vuelvo a /login
```

## Terms

- [company](../glossary.md#company)
- [tenant](../glossary.md#tenant)
- [slug](../glossary.md#slug)
- [user](../glossary.md#user)
- [membership](../glossary.md#membership)
- [role](../glossary.md#role)
- [staff](../glossary.md#staff)
- [unit](../glossary.md#unit)
- [assignment](../glossary.md#assignment)
- [main contact](../glossary.md#main-contact)

## Out of scope

- Inicio de sesión, sesión y acceso del personal («Enter as»): `access`.
- Planes, límites y pagos: `billing`.
- Contenido y publicación de la landing: `public-site`.
- La pantalla puede estar en el backoffice, pero la regla vive aquí si `companies` posee el dato o la decisión (regla de propiedad).
