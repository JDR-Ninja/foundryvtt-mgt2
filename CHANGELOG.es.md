# Changelog — MGT2

[Français](CHANGELOG.fr.md) · [English](CHANGELOG.en.md) · [Português (Brasil)](CHANGELOG.pt-BR.md)

> La interfaz está completa en español. El vocabulario Traveller sigue las traducciones comunitarias
> de Mongoose allí donde nombran un término; los títulos de los libros y los nombres de rasgos se
> quedan en inglés, a falta de una edición española que los nombre.

---

## [0.2.3]

**Verificado en Foundry VTT 14.368.**

**La creación, releída regla por regla contra el libro.** Una auditoría completa de la creación de
Viajeros encontró una treintena de lugares donde un campo, un control o una regla existían sin que
nada los leyera: una bonificación de rango que nunca se pagaba, entradas pendientes sin efecto, un
reclutamiento reducido a una frase. Todos están corregidos, y la educación previa a la carrera por fin
funciona ([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). El sistema sigue sin traer
ninguna carrera ni ninguna tabla: hace funcionar las que el árbitro escribe o importa.

### ⚠ Cambios que rompen

* **Una comisión obtenida cierra la tirada de Progresión del periodo** (Core p.19). De 0.2.0 a 0.2.2
  se seguía la antigua actualización del libro, que lo permitía; la edición 2022 dice lo contrario, y
  es la que manda. Una tirada de Comisión fallida deja abierta la Progresión.
* **Cada tirada del periodo se hace una sola vez** (Core p.18-19): un paso ya hecho se rechaza en vez
  de repetirse, y una cualificación rechazada cierra el periodo a las demás carreras, salvo a una que
  esté siempre abierta. El árbitro puede reabrir un paso hecho por error (↺ *Reabrir este paso*).
* **Una sola carrera a la vez**: soltar una carrera sobre un Viajero que ya sirve en otra se rechaza.
* **Una carrera de entrada forzosa, como el Prisionero, ya no se elige voluntariamente** (Core p.52):
  se entra por una condena dejada pendiente, por el reclutamiento o por mano del árbitro.
* **Migración de los mundos.** Ninguna carrera servida había recibido su destino ni su escalafón. La
  primera vez que un mundo se abre en 0.2.3, cada carrera ya servida recibe su destino donde falta y
  la plantilla solo ofrece uno, y luego el escalafón que ese destino nombra. **El rango nunca se
  modifica**, y las bonificaciones de rango que la carrera nunca pagó no se pagan a posteriori: el
  árbitro recibe la lista en un mensaje privado.
* **Para scripts y módulos**: la prueba de una fila de Sucesos nombra ahora una lista,
  `check.skills`, en vez de `check.skill` — una plantilla guardada antes se lee tal cual. La línea de
  Facturas médicas de una carrera (`medicalBillsRow`) toma uno de tres identificadores, `military`,
  `civilian` o `independent`, y una etiqueta escrita como la imprime el libro se sigue reconociendo.

### Educación previa a la carrera

* **Una carrera del tipo *Educación previa a la carrera* sigue por fin sus propias reglas** (Core
  p.16-17): solo se entra durante los tres primeros periodos, un intento por periodo, con el MD del
  periodo; un rechazo deja el periodo a una carrera.
* **Durante la educación**: las habilidades que enseña —una universidad las elige en su propia tabla,
  una academia militar las lee en las Habilidades de Servicio de su carrera—, una tirada en los
  Sucesos previos a la carrera, y **ni tirada de Supervivencia, ni Comisión, ni tirada de
  Beneficio**. El periodo cuenta igualmente para la edad, el envejecimiento y la PSI.
* **La graduación** se tira como la educación la imprime, con sus honores, su umbral de fracaso y
  sus MD condicionales. Lo que deja —un MD de cualificación, un MD o un éxito automático en la
  primera tirada de Comisión, la entrada directa en la carrera de la academia— vale para **la primera
  carrera que se intente después**, y se pierde si esa carrera rechaza al Viajero. Un cadete que
  fracasa sin sacar 2 o menos conserva su plaza, sin tirada de Comisión el primer periodo; un Suceso
  «no te gradúas» prohíbe la tirada.
* **Una educación no es una carrera anterior** (Core p.16): la primera carrera que la sigue conserva
  toda su instrucción básica y no sufre el MD−1 por carrera anterior, salvo que la nueva regla
  opcional diga otra cosa. Se pueden cursar dos educaciones seguidas —una interpretación: el libro
  solo fija la ventana y un intento por periodo.
* **El formulario de carrera gana un bloque *Educación***: la ventana, los MD por periodo, la carrera
  vinculada, la duración (los 22 + 2D3 años del Companion se escriben `4+2D3`), las habilidades
  elegidas, lo concedido al entrar, y la graduación con sus tres resultados. Las opciones del
  Companion (p.32-34) también se escriben ahí.

### Tablas compartidas

* **Los Sucesos Vitales, el Suceso insólito, el Reclutamiento, los Sucesos previos a la carrera y las
  Habilidades de trasfondo tienen un lugar**: cada una es una carrera del tipo *Tabla compartida*,
  que el árbitro vincula en el menú *Tablas de creación compartidas* de los ajustes del mundo. El
  sistema no trae ninguna.
* **La ficha de una tabla compartida solo muestra su tipo y sus Sucesos**: el resto de la carrera,
  que una tabla no lee, sigue guardado y vuelve si se regresa al tipo *Carrera*.
* **Una vez vinculadas, se juegan como las filas de una carrera**: un 7 en Sucesos tira los Sucesos
  Vitales, y una fila que nombra una tabla la tira y la aplica —un contacto, una traición, un MD
  pendiente, una tirada de Beneficio perdida, el Prisionero—. Sin tabla vinculada, el sistema sigue
  diciendo cuál tirar en el libro.
* **El reclutamiento se juega** (Core p.19): una cualificación rechazada ofrece el reclutamiento, una
  vez en la vida, una carrera siempre abierta como el Vagabundo, o decidir más tarde. El
  reclutamiento tira la tabla vinculada y entra en la carrera obtenida, con el destino impreso, sin
  tirada de cualificación. Un Suceso que recluta impone esa carrera el periodo siguiente (Core p.17).
* **Las Habilidades de trasfondo** ofrecen su lista donde la especie no imprime ninguna (Core p.9).

### El periodo

* **Entrar en una carrera pide el destino**, antes de la tirada, y escribe el escalafón que nombra.
  Cambiar de destino en el Agente, el Ciudadano, el Artista o el Mercader abre una carrera nueva
  (Core p.20): el periodo se cierra, y el siguiente se cualifica para el nuevo destino.
* **Las entradas pendientes hacen lo que dicen**: un éxito automático supera el ascenso o la comisión
  sin dados, una prohibición impide su tirada, una carrera ofrecida se entra sin cualificarse, una
  carrera impuesta es la única abierta, una carrera bloqueada retira *Continuar*, una carrera
  desbloqueada levanta el permiso del árbitro. Un MD de Progresión puede servir para la tirada de
  Comisión, a elección del jugador (Core p.19). **El árbitro añade o quita una entrada a mano.**
* **Las filas de Sucesos**: su efecto en las tiradas de Beneficio puede depender de su propia prueba,
  y las apuestas de la Armada, el Mercader y el Pícaro se juegan (Core p.35, p.37, p.41) —una apuesta
  aceptada, rechazada o elegida entre las tiradas debidas, y una victoria que paga la mitad de lo
  apostado, redondeando hacia arriba—. Una prueba «si aprovechas esta oportunidad» puede rechazarse.
  Una fila puede conceder su habilidad **antes** de su prueba, como la imprimen la Armada y el Pícaro;
  una prueba impresa sobre dos o tres habilidades se hace con la mejor del Viajero, y una fila puede
  subir un nivel la habilidad usada, como el Mercader —una interpretación del orden impreso, que
  ninguna errata zanja.
* **Lesiones y atención médica** (Core p.49): una fila que remite a las Lesiones las tira como la
  fila las imprime, el jugador reparte las pérdidas, y la atención cuesta Cr5000 por punto, menos la
  parte del empleador leída en las Facturas médicas; el resto es una deuda, pagada primero con el
  dinero del licenciamiento (Core p.52).
* **Los anagáticos** (Core p.49): desde SOC 10, dos tiradas de Supervivencia por periodo, los
  periodos de tratamiento como MD positivo al envejecimiento, 1D × Cr25000 por periodo llevados como
  deuda, y una tirada de envejecimiento en cuanto se dejan; un 2 exacto lleva al Prisionero.
* **El Prisionero** (Core p.52, p.57): el Umbral de Libertad Condicional se tira al entrar, un preso
  no puede marcharse, y la liberación —por la Progresión o por una fuga— pone fin a la carrera.

### Especies

* **Los tres periodos mínimos de los Aslan en una carrera antes de intentar otra** (Aliens of Charted
  Space 1 p.19): la decisión del periodo lo recuerda, una carrera dejada por decisión propia antes de
  tiempo rechaza la siguiente —el licenciamiento sigue abierto—, y una carrera que la especie exime,
  o que un Suceso ofrece o impone, nunca se rechaza.
* **Una carrera reservada a una especie o a un sexo** rechaza a los demás Viajeros; una especie
  nombrada sin su variante las admite todas.
* **Una característica de sustitución** —el CHA de los Vargr, la RES de los Hiver (Aliens of Charted
  Space 1 p.179, 2 p.255)— se muestra en lugar de la que sustituye y ocupa su puesto en el PUP.
* **Los modificadores y los dados de una especie pueden depender del sexo**, como los del Gurvin
  (Aliens of Charted Space 4 p.167); un Viajero cuyo sexo aún no está fijado tira los dados comunes, y
  la ventana lo dice.
* **La asignación de características**: una casilla con los dados propios de la especie, como el
  1D+6 de los Hiver, conserva su tirada; un dado de ventaja se suma a esos dados; un valor impreso en
  vez de tirado, como el TER de 0 de los Aslan, cuenta como fijado.
* **Un contador que *solo sube* nunca baja**, sea cual sea la regla del mundo.
* **Un marco de especie impone su característica a la tirada de Supervivencia y a la Comisión**,
  como ya hacía con la Progresión.

### Licenciamiento

* **Una tirada de Beneficio solo se ofrece a una carrera que todavía la debe** (Core p.46), y la
  cuenta ya no baja de cero.
* **Las cláusulas de repetición impresas** (Core p.47): un arma recibida dos veces puede convertirse
  en un nivel de habilidad, se paga otro cuarto de la hipoteca, una Nave Explorador se vuelve a tirar.
* **Un aumento de característica se detiene en el máximo de la especie**, 15 para un humano (Core
  p.9), y el SOC sobrante obtenido en una tabla de Beneficios se convierte en participaciones de nave
  (Core p.47).
* **Las participaciones de nave aportadas a la nave conservada** ya no pagan los Cr1000 anuales (Core
  p.48; contarlas por participación es una interpretación), y terminar la creación cuando varios
  Viajeros conservan una nave se señala.
* **Los modificadores permanentes llegan a la tirada de Beneficio**, como el FOL 10+ de los Truthers
  (Companion p.36).
* **Los Cr10000 de equipo que se pueden comprar antes del juego** se muestran (Core p.46).

### Psiónica

* **Un nuevo entrenamiento psiónico cuesta Cr100000** (Core p.228): el primero es gratuito, y cada
  nuevo, que reinicia la penalización acumulada, se paga con el dinero del Viajero o como deuda. Una
  interpretación: el libro no pone ningún precio durante la creación.
* **Un talento obtenido en una tabla de habilidades** es una prueba para aprenderlo (Core p.229), y ya
  no un talento adquirido de entrada.

### Contactos

* **Un contacto puede vincularse a la ficha de un Viajero o de un PNJ**: suelta el Actor sobre la
  ficha del contacto, que lo abre con un clic y puede desvincularlo.

### Reglas opcionales y variantes

* **Nueva, activada**: *Un Viajero expulsado conserva la tirada de habilidad del periodo* —una
  interpretación, ya que el libro quita la tirada de Beneficio y la carrera sin decir nada de la
  tirada de habilidad (Core p.18)—. El registro del periodo dice en qué sentido juega.
* **Nueva, desactivada**: *La educación previa cuenta como una carrera anterior*.
* *El dinero gastado durante la creación se convierte en deuda* cubre también la atención médica,
  los anagáticos y un nuevo entrenamiento psiónico.

### Demostración y documentación

* **`Demo — Harbour Cadet School`** se une a los objetos de demostración: una academia vinculada a
  `Demo — Harbour Patrol`, para ver una educación de principio a fin.
* **`Demo — Harbour Life Events`** también: una tabla compartida inventada, que se vincula en *Tablas
  de creación compartidas*, cuyas filas muestran lo que hace una tabla —el Suceso insólito y las
  Lesiones como subtablas, una tirada de Beneficio perdida, un Rival o un Enemigo, una traición, MD
  pendientes, una prohibición—.
* **`Demo — Harbour Patrol` muestra las nuevas filas de Sucesos**: una prueba opcional, una apuesta
  con lo concedido antes de la prueba, una prueba sobre dos habilidades que sube un nivel la usada,
  un éxito automático pendiente. Paga su bonificación de rango 0 y nombra su línea de Facturas
  médicas.
* **El diario de auditoría de reglas** (`mgt2.docs`) describe la creación tal como es ahora.

### Correcciones

* **Las bonificaciones de rango de tropa y civiles nunca se pagaban**: solo pagaba un grado de
  oficial, tras una comisión. El rango 0 se paga al entrar, y cada ascenso paga el suyo (Core p.19).
* **«Tira en la tabla de Percances» no tiraba la tabla** (Core p.23). Ahora se tira, y el Viajero se
  queda en la carrera cuando la fila lo dice.
* ⚠ **El formulario de carrera borraba datos en cada guardado**: la referencia a un Otro Beneficio,
  la relación de un contacto (Aliado, Rival, Enemigo), el mínimo de «SOC 10 o SOC +1» y una lista de
  especialidades desaparecían en cuanto se editaba otro campo, y un MD de cualificación condicional
  no se podía escribir. Una carrera importada y luego retocada puede haber perdido alguno:
  compruébala.
* **Un MD «para tu próxima tirada de Supervivencia» lo gastaba la tirada de envejecimiento**, y un MD
  de Progresión duradero se sumaba a las pruebas de los Sucesos.
* **Un Percance que no expulsa anulaba igualmente** el Suceso, la Comisión y la Progresión del
  periodo (Core p.18).
* **Una Conexión no añadía nada a una habilidad ya poseída** (Core p.19): la sube un nivel, hasta 3.
* **Las pérdidas del envejecimiento podían caer todas en la misma característica** (Core p.49).
* **La Telepatía solo era gratuita mientras no se poseía ningún talento**: lo es mientras no se ha
  intentado ninguna prueba (Core p.228-229).
* **El número de habilidades de trasfondo** difería entre la marca y la ventana de elección, y una
  especie que las da «además», como los Hiver, las veía ocupar la cuenta.
* **Una columna de Efectivo vacía**, en una carrera escrita a mano, pagaba Cr0 y gastaba una tirada:
  ahora pide la cantidad. Un beneficio de característica o de habilidad elegido a mano se aplica en
  el acto.
* **La generación en solitario no concedía su habilidad de nivel 1**, y un Viajero muerto en Iron
  Man seguía con su periodo (Companion p.13).

---

## [0.2.2]

**Verificado en Foundry VTT 14.368.**

### Correcciones

* **La ventana *Reglas opcionales y variantes* se desplaza**: el final de la lista era inaccesible,
  incluso a pantalla completa ([#6](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/6)). Tres
  ventanas tenían el mismo defecto: la descripción completa de una especie, la elección de un
  beneficio de licenciamiento y el *Entrenamiento psiónico*.
* Cambiar de especie durante la creación ya no muestra un aviso de compatibilidad en la consola.

---

## [0.2.1]

**Los pasos que la creación nunca tuvo.** 0.2.0 traía el bucle de periodos sin los tres pasos que
lo preceden, y sin controles para varias reglas que ya calculaba.

### Creación de Viajeros

* **Las características ya se tiran**, desde la pantalla de creación —una marca antes de los
  periodos, que conserva el PUP obtenido— y desde el banner de la ficha una vez iniciada la creación.
* **Los cuatro métodos de asignación del ajuste funcionan**: en cualquier orden, en el orden impreso,
  o los 12D del Companion repartidos por parejas, variante heroica incluida. Donde un marco impone
  sus propios dados, o hay dados de ventaja en juego, la reserva se rechaza **con una frase** en vez
  de en silencio.
* **Las habilidades de juventud ya se toman** (Core p.9) —DM de EDU + 3, una segunda marca antes de
  los periodos, a nivel 0—. Una habilidad que el marco *declara* llena su propia fila: se impone en
  vez de ofrecerse.
* **La Fuerza Psiónica se prueba y se entrena** (Core p.228), donde la mesa ha adoptado la
  característica: primero la prueba, luego la ventana de entrenamiento —la escala de talentos, la
  Telepatía gratis como primera, la penalización acumulada por intento—. **Un nuevo entrenamiento es
  un control aparte**, porque cuatro meses y Cr100000 no son un efecto secundario de mirar, y es lo
  que por fin reinicia esa penalización, como su ajuste siempre dijo.
* **La regla de conexiones ya es jugable** (Core p.19): dos Viajeros, una habilidad cada uno, el
  suceso compartido anotado. Vive en la cabecera de la pantalla porque escribe en dos Viajeros a la
  vez, algo que ninguna ficha puede hacer; los cuatro rechazos impresos se nombran uno a uno.
* **Una traición cambia de bando a una relación en vez de inventar otra** (Core p.20): un Contacto o
  Aliado pasa a Rival o Enemigo, y el repliegue impreso se aplica cuando no hay ninguno.
* **Una columna acepta la especie que se suelta en ella** —cabecera o celda— y **sustituye** la que ya
  está allí, tras confirmar. Las pistas que solo declaraba el marco anterior se van con él.
* **La cabecera declara los términos de la mesa**: el método de asignación, y solo lo que se aparta
  del juego impreso.

### Correcciones

* Soltar una especie sobre un Viajero en blanco **le quitaba el botón *Empezar* de la ficha**.
* Lo que la pantalla de creación no puede aceptar ahora **se rechaza en voz alta** en vez de
  desaparecer.
* ⚠ **Un coste incurrido durante la creación llevaba los créditos por debajo de cero**, y el ajuste
  *El dinero gastado durante la creación se convierte en deuda* no tenía ningún efecto. Ese coste
  ahora paga lo disponible, lleva el resto como deuda, y **rechaza por entero** donde la regla está
  desactivada.

---

## [0.2.0]

**La versión más grande que ha tenido este sistema.** 0.1.x era una hoja de personaje; 0.2.0 es un
sistema de juego. Siete tipos de Actor, dieciocho tipos de Objeto, creación de Viajeros en grupo,
combate espacial y batallas entre flotas, comercio especulativo y tráfico de escala, viajes y salto,
formación, la cadena de daño completa, cuarenta y nueve reglas opcionales, un compendio de
documentación en cuatro idiomas y una demostración comentada de cada tipo que el sistema declara.

### ⚠ Cambios que rompen

* **Requiere Foundry VTT v14** (14.366 como mínimo). Ya no funciona en v11 a v13.
* **El tipo de Actor `vehicule` desaparece**, sustituido por `vehicle`, y **no se incluye migración**
  — los dos no comparten casi ningún campo, así que una conversión no traería casi nada. Un Actor del
  tipo antiguo **no se borra**: su fila sigue en la base de datos. Pero Foundry ya no puede
  construirlo, así que desaparece del directorio de Actores y la consola informa *is not a valid
  type* en cada carga. Si tienes vehículos, **anota lo que llevaban antes de actualizar** y vuelve a
  introducirlos en la hoja nueva.
* **Soltar una Especie ya no modifica el Atributo almacenado.** La Especie pasa a ser un Objeto
  incrustado y su modificador se deriva. La migración resta el bonificador ya escrito y **registra
  cada resta** en la consola, por nombre de Actor. Dos casos no pueden resolverse y se informan en
  lugar de adivinarse: un Viajero cuya Especie ya no está en el mundo se deja tal cual, y **un Viajero
  que recibió dos veces la misma Especie conserva una copia del bonificador** — nada en los datos
  distingue un soltado de dos. Revísalos a mano.
* **El PUG escrito a mano desaparece**: se deriva de los seis Atributos canónicos.
* **El combustible cambia de campo.** `fuelPerJump` pasa a `fuelPerMaxJump`, llega `fuelPerParsec`, y
  la línea *Combustible* del bloque de Finanzas pasa a ser un coste por tonelada más un depósito
  lleno — antes cobraba un depósito por periodo, una cantidad que ninguna regla enuncia.
* **La hoja de estilo se carga en la capa CSS `system`**, lo que por fin permite a los módulos
  sobrescribir el sistema limpiamente — y cambia la precedencia si tenías CSS propio.

### Creación de Viajeros

* **Creación en grupo**, en una cuadrícula de Viajeros × periodos. Cada jugador tira por su propio
  Viajero; el árbitro sigue a todos en una sola pantalla.
* **No se pierde nada si la sesión se interrumpe.** No hay documento de sesión: cada resultado
  decidido se escribe en el Actor en el momento en que se decide.
* **Las carreras son plantillas que escribe el árbitro**, con un formulario completo: rangos,
  asignaciones, tablas de habilidades, beneficios, eventos y percances, recompensas. El sistema no
  incluye ninguna tabla de carrera — incluye el registro que las hace funcionar.
* **Las especies son marcos de creación**, no bloques de parámetros: una especie declara sus propios
  periodos, tiradas, tablas y escalas. La secuencia del libro básico es el marco por defecto.
* **Una tirada de cualificación puede llevar un DM condicional** — *DM+2 si SOC 9+*, la forma que
  imprimen algunas carreras y algunas especies, y que hasta ahora había que recordar y aplicar a mano.
* **Licenciamiento**: beneficios, pensión, participaciones de nave y un cierre de grupo en el que solo
  un Viajero puede empezar siendo propietario de una nave.
* **Veintidós reglas opcionales de creación** (más abajo), dieciséis de ellas allí donde ningún libro
  lo decide: los libros callan, o dicen dos cosas en dos líneas.
* **Registro firmado de pérdidas permanentes de Atributos** — envejecimiento, heridas, atención
  médica — cuya suma se deriva. Funciona sin la creación y sirve igual en partida.
* **Formación**: un registro de programas, uno por aprendizaje en curso, cada uno indicando *qué libro
  lo rige*. Los Periodos de Estudio del básico y los Puntos de Experiencia del Companion son dos
  formas de mover el mismo registro. Un programa puede apuntar a un Atributo (SOC y PSI excluidos), y
  un profesor es un Actor cuyo nivel se lee en el momento de la tirada.

### Combate

* **Combate espacial** — un subtipo de Combate propio, con tres fases por asalto y una banda de
  alcance para **cada par de naves**. El grupo es la nave, y su tripulación actúa a la Iniciativa del
  casco.
* **Batallas entre flotas** (High Guard), tras un interruptor de regla opcional. Una Hoja de nave de
  flota sobre la astronave, un motor que resuelve sobre un Factor de Ataque **sin tirada para
  impactar**, escuadrones de cazas, salvas de misiles en vuelo, moral y dispersión. En una batalla de
  flotas el grupo es la flota y la nave pasa a ser un combatiente.
* **Misiles y torpedos** (Companion cap. 29), tras tres interruptores. Una salva tiene ahora un
  **tipo** — estándar, dogfight, interceptor o torpedo — y su clase decide las bandas de alcance desde
  las que puede lanzarse. La defensa se resuelve en tres capas: defensa de área, defensa puntual y el
  fuego cercano del básico. Un lanzador en contenedor consume un punto duro, así que un casco de menos
  de 100 toneladas no lleva ninguno.
* **Presa** — los ocho resultados del libro: derribado, desarmar, proyectar, daño, pistola u hoja
  corta, escapar, arrastrar, continuar.
* **Dos armas**, **Aprendiz de todo** y **la acción prolongada interrumpida** se aplican.
* **Un modificador de Iniciativa permanente por fin tiene dónde alojarse**, en todos los tipos de
  Actor. El puente holográfico del básico y de High Guard (*DM+2 a la Iniciativa*) es lo primero que
  lo usa.
* **Una diagonal se mide en euclidiano**, como pide el Companion p.173: diez casillas marcaban 15 m y
  ahora marcan 21 m.
* **El alcance se mide desde el objetivo** en la ventana de tirada, cuando hay un token marcado.

### Salud, daño y recuperación

* **La cadena de daño completa** — el orden de daño se edita en una lista reordenable: arrastrar para
  ordenar, quitar, añadir desde los Atributos disponibles.
* **La carta de daño se resuelve del lado del defensor**: el jugador objetivo la aplica, y la
  Armadura, la Protección y el daño que ignora la armadura se tienen en cuenta donde corresponde. **El
  daño que ignora la armadura estaba documentado y no se aplicaba** a Viajeros ni a PNJ.
* **Primeros auxilios, cirugía y atención médica** parten de la carta de chat y escriben sobre los
  Viajeros **controlados**. La cirugía aplica la cifra que escribes, que antes se mostraba y se
  descartaba.
* **Recuperación psiónica**, con su escala horaria.
* **Enfermedades, venenos y heridas son Objetos**, y un rasgo de arma que inflige uno **construye el
  Objeto sobre el defensor** — toda la mecánica existía y nada la invocaba.
* **Dosis de drogas y munición cargada**: una dosis es un Efecto Activo, la munición cargada es una
  derivación sobre el arma que la dispara.

### Astronaves, viajes y finanzas

* **La nave lleva su etapa de viaje** — aquí, próxima escala, distancia en pársecs, cola de espera — y
  su nivel real de combustible.
* **Salto y salto fallido**, con la rama del Companion, y un ajuste para el tiempo percibido en un
  salto con retraso.
* **La hoja impresa gana a la fórmula.** Seis campos opcionales — puntos de casco, energía consumida,
  tonelaje de armadura, tonelaje y coste del puente, combustible de salto — permiten transcribir una
  nave publicada tal y como está impresa, con un marcador que indica cuál se ha forzado.
* **Componentes de nave**, con verificación de diseño: seis comprobaciones sobre tonelaje, energía y
  presupuesto, tras un interruptor.
* **Computadores, software y Ancho de banda**: la suma contra el Procesamiento, el tope de Nivel
  Tecnológico, el descenso de categoría del software demasiado pesado y la excepción del software de
  Interfaz. En una nave, el tope lo pone el NT **del casco**, nunca el del computador.
* **Hipoteca de la nave**, con sus participaciones, su calendario, la opción de cobro cada cuatro
  semanas, y **Huida de las deudas**.
* **Un sello de mantenimiento**: la nave guarda el día de campaña de su último servicio, y la hoja
  dice de cuántos periodos de cuatro semanas va con retraso. No se tira nada y de ahí no se deriva
  ningún modificador — el básico p.154 dice que el mantenimiento *debería* hacerse, así que los DM por
  haberlo saltado siguen siendo del árbitro.
* **Transferencia de créditos** — la primera pantalla del sistema que mueve dinero a petición.
* **Puesto de tripulación** como tipo de Objeto: un puesto es una descripción de función, y dos
  artilleros pueden compartirlo.

### Comercio

* **El Mundo pasa a ser un Actor**: Perfil Universal de Mundo pegado de una pieza y analizado,
  dieciocho códigos comerciales derivados con anulación Auto/Sí/No para cada uno, calidad y precio del
  combustible, tasa de atraque, y el estado del comercio especulativo fechado con el *Día de campaña*.
* **Un mundo sabe dónde está**: sector por su nombre y hex dentro de ese sector — el par que imprimen
  los libros. El subsector y una coordenada absoluta se derivan de ahí, de modo que dos mundos de
  sectores distintos pasan a ser comparables. Verificado contra 1 165 mundos publicados sin una sola
  discrepancia.
* **Comercio especulativo**: las tres tablas del libro — los 18 códigos, la tabla 36×8 de Mercancías y
  las 29 filas de Precio Modificado. La pantalla acepta un **Mundo soltado** y deja de pedir lo que el
  documento ya sabe.
* **Tráfico de escala**: pasajeros, mercancías y correo pasan a ser Objetos en la nave, y un
  **Manifiesto** en la hoja de la nave permite entregar un envío y desembarcar un pasaje.
* **Lote de carga** y **Pasaje** como tipos de Objeto, con destino, plazo y tarifa — tres campos que
  existían desde el principio y que nada llegaba a escribir.
* **El circuito se cierra**: un precio negociado compra un lote y carga el gasto a la tripulación, y
  la bodega revende.

### Reputación y contratos

* **La Reputación (REP)** se suma a los Atributos que una mesa puede adoptar, desactivada por defecto.
  Se lee como cualquier otro — `REP 0` es DM−3 — y la tirada de Cambio de reputación toma **DM−1 por
  cada cuatro REP ya conseguidos**: un nombre ya hecho cuesta más de agrandar. Las once circunstancias
  impresas se solapan a propósito, y **solo se aplica la más alta**: nunca se suman.
* **Un contrato de recompensa** como tipo de Objeto, y es el documento **de los Viajeros** — la parte
  que el libro les entrega. Las filas del árbitro se pliegan por cortesía en la misma hoja: la
  Reputación mínima, la última localización, quién sabe qué, las complicaciones. El objetivo puede ser
  una persona, un lugar o un objeto, y el objetivo, el cliente, los asociados y el cazador son cada
  uno un Actor del mundo soltado, que decae a un nombre guardado para quien no puede verlo.
* **El grupo tira su propio contrato.** Las dos tiradas que el libro les da — negociar la recompensa y
  cualificarse para un contrato que su Reputación no alcanza — se hacen desde el asiento de los
  jugadores, sobre un documento que por lo demás no pueden editar.
* **Una pestaña de generación** saca uno de las tablas impresas: cliente, prioridad, objetivo,
  recompensa, complicación — ocho tiradas, cada una cayendo en el campo que nombra su paso.

### El mundo alrededor de los Viajeros

* **Cuatro comportamientos de región** — gravedad, temperatura, vacío, radiación. Enuncian el
  intervalo y su coste; **el sistema nunca programa el tiempo**. El asalto de combate es la única
  excepción, porque Foundry ya lo cuenta.
* **Reserva** — un inventario que nadie lleva encima: un montón de botín, el stock de una tienda, un
  escondrijo. Tiene sus propios permisos, y esa es toda la razón de que sea un Actor.
* **Los contenedores funcionan fuera de un Actor.** Una bolsa creada en la pestaña de Objetos retiene
  objetos del mundo, se llena arrastrando un objeto sobre su hoja y se vacía devolviéndolo a la barra
  lateral. Borrar una bolsa libera su contenido en vez de llevárselo.
* **Los contenedores se anidan**, hasta cinco niveles, y el peso sube por la cadena. Un contenedor
  nunca puede acabar dentro de sí mismo.
* **Carga** tras un interruptor, leída sobre la FUE y la RES actuales.

### Tiradas, cartas y peticiones

* **La ventana de tirada se ha rehecho**: la fórmula y el Efecto se leen en vivo mientras ajustas,
  incluidas Ventaja y Desventaja.
* **Cadena de tareas** — una carta de tirada puede citar la anterior y tomar de ella su modificador.
* **El Docket**: el árbitro compone una petición — habilidad, atributo, dificultad, Ventaja o
  Desventaja, plazo, un DM con nombre y su motivo — la resuelve contra una lista de Viajeros **antes
  de enviarla**, y la publica como una carta que cada jugador responde desde su sitio.
* **Las cartas de chat llevan sus dados**, así que Dice So Nice las anima.
* **Arrastrar una habilidad o un arma a la barra de macros crea la tirada correcta.** Antes creaba en
  silencio una macro que abría la hoja del objeto.

### Interfaz

* **La hoja de personaje se ha rehecho**: columna de Atributos con medidor de agotamiento, barra de
  pestañas devuelta al interior de la hoja, tablas aligeradas.
* **Modo de juego y modo de edición** en las hojas, al estilo de dnd5e: los controles de estructura
  desaparecen mientras juegas.
* **Una sola paleta, y es del lector.** Cuatro ajustes preestablecidos, once colores de acento y un eje
  *claro u oscuro* que sigue a Foundry por defecto o lo anula solo para este sistema. Todos los colores
  de una hoja derivan de ese único acento, y cada color de texto se midió a 4,5:1 o mejor sobre todos
  los fondos. Le acompañan dos interruptores: una barra de ventana oscura en ambos fondos, y un par de
  éxito y fallo apto para daltonismo. Cinco ajustes personales, y ninguno pide recargar. **Los tres
  temas de 0.1.x desaparecen** — un cliente que llevaba uno se migra y conserva su color.
* **Hojas, diálogos y cartas de chat siguen el tema claro u oscuro del jugador.**
* **Las hojas de objeto pasan a cinco pestañas** sobre los mismos bloques, con una cabecera encima:
  una hoja de arma pasa de 956 px a 489 px.
* **La hoja ya no se redibuja entera con cada pulsación**: solo se reconstruyen las secciones
  afectadas.
* **Una regla y su página ya no son texto en la hoja**: la hoja enuncia lo que hace, y la regla que
  hay detrás es una información emergente.
* **Explorador de compendios**, al estilo de dnd5e: compendios del mundo y de los módulos, filtrables
  por Nivel Tecnológico, subtipo y escala.
* **Botón de creación de los compendios del mundo** desde los ajustes: entrega la estructura y nunca
  el contenido.

### Reglas opcionales y variantes

**Cuarenta y nueve reglas en seis grupos**: *Viajeros* 4, *Creación* 22, *Combate* 5, *Salud* 4,
*Espacio* 11, *Naves y robots* 3. Un único menú en los ajustes del mundo, y **no todas empiezan
apagadas** — cada valor por defecto es la lectura que mejor sostienen los libros, así que una regla
opcional se entrega apagada y una regla que los libros imprimen *como* regla (carga, cargadores,
radiación) se entrega encendida.

Cuatro formas: un interruptor, una selección múltiple (un conjunto), una elección de procedimiento y
un recuento — porque un booleano no puede decir *qué procedimiento impreso está en vigor* cuando dos
capítulos no son la negación el uno del otro. Dieciséis filas no citan libro: catorce muestran *regla
de la casa* y dos *no oficial*. Una regla de la casa existe precisamente allí donde los libros callan,
o allí donde dicen dos cosas en dos líneas.

Cambiar un interruptor vuelve a preparar y redibujar las hojas abiertas; nada pide recargar.

### Documentación e idiomas

* **El sistema incluye su primer compendio**: `mgt2.docs`, un diario por idioma, veintitrés páginas
  cada uno. Cada página dice dos cosas sobre una pantalla — **de qué se encarga por ti** y **qué te
  deja a ti en la mesa**. Es documentación *sobre el sistema*, nunca texto de reglas.
* **Dos compendios de demostración, anotados**: un documento para **cada tipo y subtipo que el sistema
  declara** — 8 Actores y 27 Objetos, todos llamados `Demo — `. Cada uno lleva para qué sirve el
  documento, qué lee cada campo y la única trampa que existe para mostrar. Un ejemplo trabajado antes
  que un mundo de partida, y todas sus cifras son inventadas.
* **Cuatro idiomas declarados** — francés, inglés, español y portugués (Brasil), y **los cuatro están
  completos**. El francés es el objetivo del sistema; el vocabulario español y portugués sigue las
  traducciones comunitarias de Mongoose, y los títulos de los libros y los nombres de rasgos se quedan
  en inglés allí donde ninguna edición publicada los nombra.

### Correcciones

* `system.json` ya no genera avisos
  ([#3](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/3))
* Las fuentes Roboto, Roboto Condensed y Rubik Mono One las usaban las hojas y nunca se cargaban
* Los dados de las filas de inventario, habilidades, talentos psiónicos y enfermedades no tiraban
  nada: solo respondían la iniciativa y los Atributos
* Las notas financieras no se guardaban nunca (el campo tenía un nombre ausente del esquema)
* La etiqueta vertical de las hojas de objeto seguía en rojo en los temas Mwamba y Azul
* Soltar un objeto sobre la fila de un contenedor no guardaba nada: el gestor buscaba una clase CSS
  que ninguna plantilla emitía
* **Seis tipos de Objeto no podían soltarse en ninguna hoja del sistema**, cuatro de ellos de los que
  se compone un casco
* **Ninguna zona de soltado se resaltaba correctamente**: la caché de arrastre estaba siempre vacía
* **Soltar una persona en la fila del segundo artillero la inscribía en la del primero**
* Una nave portadora pagaba el mantenimiento de todas las naves transportadas menos una
* El software añadido con el botón `+` del bloque Computador era invisible para el resto del sistema
* Una habilidad cuyo nombre ya lleva su especialidad — *Animales (Doma)* — la enunciaba dos veces
* El combustible de salto se calculaba con el alcance máximo de la nave en vez de la tasa impresa
  (10 % del casco por pársec)
* **El botón de primeros auxilios desaparecía en un mundo francés**, al existir la lista de
  habilidades sanadoras solo en inglés
* Tres ajustes no aplicaban nada hasta recargar
* Una clave de duración llevaba un nombre francés en el diccionario inglés, y ese error quedaba
  **guardado en cada talento psiónico** medido en horas; la migración reescribe el valor
* Once citas de página estaban una página por encima, tres de ellas visibles para los jugadores
* Los códigos comerciales mostraban su condición en inglés fijo, el único texto del sistema que
  escapaba a la traducción

---

## [0.1.4] (2024-05-25)

### Correcciones
* Error al calcular el peso en varios eventos (soltar, borrar)

## [0.1.3] (2024-05-24)

### Correcciones
* Localización
* Añadir el valor de la dificultad en la etiqueta

### Novedades
* Compatibilidad con v12

## [0.1.2] (2024-05-16)

### Correcciones
* Visualización de la dificultad en los Talentos Psiónicos
* Barra de desplazamiento añadida a la hoja de personaje
* Arrastrar y soltar en las hojas de Carrera, Enfermedad, Contacto y Especie
* Estilo retirado de los mensajes, a la espera de uniformarlos
* Varios ajustes de CSS

### Novedades
* Tema Azul
* Modelo de Especie mejorado: Descripción detallada, Modificadores (tabla) y Rasgos (tabla)
* Al soltar una Especie, se copia su información en la hoja
* Duración añadida a los Talentos Psiónicos
* Botón en los mensajes para tirar la Duración de un Talento Psiónico
* Dificultad añadida en la ventana de tiradas
