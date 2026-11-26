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

@issue(#166)
Rule: El formulario de crear empresa explica qué es una empresa, guía la URL y anuncia lo que pasa

  @id:companies-166-1
  Example: Sin empresa veo qué es una empresa encima del formulario
    Given entro sin ninguna empresa
    Then veo, encima del formulario, qué es una empresa y que seré su propietario

  @id:companies-166-2
  Example: La URL muestra su prefijo y una ayuda antes de cualquier error
    Given escribo la URL de la empresa
    Then veo el prefijo de la dirección (…/c/) delante del campo
    And veo la ayuda "Minúsculas, números y guiones; algunos nombres están reservados" antes de cualquier error

  @id:companies-166-3
  Example: Una URL libre se muestra disponible como estado positivo
    Given la URL está libre
    Then "Disponible" se muestra en verde, como estado positivo

  @id:companies-166-4
  Example: Mientras se crea, el botón conserva el foco y anuncia que trabaja
    Given pulso "Crear empresa"
    Then el botón conserva el foco y anuncia "Creando…" hasta que termina

  @id:companies-166-5
  Example: Un rechazo del servidor sale en un aviso negativo encima del formulario
    Given el servidor rechaza la creación
    Then el error se muestra en un aviso negativo encima del formulario, con role alert

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

@issue(#91)
Rule: Al entrar llego a mi única empresa, al selector si tengo varias o a crear una si no tengo ninguna

  @id:companies-91-1
  Example: Con una sola empresa llego a ella
    Given pertenezco solo a "northwind"
    When entro
    Then llego a /c/northwind

  @id:companies-91-2
  Example: Con varias empresas veo el selector, por orden alfabético y sin rol
    Given pertenezco a "northwind", "sol-bakery" y "clinica-norte"
    When entro
    Then veo el selector con las tres empresas por orden alfabético, cada una con su nombre y su dirección
    And no veo mi rol en ninguna

  @id:companies-91-3
  Example: Sin ninguna empresa llego a crear una
    Given no pertenezco a ninguna empresa
    When entro
    Then llego al formulario de crear empresa

@issue(#91)
Rule: En el selector elijo una de mis empresas o creo otra, y solo cuentan mis membresías activas

  @id:companies-91-4
  Example: Elegir una empresa lleva a ella
    Given estoy en el selector
    When elijo "Sol Bakery"
    Then llego a /c/sol-bakery

  @id:companies-91-5
  Example: Desde el selector creo una empresa y puedo volver
    Given estoy en el selector
    When pulso "Crear una empresa nueva"
    Then llego al formulario de crear empresa
    And "Volver a mis empresas" me devuelve al selector

  @id:companies-91-6
  Example: Una membresía suspendida no aparece ni abre la empresa
    Given mi membresía en "sol-bakery" está suspendida
    When entro
    Then "sol-bakery" no aparece en el selector
    And /c/sol-bakery me responde 404

@issue(#91)
Rule: El inicio lleva a donde lleva entrar, y sin sesión a /login

  @id:companies-91-7
  Example: Con sesión, el inicio lleva al mismo destino que entrar
    Given tengo sesión
    When abro /
    Then llego a donde me lleva tener una empresa, varias o ninguna

  @id:companies-91-8
  Example: Sin sesión, el inicio lleva a /login
    Given no tengo sesión
    When abro /
    Then llego a /login

@issue(#92)
Rule: Dentro de una empresa, el menú muestra la empresa, mi rol y solo lo que ya existe

  @id:companies-92-1
  Example: El inicio muestra el menú con la empresa, mi rol e «Inicio» como página actual
    Given soy propietario de "Northwind Logistics" y uso un escritorio
    When abro /c/northwind
    Then veo el menú lateral con "Northwind Logistics", mi rol "Propietario" y la opción "Inicio" marcada como actual
    And veo "Bienvenido a Northwind Logistics"

  @id:companies-92-2
  Example: El menú no muestra lo que aún no existe
    Given abro el inicio de mi empresa
    Then no veo notificaciones, búsqueda, "Página pública", "Ajustes", uso del plan, prueba ni "Ayuda"

  @id:companies-92-3
  Example: «Tus direcciones» muestra solo la dirección de la app
    Given abro el inicio de mi empresa
    Then la tarjeta "Tus direcciones" muestra la dirección de la app de la empresa
    And no muestra la de la página pública

@issue(#92)
Rule: Desde el menú cambio de empresa y cierro sesión

  @id:companies-92-4
  Example: El botón de la empresa lleva a elegir otra
    Given estoy en el inicio de "northwind"
    When pulso el botón de la empresa y elijo "Sol Bakery"
    Then llego a /c/sol-bakery

  @id:companies-92-5
  Example: Cerrar sesión desde el menú de usuario
    Given estoy dentro de una empresa
    When abro mi menú de usuario y pulso "Cerrar sesión"
    Then mi sesión queda revocada y llego a /login

@issue(#92)
Rule: El menú se adapta al dispositivo y se maneja con teclado

  @id:companies-92-6
  Example: En el móvil el menú lateral se abre sobre la página y se cierra con Esc
    Given uso un móvil
    When pulso el botón de menú
    Then el menú lateral se abre sobre la página
    And al pulsar Esc se cierra y el foco vuelve al botón de menú

  @id:companies-92-7
  Example: En el escritorio el menú se pliega a una barra de iconos con tooltips
    Given uso un escritorio
    When pliego el menú lateral
    Then queda una barra de iconos, cada uno con su tooltip

@issue(#92)
Rule: Los nombres del menú se leen siempre completos

  @id:companies-92-8
  Example: Una cuenta sin nombre se muestra con su email
    Given mi cuenta no tiene nombre
    Then el botón de usuario muestra mi email

  @id:companies-92-9
  Example: Un nombre de empresa largo se corta y se lee entero en un tooltip
    Given el nombre de la empresa tiene 80 caracteres
    Then el menú lo corta con puntos suspensivos y muestra el nombre completo en un tooltip

@issue(#92)
Rule: La app se puede usar con teclado y lector de pantalla desde que carga

  @id:companies-92-10
  Example: El primer foco salta al contenido y la pestaña nombra la página y la empresa
    Given abro el inicio de mi empresa
    Then el primer elemento con foco es "Saltar al contenido"
    And el título de la pestaña es "Inicio · Northwind Logistics · worKampo"

  @id:companies-92-11
  Example: Una carga lenta muestra el cargador de la app, quieto con movimiento reducido
    Given la app tarda más de 300 ms en tener el layout
    Then veo el cargador de la app
    And con movimiento reducido el cargador no se anima
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
