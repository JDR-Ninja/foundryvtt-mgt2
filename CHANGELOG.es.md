# Changelog — MGT2

[Français](CHANGELOG.fr.md) · [English](CHANGELOG.en.md) · [Português (Brasil)](CHANGELOG.pt-BR.md)

> La interfaz está completa en español. El vocabulario Traveller sigue las traducciones comunitarias
> de Mongoose allí donde nombran un término; los títulos de los libros y los nombres de rasgos se
> quedan en inglés, a falta de una edición española que los nombre.

---

## [0.2.13]

**Verificado en Foundry VTT 14.370.**

### ⚠ Cambios que rompen

* **La cantidad de una munición cuenta cargadores de repuesto**: *Recargar* gasta uno. Una cantidad
  escrita en balas se lee ahora en cargadores.

### Novedades

* **Creación**: la relación *Conexión*, anotada en la hoja de cada Viajero vinculado.
* **Finanzas**: *Cobrar los objetos soltados sobre un Viajero*, un ajuste desactivado por defecto.
* **Regla de la casa**: *Impactos para los Viajeros*, desactivada por defecto.
* **Especies**: los rasgos que modifican una tirada aparecen en el diálogo de tirada; el Metabolismo
  rápido o lento cuenta para la Iniciativa.
* **Armas**: accesorios montados (mira, mira láser, bípode…); la mira láser da MD+1 a menos de
  50 m (CSC p.176).
* **Armas**: un arma secundaria montada en otra (lanzagranadas, Intruder…).
* **Armas psiónicas**: el MD de PSI al daño y el gasto de puntos; High Yield, Very High Yield e
  Intense Focus en las armas de nave.
* **Vehículos**: un artillero por montura, y las troneras.
* **Naves**: parchear o reparar una localización dañada, con piezas de repuesto.

### Correcciones

* Borrar un contenedor de un personaje ya no se repite en cada cliente conectado.

## [0.2.12]

**Verificado en Foundry VTT 14.370.**

**Una renovación visual de todo el sistema, cartas del chat que aplican el daño, y los roles de una
nave gestionables por fin desde su hoja**
([#9](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/9)). Las cartas de tirada, las hojas de
cada actor y de cada objeto y el diálogo de tirada se han redibujado. La creación hace la tirada de
habilidad del periodo en el orden del libro, los aumentos siguen los límites del Central Supply
Catalogue, y dos reglas del Traveller Companion pasan a ser opciones.

### ⚠ Cambios que rompen

* **La tirada de habilidad del periodo va antes de la Supervivencia** (Core p.18), en lugar del
  entrenamiento básico, y ya no después del Ascenso. Una tirada ganada más tarde en el periodo, por
  un ascenso o una fila de evento, devuelve el cursor al paso de habilidad hasta que se haga. Una
  creación en curso continúa en el nuevo orden.
* **Un ataque fallido ya no ofrece tirada de daño** (Core p.74, p.77), venga de un personaje o de
  una montura de nave. Un arma **Blast** la conserva, sin Efecto añadido, para la granada que queda
  a criterio del árbitro y para la dispersión: una interpretación. Con la regla *Percances de
  combate*, un doble 1 que llega a 8+ sigue fallando y tampoco ofrece nada (Companion p.53).
* **Los aumentos siguen los límites del Central Supply Catalogue**, que sustituyen al del Core: un
  aumento por habilidad y tres habilidades como máximo (CSC p.61), un solo aumento por
  característica física (p.53), y una Subdermal Armour no se acumula con otra (p.54). El aumento
  superado sigue instalado, no da nada, y el inventario lo nombra. Un aumento que sube varias
  características, como el Muscular Bridging, se suma aparte: una interpretación. **Un Viajero que
  acumulaba dos aumentos de la misma habilidad pierde el MD del más débil.**
* **Un contenedor bloqueado oculta todo lo que contiene, a cualquier profundidad.** Una bolsa
  guardada en un baúl bloqueado ya no es visible para un jugador, ni bajo *(todos)*, ni en el
  selector, ni en su propia hoja, y no se puede guardar nada en ella, ni arrastrando ni desde el
  menú de almacenamiento de la hoja de un objeto. El árbitro lo ve y lo hace todo, como antes.

### Cartas del chat

* **Una carta de tirada se lee de un vistazo**: la dificultad en palabras sobre su umbral, cada dado
  como ficha, el dado que descarta una Ventaja o una Desventaja tachado, el Efecto en su escala de
  seis tramos (Core p.61), y cada MD por su nombre. La Ventaja y la Desventaja son una insignia ▲ o
  ▼. Una carta publicada ya no muestra probabilidad de éxito: la tirada está hecha. El detalle de
  los dados se abre bajo el resultado sin desplazar el chat.
* **El chat sigue el ajuste *Claro u oscuro*.** En *Claro* u *Oscuro* las cartas siguen la paleta de
  las hojas; por defecto el chat se queda claro, como el de Foundry.
* **Las cartas antiguas se pliegan**, según el nuevo ajuste de cliente *Plegar las cartas
  antiguas*: *Nunca*, *Pasados cinco minutos* (por defecto) o *Siempre*. Una carta plegada conserva
  su cabecera y su Efecto, o el total de daño; un clic en la cabecera la abre.
* **Un ataque anota sus objetivos.** Los tokens marcados como objetivo al tirar entran en una
  bandeja *Objetivos*, con su distancia, y pasan a la carta de daño. El cargador se lee en un
  indicador, y el botón de daño nombra la tirada, *Daño 4D +6*.
* **Una carta de daño aplica el daño.** Su bandeja *Aplicación* lista los objetivos del ataque, o
  los tokens seleccionados, y sigue el lienzo en directo. Cada fila da la lectura elegida (◆ cuando
  la elige un rasgo del defensor), la Protección encontrada, la PA descontada, y lo que hará el
  daño: una herida, un aturdimiento, el apagado iónico de un robot, la descarga iónica de una nave,
  la electrónica perturbada de un vehículo, o nada contra una inmunidad. Un vehículo elige su cara
  en su propia fila. Un botón por fila, y *Aplicar a los 3*; los tokens no vinculados de un mismo
  actor se agrupan en *3× Nombre*. El árbitro ve todas las cifras, un jugador solo las de sus
  propios tokens. Una fila aplicada queda marcada *Aplicado* para todos. No se puede deshacer.
* **Las tres lecturas de daño ya no bajan de cero**, cuando un MD de FUE negativo las llevaba ahí.
* **La petición de tirada** muestra un retrato por línea, *Tú* en la tuya, una barra de progreso y
  el motivo de la petición. **La carta de un lote comercial** muestra sus toneladas y sus precios,
  reproduce la tirada de precio, y un indicador de la bodega marca un exceso.
* **Cualquier carta del sistema puede abrirse en su propia ventana**, desde el menú contextual del
  mensaje. Los mensajes publicados antes de esta versión no lo ofrecen.

### Hojas

* **Las hojas del Viajero y del PNJ** muestran los estados como píldoras, las armas como cartas de
  ataque, los niveles de habilidad como puntos, y pliegan los bloques vacíos.
* **Cada rasgo lleva una línea que dice lo que hace**, *AP 3: ignora 3 de la Protección del
  objetivo*, en las hojas de objeto y en las del Viajero, del PNJ, del robot y del vehículo, en modo
  de juego. El texto es del sistema, no de los libros.
* **El robot** cabe en dos pestañas; el riel muestra sus tres presupuestos (ranuras, opciones sin
  ranura, Ancho de banda), y sus umbrales de daño aparecen bajo la cabecera como los de una
  criatura. El bloque Opciones solo aparece en modo edición.
* **La nave** mantiene una cabecera de ocho cifras, el casco como barra de reserva, una línea por
  presupuesto y sus monturas como cartas de ataque. **El vehículo** hace lo mismo, cada cifra de su
  cabecera se edita en su propia casilla, y sus localizaciones intactas se pliegan.
* **El mundo** agranda y glosa su perfil, muestra los servicios de su astropuerto como placas y sus
  códigos comerciales como fichas. **El alijo** muestra su cerradura como píldora y sus accesos como
  una escala, cada nivel con lo que da.
* **Cada hoja de objeto** abre con su línea impresa y sus cifras clave, cuenta sus pestañas y lee sus
  indicadores. Una carrera pone sus tablas y sus eventos en pestañas propias, su cualificación como
  una carta. Un aumento muestra lo que aplica. Un programa muestra su efecto, su Ancho de banda y el
  ordenador que lo aloja. Una droga muestra su ciclo, y solo una persona puede tomar una dosis. Una
  munición muestra sus placas y las armas en las que está cargada. Un rol de tripulación agrupa sus
  acciones por paso del asalto (Core p.164).
* **El diálogo de tirada** muestra la probabilidad de éxito como un anillo y una barra, y los
  modificadores de situación como píldoras.
* **Un editor de texto cerrado muestra el texto con formato.**

### Creación

* **Elegir una tabla de habilidades es una cuadrícula**, una columna por tabla como en el libro. Una
  tabla cerrada por su característica o por la comisión sigue visible, en gris con su motivo, y una
  casilla muestra el nivel ya poseído.
* **Una elección de habilidad a un nivel impreso oculta lo que no puede subir** (Core p.18): el
  entrenamiento básico de una segunda carrera ya no ofrece una habilidad ya poseída a 0, y una
  habilidad a nivel 0 ya no crea *Engineer 0* junto a *Engineer (j-drive) 1*.
* **Un paso sin nada que hacer aparece en gris con su motivo**, y el cursor lo salta: la comisión de
  una carrera que no la imprime, el envejecimiento que aún no toca.
* **Una tirada en una tabla muestra la fila obtenida**, en su carta y sobre la elección que pide. En
  un cliente francés la fila se lee en francés cuando el compendio de la carrera la traduce, y una
  tabla nombrada en inglés se encuentra bajo su nombre traducido.
* **El árbitro puede reabrir una cualificación rechazada** con la flecha del paso, tanto para un
  centro de estudios como para una carrera.
* **Todo lo que aplica una tirada de Beneficios entra en la columna *Tomado*** de la pantalla de
  cierre, no solo el dinero y los beneficios: un Aliado, una característica, una habilidad.
* **La celda de un periodo ya no dice dos veces lo mismo**, y la banda de pasos y la pantalla de
  cierre se han redibujado.

### Equipo y robots

* **Una munición puede cambiar el alcance y el coste del cargador de su arma** (CSC p.179): un
  alcance propio, un porcentaje o un múltiplo del coste del cargador, redondeados hacia abajo
  (Core p.6). La granada de 40 mm del Advanced Combat Rifle llega a 250 m (Core p.126). Las hojas,
  el diálogo de tirada y las bandas de alcance leen el arma cargada. Un arma cuerpo a cuerpo y un
  arma de nave conservan su alcance.
* **La lista de armas muestra el daño y los rasgos de la munición cargada**, y la de un vehículo el
  Scope que le da su control de tiro (Vehicle Handbook 2026 p.104).
* **La Agility Enhancement de un robot suma sus metros a su velocidad** (Robot Handbook p.22), sin
  coste de autonomía.
* **Un contenedor bloqueado muestra a un jugador el texto del árbitro** en lugar de su contenido, y
  su masa sigue contando.

### Naves

* **Los roles de puesto de una nave se gestionan desde su hoja**
  ([#9](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/9)). En modo edición, el bloque
  Tripulación gana un pliegue *Roles de puesto*: cada rol a bordo, su puesto de tripulación, su
  departamento y cuántos puestos lo usan, con *Nuevo rol*, abrir y eliminar. Eliminar un rol vacía
  los puestos que lo usaban, y lo dice.
* **Dos roles con el mismo nombre se numeran**, *Piloto (1)*, *Piloto (2)*, en el menú del puesto
  como en el pliegue.
* **Un rol soltado recuerda su origen**, y *Actualizar desde su origen* lo refresca sin separarlo de
  sus puestos.
* **Un rol soltado sobre una fila de tripulación se asigna a ese puesto**, reutilizando la copia del
  mismo origen que ya está a bordo.

### Reglas del Traveller Companion

Donde el Companion reimprime una regla del Core de otra forma, prevalece, y cada una de esas reglas
pasa a ser una opción, activa en un mundo nuevo y desactivada en un mundo actualizado, que conserva
así la regla del Core hasta que el árbitro la active.

* ***MD de característica por encima de 15*** (Companion p.4): +4 de 18 a 20, +5 de 21 a 23, y +1
  más por cada 3 adicionales. El Core se detiene en +3.
* ***Combustible refinado en un astropuerto de clase C*** (Companion p.133): la hoja del mundo
  muestra *Refinado y sin refinar* y los dos precios, y la pantalla de viaje gana una elección
  *Combustible cargado*, refinado a Cr500 o sin refinar a Cr100, que decide el MD−2 del salto.

### Correcciones

* **La píldora de REP de un contrato ya no delata el umbral de reputación oculto del cliente.**
* **Una persona soltada sobre una fila de montura, pantalla o bahía** ya no se une al puesto de
  tripulación del mismo índice.
* **Las barras de presupuesto de las hojas con riel vuelven a llenarse.**
* **El rasgo Slow Loader cuenta acciones, no asaltos** (Field Catalogue p.8); un arma existente se
  corrige al cargar.
* **El estilo de las condiciones de un contrato** ya no se filtra al diálogo de tirada.
* **Una palabra en una línea de estadísticas** se lee a tamaño de palabra, ya no al de una cifra.

---

## [0.2.11]

**Verificado en Foundry VTT 14.370.**

**Una armadura motorizada que hace a su portador más fuerte sin hacerlo más resistente, y Efectos
Activos que llegan más lejos** ([#8](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/8)). La
battle dress aumenta la FUE y la DES para las tiradas, el daño cuerpo a cuerpo, la Iniciativa y la
carga, mientras el daño se sigue aplicando sobre las características propias del portador (Core
p.102).

### Armadura motorizada

* **Una armadura puede aumentar la FUE y la DES** (Core p.102, CSC p.35–39). En modo edición, su
  hoja recibe una bonificación y un mínimo para cada una. Mientras la armadura está equipada, el
  valor aumentado es el que sirve para las tiradas, el daño cuerpo a cuerpo, la Iniciativa y la
  carga; el daño y la curación siguen usando el del portador. La característica conserva el valor y
  el indicador del portador, y muestra al lado el valor aumentado, con una ayuda emergente que nombra
  la armadura. Las bonificaciones de varias armaduras equipadas se suman.
* **Un mínimo solo puede subir un valor**: el FUE+1 *hasta un mínimo de seis* del exoesqueleto
  (CSC p.36) lleva una FUE de 4 a 6, y una FUE de 8 a 9.
* **Un multiplicador de carga**, *Carga ×*: el exoesqueleto triplica los límites de carga y su
  versión mejorada los cuadruplica (CSC p.36), la battle dress Logistics los multiplica por 6 (CSC
  p.40). El límite se calcula sobre la FUE aumentada, y dos armazones equipados a la vez no se
  multiplican entre sí: se aplica el mayor.
* **Una armadura motorizada se puede apagar.** En las hojas del Viajero, del PNJ y del robot, un
  rayo junto al escudo de una armadura equipada marcada *Motorizada* la deja *Inactiva* (CSC p.35):
  pesa la cuarta parte de su masa, como una armadura equipada, pierde toda bonificación, mínimo y
  multiplicador, y dobla cada penalización. En marcha, no pesa nada, como antes. Perder la
  bonificación de DES además de la de FUE, y la cuarta parte de la masa, son dos interpretaciones:
  el libro solo nombra la bonificación de FUE, y solo dice que la masa estorba al portador.
* **Una armadura puede sumar la mitad de la PSI del portador a su Protección**, redondeada hacia
  abajo o hacia arriba según la armadura (CSC p.33, p.40). Lee los puntos de PSI que quedan, así que
  la protección mengua con cada poder usado: una interpretación.
* **Si seguiste el apaño propuesto en #8**, un cambio Final sobre
  `system.characteristics.strength.dm` o `dexterity.dm` que hacía las veces de la bonificación de la
  armadura, bórralo en cuanto la armadura lleve su propia bonificación, o las dos se sumarán.

### Efectos Activos

* **Un MD de habilidad llega a un Viajero que no tiene la habilidad.** Un efecto sobre
  `system.modifiers.skills.<habilidad>.effect`, como el MD−2 del Reflec a Sigilo, `stealth` (CSC
  p.18), se descartaba cuando el Viajero no tenía la habilidad. Una petición de tirada que nombra
  esa habilidad lo aplica ahora a la tirada sin la habilidad. Cualquier otra tirada lo muestra sin
  marcar, para que quien tira lo marque, porque la ventana de tirada no puede saber a qué habilidad
  corresponde una tirada sin la habilidad.
* **Un MD de habilidad llega también a sus especialidades**: un efecto sobre `gun-combat` se aplica a
  todas las especialidades de Gun Combat, y uno sobre `gun-combat-energy` solo a esa especialidad.

### Correcciones

* **Los controles de efecto funcionan en una hoja abierta desde un compendio.** Editar, borrar,
  activar, suspender y terminar una dosis no hacían nada en un objeto de un compendio; crear un
  efecto ya funcionaba.
* **Un MD sobre una habilidad de dos palabras se marca en *otra especialidad*.** Un aumento o un
  efecto de Gun Combat se quedaba sin marcar cuando quien tira elegía *Gun Combat, otra
  especialidad*.

---

## [0.2.10]

**Verificado en Foundry VTT 14.370.**

**Una armadura que protege más contra un tipo de daño, y un equipo que solo actúa equipado**
([#8](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/8)). La segunda Protección que imprime el
Central Supply Catalogue, `+1 (+6 vs. lasers)`, se aplica ahora al daño, y la de los robots también.

### ⚠ Cambios que rompen

* **Un objeto no equipado ya no aplica sus Efectos Activos.** Una armadura, un arma o un equipo solo
  transmite sus efectos al Viajero si está equipado, y un aumento solo si está instalado: un
  acolchado guardado en la mochila ya no cuesta MD de DES. Un objeto arrastrado a una hoja llega sin
  equipar, como antes, y sus efectos esperan a que se equipe. Los efectos de un talento, una
  especie, una carrera o una enfermedad no cambian, y un objeto del mundo que no pertenece a ningún
  Actor sigue mostrando sus Efectos Activos en su propia hoja.
* **El segundo valor de un rasgo Armour se suma contra su tipo de daño** (Robot Handbook p.32).
  `Armour (+7, +10 vs. lasers)` protege 17 contra un láser y 7 contra el resto, como el Reflec de un
  robot, que se suma a su armadura. El rasgo solo se mostraba: los robots impresos que lo llevan
  reciben ahora 10 puntos menos de un láser. En un PNJ criatura, el panel dice si el segundo valor
  se aplica; una condición que no nombra ningún tipo, como `vs. psionics`, no se aplica.

### Armadura y daño

* **Una armadura puede tener una Protección condicional** (CSC p.18). En modo de edición, su hoja
  gana un segundo valor y los tipos de daño que cubre. Contra un ataque de uno de esos tipos, ese
  valor **sustituye** a la Protección de la armadura: el Ablat, `+1 (+6 vs. lasers)`, detiene 6
  contra un láser y 1 contra el resto, y un Reflec llevado sobre otra armadura suma sus 10 solo
  contra los láseres. Un valor de 0 cuenta: el escudo de energía personal, `+12 (+0 vs. lasers)`,
  deja pasar los láseres (CSC p.13). Sustituir en lugar de sumar es una interpretación. El arma
  tiene que llevar su tipo de daño. El desgaste del Ablat, −1 por disparo láser, corresponde al
  árbitro.
* **Dos tipos de daño más, Plasma y Energía**, para las armas y las armaduras (CSC p.18). No hay
  tipo psiónico: la protección de la Neural Sheath contra lo psiónico no se aplica.
* **La hoja muestra la Protección condicional** bajo la Protección de la línea de armadura, «6
  contra Láser», y en una ayuda emergente sobre la Armadura de la cabecera del Viajero, del PNJ y
  del robot, que da la Protección contra cada tipo.

### Correcciones

* **Guardar un objeto con el botón de la hoja lo desequipa.** Seguía equipado en la mochila, con su
  Protección y sus efectos todavía contados. La lista de almacenaje de la hoja de objeto y soltarlo
  en un contenedor ya lo desequipaban.
* **La pestaña Efectos se actualiza al equipar o desequipar un objeto**, sin esperar a que se
  redibuje toda la hoja.

---

## [0.2.9]

**Verificado en Foundry VTT 14.369.**

**Una guía del sistema, una demostración que llega hasta el final de la creación, y las naves, las
flotas, los vehículos y los robots puestos de acuerdo con sus libros.** Treinta páginas describen el
sistema, y un `?` en la barra de título las abre por la página de la ventana. Los compendios de
demostración ganan cinco carreras, cuatro tablas compartidas, cinco Viajeros y una Escena. Jugar
esos Viajeros sacó a la luz defectos de creación, y escribir la guía los de las naves, las flotas,
las regiones y las hojas: lo que cambia una partida en curso va primero.

### ⚠ Cambios que rompen

* **Una crisis de envejecimiento también hace fallar un cambio de destino y rechaza una *Carrera
  ofrecida*** (Core p.20, p.49). En una carrera configurada como *Volver a cualificar, conservando
  el rango*, el cambio falla sin tirada y sin elección de destino, aunque *Automática si* dispense
  al Viajero de la tirada. Sigue en su destino, sin penalización, y el registro del periodo dice por
  qué. *Libre, cada periodo* no pide tirada y sigue permitido. Una *Carrera ofrecida* ya no dispensa
  de la tirada: la cualificación falla, la oferta sigue pendiente y no se gasta, y una entrada
  forzada sigue pasando. Dos interpretaciones.
* **PSI reducida a 0 por el envejecimiento ya no es una crisis, y todas las capacidades psiónicas se
  pierden para siempre** (Aliens of Charted Space 1 p.275). El Viajero ya no arriesga la muerte ni
  debe atención médica, y la atención de otra crisis no le sube la PSI. La prueba de PSI, el
  entrenamiento, el aprendizaje, los poderes y los talentos aprendidos como habilidades se rechazan;
  los talentos siguen en la hoja, sin efecto. Una concesión que subiría la PSI se rechaza, y el
  envejecimiento ya no propone una PSI que esté en 0. **El libro lo imprime para los Viajeros
  zhodani, y el sistema lo aplica a todos los Viajeros**, porque no sabe quién es Zhodani: una
  interpretación. **Una carrera cuya Cualificación solo lee PSI, como el Psion (Core p.236), queda
  cerrada**: otra interpretación, porque el libro solo habla de las capacidades. Todo esto se lee en
  las pérdidas registradas, de modo que un Viajero ya creado cuya PSI envejeció hasta 0 pasa a esta
  regla desde esta versión, aunque hubiera pagado la atención. Una pérdida escrita antes de la
  prueba de PSI no bloquea nada, y la prueba la borra.
* **Una entrada automática ya no escapa a la regla de no retorno** (Core p.18). Una carrera
  *Automática*, o cuyo umbral *Automática si* cumple el Viajero, no se retoma en el periodo
  siguiente a haberla dejado. El reclutamiento, una carrera impuesta u ofrecida, una carrera siempre
  abierta y un cambio de destino siguen escapando a ella.
* **Una especialidad escrita solo en el nombre de un objeto cuenta como la del campo** (Core p.58),
  para la concesión y para el tope de habilidades. Una concesión sin especialidad, *Electronics* 1,
  crea ahora su propia fila junto a *Electronics (Comms)*, en lugar de subirla. Una interpretación.
  **Un Viajero ya duplicado no se corrige.**
* **El vacío y la temperatura ya solo hieren a Viajeros y PNJ** (Core p.82), **y el vacío a un robot
  biológico.** Una región *Vacío* o *Temperatura* hería también al vehículo, la astronave o el robot
  que estaba en ella. Un robot sigue ahora su propia regla (Robot Handbook p.34, véase *Regiones y
  peligros*). Una región *Radiación* sigue alcanzando a los robots.
* **Un Motor de salto inutilizado o destruido rechaza el salto** (Core p.154), tanto en el viaje
  como en un puesto, y la pantalla de viaje desactiva el botón. **En un puesto rechaza también toda
  tirada de Ingeniería (motor-S), acción de reparación escrita con esa especialidad incluida**: una
  interpretación. Una acción de reparación escrita *Engineer* sin especialidad sigue pasando. En un
  puesto, esa especialidad solo se lee por su nombre inglés o francés, como `Engineer (j-drive)`.
* **La dispersión de una flota produce ahora sus efectos** (High Guard p.122). Mientras corren sus
  asaltos, suspende las reparaciones, el inicio de romper el combate, la división, el destacamento y
  la unión, pero ni el fuego ni la Moral, y su MD llega al *MD ofensivo*. Tras un fallo, un nuevo
  resultado espera a que hayan pasado los dos asaltos, y la división y el destacamento siguen
  cerrados hasta una dispersión lograda. Dejar abierta la Moral, retener toda la flota y cerrar la
  división tras un fallo son tres interpretaciones.
* **Los MD permanentes de quien tira (estados, armadura, aumentos, Efectos Activos) llegan también a
  las tiradas de puesto, vehículo, comercio y reanimación.** Un ingeniero fatigado tira más bajo que
  antes, sin que su hoja haya cambiado.

### Creación

* **Una carrera desbloqueada sigue desbloqueada tras una tirada fallida** (Core p.17, p.46). La
  entrada *Carrera desbloqueada* se gasta al entrar en la carrera, ya no antes de la tirada de
  cualificación, y desaparece según su propia duración. Un fallo ya no hace perder el permiso del
  árbitro.
* **Una carrera impuesta que no se encuentra ya no bloquea al Viajero.** Una *Carrera impuesta* que
  ni el mundo ni un compendio contienen, o que no nombra ninguna donde no existe carrera de entrada
  forzada, se retira, con un aviso y un mensaje al jugador y al árbitro. Hasta ahora todas las
  carreras rechazaban al Viajero, sin ofrecer el reclutamiento ni una carrera siempre abierta.
* **Una cadena de subtablas sigue hasta diez tablas**, se detiene en una tabla ya tirada, y lo dice
  en un aviso y en el registro del periodo. Antes se detenía en silencio tras dos saltos.
* **Una *Carrera ofrecida* ya no abre una carrera *Solo se entra cuando te envían*** (Core p.52). El
  jugador es rechazado; una condena, un reclutamiento o el árbitro siguen abriéndola.
* **Una degradación se detiene en el rango más bajo que imprime el escalafón, y nunca sube un
  rango.** Un oficial de rango 1 caía a un rango 0 que su escalafón no tiene. Ningún libro prevé el
  caso: una interpretación.
* **La fila de envejecimiento anota la edad del final del periodo** (Core p.48): el cuarto periodo
  envejece a los 34, ya no a los 30. Las filas de lesión, atención y suceso conservan la edad del
  inicio del periodo.
* **La creación escribe la edad del Viajero**: *Terminar* rellena el campo *Edad* si está vacío. Una
  edad escrita a mano se queda, y una edad escrita por la creación se mantiene al día.
* ***Automática si* también dispensa de la tirada de cambio de destino** en *Volver a cualificar,
  conservando el rango*, porque esa tirada repite la misma línea de Cualificación. Una
  interpretación.
* **Un cambio de destino superado, o libre, escribe su línea en el registro del periodo**, con los
  dos destinos.

### Regiones y peligros

* **La exposición al vacío se cuenta por combate** (Core p.82). Una ficha que seguía en una región
  *Vacío* conservaba el asalto de un combate pasado, y el daño acumulativo del combate siguiente se
  quedaba bloqueado en 1D. La exposición vuelve a 1 en cada combate y sube asalto a asalto.
* **La regla *Radiación* desactivada corta de verdad la radiación.** Una región ya no la tira, y
  ninguna carta anuncia que una armadura de 0 ha detenido la dosis. Un robot ignoraba la regla y
  ahora la sigue.
* **Dos peligros en el mismo instante ya no se borran.** El segundo escribía sobre el total leído
  antes del primero, y una herida se perdía: ahora se aplican uno tras otro.
* **Borrar una ficha expuesta al vacío** ya no produce un error en la consola.
* **Un robot en el vacío sigue el Robot Handbook p.34.** Una región *Vacío* reduce su autonomía a la
  mitad y anuncia una tirada de avería cada hora, cada dos horas con protección contra entornos
  hostiles, y ninguna con protección contra el vacío: la tira el árbitro, el sistema no la programa.
  La hoja gana *Robot biológico*, para un robot que sufre como el ser vivo en que se basa, y
  *Sellado al vacío*, que prevalece sobre las líneas de opciones: en blanco, solo se leen los
  nombres ingleses impresos. Ajustar ese campo a *Vacío* devuelve al instante la autonomía a un
  robot que ya está en la región, y salir de la región o borrar su Escena también se la devuelve. Un
  robot que ya esté en la región al actualizar solo se reduce en su próxima entrada. Mantener la
  mitad de autonomía bajo protección hostil es una interpretación (p.32 y p.34).
* **Un PNJ recibe ahora su dosis de radiación** (Core p.79, p.81), y su hoja gana sus Rads y el
  estado de náusea. Una criatura la recibe en sus Impactos, sin END (Core p.84).

### Naves, flotas y viaje

* **Un disparo de iones desde un puesto ya no daña el casco a través de la armadura** (High Guard
  p.30). Los rasgos del arma siguen ahora al disparo hasta el daño, salva de misiles incluida.
* **Un crítico de Motor de maniobra pesa sobre las tiradas de pilotaje** (Core p.154, p.170), salvo
  la Iniciativa. **Un crítico de Motor de salto pesa sobre toda tirada de Ingeniería (motor-S)**
  (Core p.170, p.171), tanto en el viaje como en un puesto, y la pantalla de viaje lo muestra. En un
  puesto, estas habilidades solo se leen por su nombre inglés o francés.
* **La cabecera de una nave cuenta personas, no líneas de tripulación**: una nave completa ya no
  aparece corta.
* **Las pantallas de defensa de una nave** (*Amortiguador nuclear*, *Pantalla de mesones*, *Esfera
  negra*) **se ajustan en la hoja**, en el bloque *Monturas y armas*, en modo de edición.
* **La herramienta *Fijar la banda de alcance a partir de dos fichas* también coloca una nave
  entrada arrastrándola.**
* **La pantalla de flotas gana *Dividir en una flota nueva* y *Unir a otra flota*** (High Guard
  p.122), y un primer casco puede soltarse en una flota nueva. La división no pide cadena de tareas,
  apartándose del libro, que exige una.
* **Unir una flota pide confirmación**, porque el sistema no sabe quién es aliado. **La Moral
  pregunta qué flota se opone** cuando quedan varias, por ejemplo tras una división. Sin adversario,
  el *Terreno celeste* vale 0.
* **Un lote de carga o correo sin plazo** ya no escribe «día de campaña null», y sigue diciendo que
  el pago se hace a la entrega.
* **La ayuda emergente de la Zona Roja** dice ahora lo que el sistema aplica: el tráfico se sigue
  tirando allí, con MD-4 para los pasajeros y MD-6 para las mercancías, y hacer cumplir la
  prohibición corresponde al árbitro (Core p.239-240, p.260).

### Hojas y tiradas

* **Una criatura tiene un campo para sus Impactos.**
* **Una armadura en un PNJ o un robot se ve y se lleva**: ambas hojas ganan su línea.
* **Un MD personalizado escrito aparece en los términos de la tarjeta**, con su operador si lo
  tiene.
* **Un Efecto Activo escrito en `system.modifiers.skills.<slug>.effect` llega por fin a la tirada de
  esa habilidad.**
* **Vehículos** (Vehicle Handbook 2026). *Borrar todos los críticos* cubre todas las ubicaciones y
  deja la Estructura, que tiene su propia reparación (p.11). Un crítico de casco de Severidad 5 o 6
  divide la Estructura, redondeada hacia arriba (p.10), y el contador *Estructura a la mitad* se
  corrige a mano. El control de tiro de una montura llega a la tirada y da al arma el rasgo *Scope*
  (p.101, p.104); prevalece sobre el del arma. Un vehículo introducido a mano gana sus campos
  *Estructura* y *Confort*.
* **El software y el cerebro de un robot** se abren y se borran desde su hoja.
* **Una reserva dice que arrastrar copia**: sus textos decían «tomado». Una reserva cerrada ya no
  dice a un jugador que sus líneas «nunca se envían». El contenedor creado desde el inventario se
  llama *Nuevo contenedor* en el idioma de la interfaz.

### Guía

* **Llega el compendio *MGT2 — Guía del sistema*** (`mgt2.guide`)**, en treinta páginas**: lo que el
  sistema es y no es, la preparación de un mundo, un primer Viajero, una primera tirada, un primer
  combate y una primera nave, y después cada hoja y cada pantalla, las reglas opcionales, los
  ajustes, las macros y la API, y lo que el sistema no hace a propósito.
* **La guía solo existe en inglés**, y es el inglés lo que se muestra en los cuatro idiomas. Un
  lector hispanohablante también lee el inglés; solo está prevista la traducción francesa.
* **Un `?` en la barra de título abre la guía por la página de la ventana**: en las hojas de
  Viajero, PNJ, vehículo, astronave, robot, mundo, reserva y objeto, y en la creación, el combate
  espacial, el viaje, el Docket y la ventana de tirada. Las batallas entre flotas, el comercio y el
  explorador de compendios no lo llevan: sus páginas se leen en el compendio. El ajuste *Mostrar el
  botón de la guía*, propio de cada navegador, lo quita.

### Demostración

* **Cinco Viajeros salidos del bucle de creación** en *MGT2 — Actores de demostración, anotados*,
  cada uno a partir de un Actor en blanco, con sus notas: *Demo — Tamsin Reeve* (la escuela de
  cadetes con honores, luego la patrulla), *Demo — Corvin Dray* (un rechazo, el reclutamiento, un
  Percance y la factura del cirujano), *Demo — Mirel Aston* (una creación interrumpida: una vez
  importada, espera en la pantalla de creación, en su tercer periodo), *Demo — Hesper Lund* (una
  crisis de envejecimiento pagada, una pensión y una deuda) y *Demo — Joren Pask* (la universidad,
  un cambio de destino, un contacto, un rival y un aliado).
* **Una Escena**, *Demo — Bellweather Roads*, en un compendio nuevo, *MGT2 — Escenas de
  demostración, anotadas* (`mgt2.demo-scenes`): una región *Vacío* y una región *Radiación* que
  cruzar con una ficha. La segunda actúa al entrar, la primera al inicio de cada asalto de combate:
  sin combate, no le hace nada a un Viajero.
* **Cinco carreras y cuatro tablas compartidas** en *MGT2 — Objetos de demostración, anotados*, para
  que una creación jugada solo con el sistema tenga adónde ir tras un rechazo, una vez importados
  estos documentos al mundo. Entre todas llevan el reclutamiento, la carrera siempre abierta, la
  entrada automática, el permiso del árbitro, la entrada forzada y la liberación, la Comisión y el
  cambio de destino. Las carreras son *Demo — Reach Guard*, *Demo — Fen Holders*, *Demo — Quay
  Hands*, *Demo — Pilots' Guild* y *Demo — Harbour Lock-up*.
* **Una habilidad de demostración lleva su nombre real**: *Seafarer* y ya no *Demo — Seafarer*, en
  el objeto y en cada referencia. Una carrera de demostración sube así la habilidad que el Viajero
  ya tiene, en lugar de crearle una segunda.
* **Un documento de demostración dejado en su compendio ya solo responde a su nombre.** Ya no se
  ofrece por sí mismo tras un rechazo, para una entrada forzada sin nombre, para «otra carrera», en
  una elección libre de habilidad ni en la lista de un vale. Importado al mundo, responde como
  cualquier otro documento.
* **Los valores de la demostración son todos inventados.** *Demo — Harbour Patrol*, *Demo — Harbour
  Cadet School*, *Demo — Engineer's Toolkit*, *Demo — Cargo Lot* y *Demo — Kestrel-class Courier*
  cambian de cifras, y el Kestrel tiene por fin una planta de energía a la medida de sus sistemas.
  Un documento ya importado conserva los suyos.

### Documentación

* **El diario de auditoría de reglas** (`mgt2.docs`) **está ahora entero en español y en portugués
  (Brasil)**, con las dos listas de cada pantalla. **Ningún lector de estos idiomas lo ha revisado
  con los libros delante**: los términos vienen de los archivos de idioma y después del vocabulario
  comunitario de Mongoose, el inglés se queda donde ninguno de los dos nombra el término, y un
  término todavía puede cambiar.
* **El mismo diario** sigue esta versión: la crisis de envejecimiento con el cambio de destino, la
  carrera ofrecida y PSI, la edad que escribe la creación, la dispersión de las flotas y el robot en
  el vacío.

### Correcciones

* **La hoja ya no muestra claves en bruto.** Una pérdida escrita por la creación daba el nombre
  interno de su tabla, como `personalDevelopment`: ahora se lee en el idioma de la interfaz, filas
  ya registradas incluidas, y una nota escrita a mano se queda como está. La nota de un contacto
  convertido y la de un gasto se escriben traducidas; las ya escritas no cambian.
* **La ventana de pérdidas de una lesión de creación habla de lesión**, ya no de envejecimiento.
* **Una concesión encuentra la habilidad que se tiene, con su especialidad en mayúsculas o en
  minúsculas**: *Electronics (comms)* sube *Electronics (Comms)* en lugar de crear una segunda.
* **Un arma o un poder cuya habilidad vinculada está escrita por su nombre** abre la ventana de
  tirada en esa habilidad, ya no en *Sin competencia*.
* **Una fila de pérdida facturada al Viajero**, atención de una crisis de envejecimiento incluida,
  **pasa también a sus notas financieras.**
* **En inglés, la relación *Ally* se escribía *Allie*.**
* **Para las macros**: `TravellerActorSheet.checkModifiers` pasa a ser
  `RollPromptHelper.checkModifiers`.

---

## [0.2.8]

**Verificado en Foundry VTT 14.369.**

### Tiradas, cartas y peticiones

* **Otra especialidad de la habilidad se tira a +0** (Core p.58). Un Viajero que solo tiene Pilot
  (spacecraft) 1 ya no está sin competencia para pilotar una nave pequeña: en Pilot (small craft)
  tira a +0, sin el MD-3. Una habilidad escrita sin especialidad, como «Pilot» 2, cuenta a su nivel.
  Solo un Viajero que no tiene la habilidad de ninguna forma sigue sin competencia. Las tiradas de
  creación, la habilidad que exige una armadura, los aumentos y el entrenamiento leen ese mismo nivel.
* **La ventana de tirada ofrece *Pilot, otra especialidad* a +0**, para cada habilidad que el Viajero
  solo tiene en especialidades, después de sus propias habilidades.
* **El puesto de una nave, el Docket y la carta *Petición de tirada* parten de esa entrada**, en lugar
  de *Sin competencia*, cuando el Viajero no tiene la especialidad pedida. El Docket resuelve entonces
  la petición para ese Viajero en vez de dejarla sin resolver, y la carta muestra *Pilot, otra
  especialidad 0*. Con un enlace `@Request` sigue eligiendo el jugador, y la entrada está en la lista.

### Correcciones

* **Una especialidad escrita en el campo *Especialidad*, y no en el nombre de la habilidad, se
  reconoce en todas partes** (Core p.58). Un objeto «Pilot» cuyo campo dice *spacecraft* es Pilot
  (spacecraft) para las tiradas de creación, la regla de conexiones, el entrenamiento, Esquivar, los
  puestos de una nave, el Docket, los enlaces `@Request`, los aumentos y la armadura. Hasta ahora solo
  su presentación y las concesiones de creación leían ese campo; en todo lo demás, una tirada de Pilot
  (spacecraft) no encontraba la habilidad.

---

## [0.2.7]

**Verificado en Foundry VTT 14.369.**

**La creación, releída por tercera vez a partir de las filas que imprimen los libros.** Una nueva
auditoría partió de las tablas de Sucesos y de Percances de los libros y no del código. Encontró un
periodo que no se cerraba tras una expulsión, una decena de defectos más, y más de un centenar de
filas que el formulario de carrera no sabía recoger: una elección con dos salidas, un 2 natural, una
habilidad a elección, una consecuencia que depende del SOC o del sexo del Viajero. Ahora se pueden
escribir ([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). El sistema sigue sin traer
ninguna carrera: hace funcionar las que el árbitro escribe o importa.

### ⚠ Cambios que rompen

* **El MD-3 por falta de entrenamiento ya no se aplica durante la creación, salvo que lo pidas**
  (Core p.11). La edición 2022 del libro deja fuera de la creación todo modificador de los capítulos
  posteriores; la regla *El MD-3 por falta de entrenamiento se aplica durante la creación*, que seguía
  una respuesta de 2018, queda por tanto desactivada por defecto. Un mundo que nunca la había tocado
  juega ahora sin ella: para conservarla, reactívala en *Reglas opcionales y variantes*.
* **Un Percance tirado desde un Suceso expulsa cuando lo dice** (Core p.18: un Percance expulsa salvo
  que se indique lo contrario). Una fila de Sucesos que remite a los Percances puede dejar que el
  Percance decida: *Como diga el Percance*, en su menú *Expulsa*. Una fila añadida a una tabla de
  Sucesos empieza con esa opción. **Las filas ya escritas no cambian**: en *Sigue en la carrera*, el
  Percance que tiran sigue sin expulsar. Pasa a *Como diga el Percance* las que no imprimen «no eres
  expulsado», como el Suceso 3 del Agente, el 8 del Artista y el 8 del Noble.
* **El menú de Lesiones ya no ofrece *Sin lesión*** (Core p.49). Servía para apartar la tabla en la
  rama que una fila no tomaba; ahora lo hace *Qué activa la tirada en la subtabla*. **Una fila ya
  escrita que solo lesiona en una rama**, un fallo por ejemplo, tira ahora las Lesiones cada vez: dale
  esa condición.
* **Una lesión de creación que lleva una característica a 0 ya no es una crisis para toda la vida**
  (Core p.49), con la regla *Una lesión de creación que llega a cero es una crisis de envejecimiento*,
  activada por defecto. La crisis solo dura mientras la característica sigue en 0: los cuidados que la
  restablecen le ponen fin. Antes de que se apliquen las pérdidas, el jugador ve el precio de los
  cuidados y puede repartirlas de otro modo. Una pérdida por envejecimiento a 0 sigue siendo una
  crisis para toda la vida.
* **La misma educación no se cursa dos veces** (Core p.16): otra puede seguir a la primera, pero la
  ya cursada se rechaza.
* **Un 12 natural en la Progresión ya no retiene a un Viajero al que un Suceso impide reengancharse o
  envía a otra carrera** (Core p.18; p.45, Suceso 3 del Explorador): solo puede irse, y la carrera se
  cierra. El 12 solo lo obliga a quedarse frente a su propia decisión de irse. Una interpretación: el
  libro imprime las dos reglas sin decir cuál prevalece.
* **Un Percance que expulsa cuesta la tirada de Beneficio del periodo, venga de donde venga** (Core
  p.18; p.23, Percance 2 del Agente). Hasta ahora solo la costaba una Supervivencia fallida. Un Suceso
  que expulsa sin pasar por un Percance conserva la tirada. Una interpretación.
* **Un efecto sobre las tiradas de Beneficio encontrado durante una educación pasa a la primera
  carrera que la sigue**, ganancia o pérdida, como los MD de la graduación (Core p.16). Se perdía con
  la educación, que no tiene tirada de Beneficio. Una interpretación.

### Filas de Sucesos y de Percances

El formulario de carrera recoge ahora lo que imprimen estas filas. Una fila ya escrita se juega como
antes, salvo lo que dicen los cambios que rompen de arriba.

* **Dos tiradas a elegir, cada una con su dificultad** (Core p.45, Suceso 3 del Explorador;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): el bloque *O en su lugar* añade una
  *Otra tirada*, con sus habilidades y su dificultad. El jugador elige cuál intentar, y las ramas de la
  fila siguen la tirada hecha.
* **Cada consecuencia de una fila toma su rama** (Core p.23, p.45;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): *Qué activa lo que concede la línea*,
  *Qué activa la tirada en la subtabla*, *Qué activa la salida de la carrera* y *Qué activa la
  carrera* se suman a las condiciones que ya tenían las tiradas de Beneficio, el contador y las
  entradas pendientes. La salida y la carrera impuesta se deciden ahora después de la tirada, y una
  concesión hecha *antes de la tirada* pero ligada a una rama espera a la tirada. Una fila ya escrita
  se queda en *Siempre*.
* **Un 2 natural** (Core p.23, Percance 3 del Agente; p.35, Suceso 8 del Mercader): *Solo si la tirada
  de la línea saca un 2 natural*. Una fila que imprime «tira 2D» sin habilidad se escribe con una
  dificultad sola.
* **«Si aceptas… si te niegas…»: una sola pregunta por fila** (Core p.46, Suceso Vital 11; p.57,
  Suceso 3 del Prisionero). *Solo si el Viajero acepta* y *Solo si el Viajero se niega* leen una sola
  respuesta, pedida una vez antes de la tirada; una negativa no hace la tirada. *Solo si el Viajero lo
  toma* sigue siendo una pregunta por consecuencia.
* **La fila dice cómo tira las Lesiones, y quién resulta herido** (Core p.49; p.23, Percances 2 y 5 del
  Agente): *Una vez*, *Dos veces, quedándose con la menor*, *Dos veces, quedándose con la mayor*,
  *Gravemente herido (un resultado de 2)*. Un solo modo no pregunta nada, varios quedan a elección del
  jugador, ninguno los ofrece todos. *Un allegado* resulta herido sin que el Viajero pierda nada.
* **Una habilidad a elección** (Core p.17, p.23, p.25, p.57): una concesión de habilidad puede dejar
  elegir al jugador —*Cualquier habilidad*, *Una habilidad que ya tiene*, *Una habilidad obtenida
  este periodo*, *La habilidad tirada*— salvo las que lista *excepto, separadas por comas*, como
  Jack-of-all-Trades. *Cualquier habilidad* sugiere las del Viajero, las del mundo y las de los
  compendios, y acepta un nombre que no está en la lista.
* **Una segunda concesión, con su propia condición** (Core p.17, Suceso previo a la carrera 4; p.31,
  Suceso 3 del Artista; p.45, Suceso 3 del Explorador): *Lo que la línea también concede*, para una
  fila que da una cosa en cada rama.
* **Una tirada con la habilidad que la fila acaba de conceder** (Core p.17, Suceso previo a la carrera
  10; p.27, Suceso 3 del Ciudadano): *con la habilidad que concedió la línea* o *con una habilidad
  obtenida este periodo*.
* **Una tirada propia de un destino** (Core p.37, Percance 3 de la Armada): el campo *Destino* de una
  tirada. Un Viajero en ese destino hace esa tirada sin que se le pregunte, y no se le ofrecen las de
  los otros destinos.
* **Una fila condicionada al estado del Viajero** (Aliens of Charted Space 1 p.45, p.137, p.259):
  *Condicionada a* una característica entre dos límites, un sexo o un escalón de contador. Cada
  consecuencia toma un lado, *Solo si se cumple la condición de la línea* o *Solo si no se cumple la
  condición de la línea*, y el diario del periodo dice cuál. La condición se lee una vez, antes de que
  la fila cambie nada, así que la pérdida de SOC que impone no la hace cambiar de lado. Una condición
  que no se cumple no plantea la pregunta de la fila ni hace su tirada opcional, y un Viajero sin sexo
  registrado no cumple ninguna condición de sexo. Tres interpretaciones.
* **Una fila mueve un contador de la especie**, como el grado de los K'kree (Aliens of Charted Space 1
  p.131-137), y ya no solo el de la carrera.
* **Una característica fijada, o una pérdida detenida en un mínimo** (Aliens of Charted Space 1 p.23,
  p.274): el modo *Fijar en* da a la característica el valor escrito, en un sentido o en el otro, ya
  que un Aslan convertido en Paria tiene SOC 2 aunque estuviera más bajo. La casilla *mínimo* aparece
  también con *Sumar*, donde detiene una pérdida sin subir nunca un valor que ya está por debajo. Dos
  interpretaciones.
* **Una entrada pendiente solo para el periodo siguiente** (Core p.46, Suceso insólito 1): *Solo el
  periodo siguiente* desaparece cuando se cierra el periodo que sigue.

### Tablas compartidas

* **Una fila puede tirar una tabla propia de la carrera** (Core p.57, el Suceso de prisión del
  Prisionero; [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): el campo *Subtabla* acepta
  el nombre de una carrera del tipo *Tabla compartida*, tirada con 1D si sus filas se detienen en 6, y
  si no con 2D. Un nombre que ninguna tabla lleva muestra un aviso y una línea en el diario; antes no
  hacía nada, o tiraba los Sucesos Vitales en su lugar.

### Educación previa a la carrera

* **La tirada de Comisión que permite la graduación se hace antes del primer periodo** (Core p.16-17;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). Una nueva entrada pendiente, *Tirada
  de comisión antes del primer periodo*, se pone en la rama *Graduado* con el alcance *La primera
  carrera tras graduarse*. Al entrar en esa carrera, el jugador puede intentarla: superada, el Viajero
  empieza en el rango de oficial 1, con su bonificación, y la Progresión del periodo sigue abierta.
  Fallada o rechazada, el primer periodo conserva su propia tirada de Comisión, y un oficial que entra
  así no recibe la bonificación del rango 0 de tropa: dos interpretaciones. **Una educación ya escrita
  no cambia**: su MD y su éxito automático esperan a la tirada del primer periodo; para seguir el
  libro, añade la entrada a su rama *Graduado*.
* **Lo que deja la graduación termina con la primera carrera** (Core p.16): una carrera ofrecida,
  impuesta o desbloqueada por la graduación desaparece en cuanto el Viajero entra en una carrera. Un
  graduado de academia que entraba primero en la Armada conservaba la entrada directa en el Ejército.

### Psiónica

* **Un talento recibido en la instrucción básica es una prueba para aprenderlo** (Core p.229), como en
  una tabla de habilidades; antes se concedía a nivel 0.
* **La Telepatía solo es gratuita como primerísimo talento** (Core p.228): una nueva formación ya no
  la vuelve gratuita.

### Licenciamiento

* **Las tiradas de Beneficio adicionales por rango leen el rango más alto alcanzado** (Core p.46),
  rango de tropa incluido: un sargento de rango 4 que obtuvo una comisión ya no se licencia con su
  rango de oficial 1. Dos carreras que comparten un escalafón ya no comparten su rango más alto.
* **Varios MD de Beneficio de un solo uso pendientes: la tirada pregunta cuáles usa** (Core p.46). La
  ventana *MD en esta tirada* los marca todos por defecto; los que se desmarcan esperan a una tirada
  posterior.
* **Una tirada de Beneficio descartada en la pantalla de cierre** ya no deja pendiente su elección de
  MD.

### Documentación

* **El diario de auditoría de reglas** (`mgt2.docs`) describe la creación tal como es ahora, y dice
  cuáles de sus puntos son interpretaciones.

### Correcciones

* ⚠ **Un periodo terminado por una expulsión no se cerraba** (Core p.11, p.18). Tras un Percance que
  expulsa, la tirada de habilidad que conserva la regla *Un Viajero expulsado conserva la tirada de
  habilidad del periodo* se rechazaba, y el periodo quedaba abierto: ningún periodo servido, cuatro
  años menos de edad, y todo lo que cuenta periodos, del envejecimiento a la PSI y la pensión, igual
  de corto. El periodo se cierra ahora con sus cuatro años. **Un Viajero ya creado no se corrige**: si
  fue expulsado durante su creación, revisa su edad y sus periodos.
* **Un nombre de habilidad se reconoce separe como separe sus palabras**
  ([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)): «Jack of all Trades» es
  Jack-of-all-Trades. Escrito así, conservaba el MD-3 por falta de entrenamiento, se ofrecía como una
  tirada normal, el entrenamiento no lo excluía, y una concesión de creación creaba un segundo objeto
  a su lado.
* **Una habilidad escrita con su especialidad**, «Pilot (spacecraft)», se coloca bajo Pilot con su
  especialidad, en vez de convertirse en una habilidad aparte (Core p.19).
* **Cambiar de destino repite la cualificación con sus MD** (Core p.20): el MD de edad, el de carrera
  anterior, los MD condicionales y los de la especie, que faltaban.
* **Un MD de Progresión trasladado a la tirada de comisión, o un éxito automático, podía retirar
  otra entrada que se le pareciera**, como el MD de Beneficio de otra carrera (Core p.19). Cada uno
  retira ahora exactamente la entrada que usó.
* **Un paso hecho sin carrera en curso**, como los anagáticos al principio de un periodo, ya no se
  repite (Core p.49).
* **Una fila de tabla compartida tirada desde un Percance que no expulsa** ya no puede expulsar (Core
  p.23).

---

## [0.2.6]

**Verificado en Foundry VTT 14.369.**

### Creación

* **Una bonificación de rango ya no sube una habilidad que el Viajero posee** (Core p.18;
  [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). Un rango imprime su habilidad con un
  nivel —Recon 1, Leadership 1— y el Viajero solo la obtiene si ese nivel es mayor que el que tiene.
  Una concesión añadida a una fila de rango empieza ahora en *Solo si es mayor*; antes empezaba en
  *Conceder a 1, o subir en 1*, que llevaba un Recon 1 a 2. **Las carreras introducidas antes de la
  0.2.6 no cambian**: pasa sus bonificaciones de rango a *Solo si es mayor* a mano.
* **«SOC 10 o SOC +1, lo que sea mayor» se encuentra más fácilmente**: una concesión de
  Característica solo ofrece ya *Sumar* y *Subir en 1, pero nunca por debajo de*, y la casilla
  *mínimo* aparece con la segunda, en lugar del valor que esta no lee.
* **Una concesión solo muestra los campos que usa su tipo**: una concesión de Habilidad ya no
  muestra una característica, un Contacto ya no muestra una habilidad, y así sucesivamente.

### Demostración

* **Las bonificaciones de rango de `Demo — Harbour Patrol` pasan a *Solo si es mayor***: Seafarer 1
  en Recruit e Investigate 1 en Senior Officer ya no suben una habilidad que el Viajero ya posee.

---

## [0.2.5]

**Verificado en Foundry VTT 14.368.**

### Creación

* **Una fila que toma prestadas las tablas de otra carrera por fin las tira** (Core p.23, suceso 8
  del Agente; [#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). El modo *Se toman
  prestadas sus tablas, sin entrar* solo escribía una frase en el registro del periodo. Cada una de
  las tres tablas de la carrera prestada —Sucesos, una tabla de habilidades, Percances— se tira en la
  rama que indica la fila: siempre, solo si se superó su tirada, solo si se falló, o si el Viajero lo
  toma. El Viajero nunca entra en esa carrera.
* **Varias carreras, o cualquiera**: *Nombra otra carrera* admite varios nombres separados por comas
  («Rogue, Citizen») y el jugador elige uno; en blanco, se ofrece cualquier otra carrera.
* **La tabla de habilidades se elige**: cualquiera de sus tablas de Destino, o su tabla de
  Habilidades de Servicio, Desarrollo Personal, Educación Avanzada u Oficial.
* **Un Percance prestado nunca expulsa de la carrera en curso**: decide la fila que lo toma prestado,
  como en «¡Desastre! Tira en la tabla de Percances». La tirada de habilidad prestada no le cuesta
  nada a la del periodo.

---

## [0.2.4]

**Verificado en Foundry VTT 14.368.**

### Demostración

* **`Demo — Harbour University`** se une a los objetos de demostración: una universidad inventada,
  la contraparte de `Demo — Harbour Cadet School`. Enseña según su propia tabla de habilidades, una
  habilidad a nivel 0 y otra a nivel 1, tira sus propios Sucesos, y la graduación, con o sin honores,
  deja un MD de calificación para `Demo — Harbour Patrol` y, con honores, un MD en la primera tirada
  de Comisión.

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

* **La ventana de reglas se recorre por ámbito**: un menú a la izquierda muestra una sola página a
  la vez, y las dieciocho interpretaciones de la creación —donde el libro calla o es ambiguo— tienen
  su propia página, ordenada por etapa. Cada regla cabe en una línea y abre su explicación a
  petición; una búsqueda recorre todas las páginas, y un filtro muestra lo que tu mesa ha
  modificado, que el menú también cuenta.
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
