# Access

## Purpose

Quién puede entrar y cómo: inicio de sesión, sesión, códigos de un solo uso y acceso del personal de soporte a una empresa («Enter as»: motivo, duración y auditoría). Sustituye al antiguo `auth` y a parte de `backoffice` ([ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md)).

## Rules

```gherkin
@wip(#91)
Rule: Se entra con un código que llega por email; la primera vez se crea la cuenta

  @id:access-96-1
  Example: Pedir un código lleva a la pantalla de código y la respuesta no lo contiene
    Given no tengo sesión
    When abro /login, escribo "ana@example.com" y pulso "Continuar"
    Then se pide a WorkOS un código para "ana@example.com"
    And veo la pantalla para escribir el código, que dice a qué email lo enviamos
    And la respuesta de nuestra API no contiene el código

  @id:access-96-2
  Example: El código correcto de un email sin cuenta crea la cuenta y abre sesión
    Given pedí un código para "ana@example.com" y no existe ninguna cuenta con ese email
    When escribo el código correcto
    Then se crea mi cuenta con el email "ana@example.com"
    And tengo sesión
    And llego al formulario de crear empresa

  @id:access-96-3
  Example: Un código incorrecto o caducado no abre sesión
    Given estoy en la pantalla de código
    When escribo un código incorrecto o caducado
    Then no tengo sesión
    And veo que el código no es válido y puedo pedir otro

@issue(#96)
Rule: Las peticiones de código y los intentos con código tienen un límite

  @id:access-96-4
  Example: Tras demasiados intentos no se comprueba el código
    Given superé el número de intentos permitido para un email (cuentan todos, aciertos incluidos)
    When escribo otro código
    Then no se comprueba
    And veo que debo esperar antes de intentarlo de nuevo

  @id:access-96-5
  Example: Tras demasiadas peticiones no se envía otro código
    Given pedí códigos para el mismo email más veces de las permitidas
    When pido otro
    Then no se envía
    And veo que debo esperar antes de pedir otro

@issue(#96)
Rule: Se entra con Google

  @id:access-96-6
  Example: Google confirma y vuelvo con sesión
    Given no tengo sesión
    When pulso "Continuar con Google" en /login y Google me confirma
    Then vuelvo a worKampo con sesión

  @id:access-96-7
  Example: Un state que no generó mi navegador no crea sesión
    Given vuelvo de Google con un "state" que no es el que generó mi navegador
    When llega la respuesta
    Then no se crea ninguna sesión

@wip(#91)
Rule: Tras entrar vuelvo a la página de la app que abrí; una dirección fuera de worKampo se ignora

  @id:access-91-1
  Example: Entrar con un código me devuelve a la página que abrí
    Given no tengo sesión
    When abro /c/northwind/settings y entro con un código
    Then vuelvo a /c/northwind/settings

  @id:access-91-2
  Example: Entrar con Google me devuelve a la página que abrí
    Given no tengo sesión
    When abro /c/northwind/settings y entro con Google
    Then vuelvo a /c/northwind/settings

  @id:access-91-3
  Example: Una dirección de vuelta de otro sitio se ignora
    Given abro /login con returnTo "https://otro-sitio.example.com"
    When entro
    Then no salgo de worKampo
    And llego a donde me lleva tener una empresa, varias o ninguna

@issue(#96)
Rule: Una identidad abre solo su cuenta enlazada; un email igual nunca enlaza solo

  @id:access-96-8
  Example: Una identidad enlazada entra en su misma cuenta
    Given tengo una cuenta enlazada a mi identidad de WorkOS
    When entro otra vez con código o con Google
    Then entro en esa misma cuenta
    And no se crea otra cuenta

  @id:access-96-9
  Example: Una identidad sin email verificado no entra
    Given WorkOS devuelve una identidad cuyo email no está verificado
    When completo la entrada
    Then no tengo sesión
    And veo un mensaje que me pide entrar con un email verificado

  @id:access-96-10
  Example: Una identidad nueva con el email de otra cuenta no entra ni se enlaza
    Given existe una cuenta con el email "ana@example.com" enlazada a otra identidad
    When entro con una identidad nueva cuyo email verificado es "ana@example.com"
    Then no tengo sesión
    And no se crea otra cuenta ni se enlaza la identidad
    And veo un mensaje que me pide contactar con soporte

  @id:access-96-11
  Example: Un email verificado nuevo se guarda en la cuenta al entrar
    Given mi identidad de WorkOS tiene ahora el email verificado "ana.nueva@example.com"
    When entro
    Then mi cuenta guarda el email "ana.nueva@example.com"

  @id:access-96-12
  Example: Un email verificado nuevo que es de otra cuenta no cambia nada
    Given mi identidad de WorkOS tiene ahora un email verificado que pertenece a otra cuenta
    When entro
    Then no tengo sesión
    And ninguna de las dos cuentas cambia
    And veo un mensaje que me pide contactar con soporte

@issue(#96)
Rule: La sesión es nueva en cada entrada, dura 30 días y se revoca al salir

  @id:access-96-13
  Example: La cookie de sesión es __Host-, HttpOnly, Secure y SameSite=Lax y sustituye a la anterior
    Given entro con éxito
    Then la cookie de sesión empieza por "__Host-" y es HttpOnly, Secure y SameSite=Lax
    And la sesión anterior de ese navegador, si la había, deja de valer

  @id:access-96-14
  Example: Cerrar sesión la revoca
    Given tengo sesión
    When pulso "Cerrar sesión"
    Then mi sesión queda revocada
    And si abro una página de la app vuelvo a /login

  @id:access-96-15
  Example: Una sesión de más de 30 días ya no vale
    Given mi sesión se creó hace más de 30 días
    When abro una página de la app
    Then vuelvo a /login

@issue(#96)
Rule: Las pantallas de entrada son nuestras, sin contraseña y en el idioma del navegador

  @id:access-96-16
  Example: /login y la pantalla de código no cargan nada de otro origen ni piden contraseña
    Given abro /login o la pantalla de código
    Then la página no carga ningún script, fuente ni imagen de otro origen
    And no muestra contraseña, "¿Olvidaste la contraseña?" ni "Crea una cuenta"

  @id:access-96-17
  Example: Con el navegador en español /login está en español
    Given mi navegador pide español
    When abro /login
    Then la página está en español

  @id:access-96-18
  Example: El smoke de staging entra con un código creado por la API de WorkOS
    Given el smoke de staging crea un código para su usuario con la API de WorkOS
    When lo escribe en la pantalla de código
    Then entra con sesión, sin usar ninguna contraseña
```

## Terms

- [user](../glossary.md#user)
- [staff](../glossary.md#staff)
- [company](../glossary.md#company)

## Out of scope

- Empresas, miembros, roles e invitaciones: `companies`.
- `backoffice` no es un dominio: aplica reglas de otros dominios; la salud del sistema es operaciones.
- Mecanismos técnicos y documentación de plataforma (`docs/platform.md`, runbooks): fuera de las specs.
