# Changelog — MGT2

[Français](CHANGELOG.fr.md) · [English](CHANGELOG.en.md) · [Español](CHANGELOG.es.md)

> A interface está completa em português. O vocabulário Traveller segue as traduções comunitárias da
> Mongoose onde elas nomeiam um termo; os títulos dos livros e os nomes de traços permanecem em
> inglês, à falta de uma edição brasileira que os nomeie.

---

## [0.2.3]

**Verificado no Foundry VTT 14.368.**

**A criação, relida regra por regra contra o livro.** Uma auditoria completa da criação de Viajantes
encontrou uns trinta pontos onde um campo, um controle ou uma regra existiam sem que nada os lesse: um
bônus de patente que nunca era pago, entradas pendentes sem efeito, um recrutamento reduzido a uma
frase. Todos foram corrigidos, e a educação pré-carreira enfim funciona
([#7](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/7)). O sistema continua sem trazer nenhuma
carreira e nenhuma tabela: ele faz funcionar as que o árbitro digita ou importa.

### ⚠ Mudanças incompatíveis

* **Uma comissão obtida fecha a rolagem de Progressão do período** (Core p.19). Da 0.2.0 à 0.2.2
  seguia-se a antiga atualização do livro, que permitia; a edição 2022 diz o contrário, e é ela que
  vale. Uma rolagem de Comissão falha deixa a Progressão aberta.
* **Cada rolagem do período é feita uma única vez** (Core p.18-19): uma etapa já feita é recusada em
  vez de ser repetida, e uma qualificação recusada fecha o período às outras carreiras, exceto a uma
  que esteja sempre aberta. O árbitro pode reabrir uma etapa feita por engano (↺ *Reabrir esta
  etapa*).
* **Uma carreira de cada vez**: soltar uma carreira em um Viajante que já serve em outra é recusado.
* **Uma carreira de entrada forçada, como o Prisioneiro, não se escolhe mais voluntariamente** (Core
  p.52): entra-se nela por uma condenação deixada pendente, pelo recrutamento ou pela mão do árbitro.
* **Migração dos mundos.** Nenhuma carreira servida tinha recebido sua designação nem sua escala de
  patentes. Na primeira vez que um mundo abre na 0.2.3, cada carreira já servida recebe sua designação
  onde ela falta e o modelo só oferece uma, e depois a escala que essa designação nomeia. **A patente
  nunca é alterada**, e os bônus de patente que a carreira nunca pagou não são pagos depois: o árbitro
  recebe a lista numa mensagem privada.
* **Para scripts e módulos**: o teste de uma linha de Eventos agora nomeia uma lista, `check.skills`,
  em vez de `check.skill` — um modelo salvo antes é lido como está. A linha de Contas médicas de uma
  carreira (`medicalBillsRow`) aceita um de três identificadores, `military`, `civilian` ou
  `independent`, e um rótulo digitado como o livro o imprime continua reconhecido.

### Educação pré-carreira

* **Uma carreira do tipo *Educação pré-carreira* enfim segue suas próprias regras** (Core p.16-17):
  só se entra durante os três primeiros períodos, uma tentativa por período, com o MD do período; uma
  recusa deixa o período para uma carreira.
* **Durante a educação**: as perícias que ela ensina — uma universidade as escolhe na própria tabela,
  uma academia militar as lê nas Perícias de Serviço da sua carreira —, uma rolagem nos Eventos
  pré-carreira, e **nem rolagem de Sobrevivência, nem Comissão, nem rolagem de Benefício**. O período
  conta mesmo assim para a idade, o envelhecimento e a PSI.
* **A formatura** é rolada como a educação a imprime, com suas honras, seu piso de fracasso e seus MD
  condicionais. O que ela deixa — um MD de qualificação, um MD ou um sucesso automático na primeira
  rolagem de Comissão, a entrada direta na carreira da academia — vale para **a primeira carreira
  tentada depois**, e se perde se essa carreira recusar o Viajante. Um cadete que fracassa sem tirar 2
  ou menos mantém sua vaga, sem rolagem de Comissão no primeiro período; um Evento «você não se forma»
  proíbe a rolagem.
* **Uma educação não é uma carreira anterior** (Core p.16): a primeira carreira depois dela mantém
  todo o seu treinamento básico e não sofre o MD−1 por carreira anterior, a menos que a nova regra
  opcional diga outra coisa. Duas educações seguidas são possíveis — uma interpretação: o livro só
  fixa a janela e uma tentativa por período.
* **O formulário de carreira ganha um bloco *Educação***: a janela, os MD por período, a carreira
  vinculada, a duração (os 22 + 2D3 anos do Companion se escrevem `4+2D3`), as perícias escolhidas, o
  que se concede ao entrar, e a formatura com seus três resultados. As opções do Companion (p.32-34)
  também se escrevem ali.

### Tabelas compartilhadas

* **Os Eventos de Vida, o Evento incomum, o Recrutamento, os Eventos pré-carreira e as Perícias de
  antecedentes têm um lugar**: cada uma é uma carreira do tipo *Tabela compartilhada*, que o árbitro
  vincula no menu *Tabelas de criação compartilhadas* das configurações do mundo. O sistema não traz
  nenhuma.
* **A ficha de uma tabela compartilhada mostra apenas o seu tipo e os seus Eventos**: o resto da
  carreira, que uma tabela não lê, continua salvo e volta se o tipo voltar a ser *Carreira*.
* **Uma vez vinculadas, elas são jogadas como as linhas de uma carreira**: um 7 em Eventos rola os
  Eventos de Vida, e uma linha que nomeia uma tabela a rola e a aplica — um contato, uma traição, um MD
  pendente, uma rolagem de Benefício perdida, o Prisioneiro. Sem tabela vinculada, o sistema continua
  dizendo qual rolar no livro.
* **O recrutamento é jogado** (Core p.19): uma qualificação recusada oferece o recrutamento, uma vez
  na vida, uma carreira sempre aberta como o Andarilho, ou decidir depois. O recrutamento rola a
  tabela vinculada e entra na carreira sorteada, na designação impressa, sem rolagem de qualificação.
  Um Evento que recruta impõe essa carreira no período seguinte (Core p.17).
* **As Perícias de antecedentes** oferecem sua lista onde a espécie não imprime nenhuma (Core p.9).

### O período

* **Entrar em uma carreira pede a designação**, antes da rolagem, e escreve a escala que ela nomeia.
  Mudar de designação no Agente, no Cidadão, no Artista ou no Mercador abre uma carreira nova (Core
  p.20): o período se fecha, e o seguinte se qualifica para a nova designação.
* **As entradas pendentes fazem o que dizem**: um sucesso automático passa a promoção ou a comissão
  sem dados, uma proibição impede a sua rolagem, uma carreira oferecida é entrada sem qualificação,
  uma carreira imposta é a única aberta, uma carreira bloqueada tira o *Continuar*, uma carreira
  desbloqueada dispensa a permissão do árbitro. Um MD de Progressão pode servir à rolagem de
  Comissão, à escolha do jogador (Core p.19). **O árbitro acrescenta ou retira uma entrada à mão.**
* **As linhas de Eventos**: seu efeito nas rolagens de Benefício pode depender do seu próprio teste,
  e as apostas da Marinha, do Mercador e do Malandro são jogadas (Core p.35, p.37, p.41) — uma aposta
  aceita, recusada ou escolhida entre as rolagens devidas, e uma vitória que rende metade da aposta,
  arredondada para cima. Um teste «se você aproveitar esta oportunidade» pode ser recusado. Uma linha
  pode conceder sua perícia **antes** do seu teste, como a Marinha e o Malandro imprimem; um teste
  impresso sobre duas ou três perícias é feito com a melhor do Viajante, e uma linha pode subir um
  nível na perícia usada, como o Mercador — uma interpretação da ordem impressa, que nenhuma errata
  resolve.
* **Ferimentos e cuidados médicos** (Core p.49): uma linha que remete aos Ferimentos os rola como a
  linha os imprime, o jogador distribui as perdas, e os cuidados custam Cr5000 por ponto, menos a
  parte do empregador lida nas Contas médicas; o resto é uma dívida, paga primeiro com o dinheiro da
  baixa (Core p.52).
* **Os anagáticos** (Core p.49): a partir de SOC 10, duas rolagens de Sobrevivência por período, os
  períodos de tratamento como MD positivo no envelhecimento, 1D × Cr25000 por período levados como
  dívida, e uma rolagem de envelhecimento assim que param; um 2 exato leva ao Prisioneiro.
* **O Prisioneiro** (Core p.52, p.57): o Limiar de Condicional é rolado na entrada, um detento não
  pode sair, e a libertação — pela Progressão ou por uma fuga — encerra a carreira.

### Espécies

* **Os três períodos mínimos dos Aslan numa carreira antes de tentar outra** (Aliens of Charted Space
  1 p.19): a decisão do período o lembra, uma carreira deixada por escolha antes da hora recusa a
  seguinte — a baixa continua aberta —, e uma carreira que a espécie isenta, ou que um Evento oferece
  ou impõe, nunca é recusada.
* **Uma carreira reservada a uma espécie ou a um sexo** recusa os outros Viajantes; uma espécie
  nomeada sem a sua variante admite todas elas.
* **Uma característica de substituição** — o CHA dos Vargr, a RES dos Hiver (Aliens of Charted Space 1
  p.179, 2 p.255) — aparece no lugar da que ela substitui e ocupa a posição dela no PUP.
* **Os modificadores e os dados de uma espécie podem depender do sexo**, como os do Gurvin (Aliens of
  Charted Space 4 p.167); um Viajante cujo sexo ainda não foi fixado rola os dados comuns, e a janela
  o diz.
* **A atribuição de características**: uma casa com os dados próprios da espécie, como o 1D+6 dos
  Hiver, mantém sua rolagem; um dado de vantagem se soma a esses dados; um valor impresso em vez de
  rolado, como o TER 0 dos Aslan, conta como fixado.
* **Um contador que *apenas sobe* nunca desce**, seja qual for a regra do mundo.
* **Um quadro de espécie impõe sua característica à rolagem de Sobrevivência e à Comissão**, como já
  fazia com a Progressão.

### Baixa

* **Uma rolagem de Benefício só é oferecida a uma carreira que ainda a deve** (Core p.46), e a
  contagem não fica mais abaixo de zero.
* **As cláusulas de repetição impressas** (Core p.47): uma arma recebida duas vezes pode virar um
  nível de perícia, mais um quarto da hipoteca é pago, uma Nave Batedora é rolada de novo.
* **Um aumento de característica para no máximo da espécie**, 15 para um humano (Core p.9), e o SOC
  excedente vindo de uma tabela de Benefícios vira cotas de nave (Core p.47).
* **As cotas de nave investidas na nave mantida** não pagam mais os Cr1000 anuais (Core p.48; contá-las
  por cota é uma interpretação), e encerrar a criação quando vários Viajantes mantêm uma nave é
  sinalizado.
* **Os modificadores permanentes chegam à rolagem de Benefício**, como o FOL 10+ dos Truthers
  (Companion p.36).
* **Os Cr10000 de equipamento que se pode comprar antes do jogo** são exibidos (Core p.46).

### Psiônica

* **Um novo treinamento psiônico custa Cr100000** (Core p.228): o primeiro é gratuito, e cada novo,
  que zera a penalidade cumulativa, é pago com o dinheiro do Viajante ou como dívida. Uma
  interpretação: o livro não dá nenhum preço durante a criação.
* **Um talento tirado numa tabela de perícias** é um teste para aprendê-lo (Core p.229), e não mais um
  talento ganho de imediato.

### Contatos

* **Um contato pode ser vinculado à ficha de um Viajante ou de um NPC**: solte o Ator na ficha do
  contato, que o abre com um clique e pode desvinculá-lo.

### Regras opcionais e variantes

* **A janela de regras é percorrida por domínio**: um menu à esquerda mostra uma página por vez, e
  as dezoito interpretações da criação — onde o livro é omisso ou ambíguo — têm uma página própria,
  organizada por etapa. Cada regra cabe numa linha e abre a sua explicação quando pedida; uma busca
  percorre todas as páginas, e um filtro mostra o que a sua mesa alterou, que o menu também conta.
* **Nova, ativada**: *Um Viajante expulso mantém a rolagem de perícia do período* — uma
  interpretação, já que o livro tira a rolagem de Benefício e a carreira sem dizer nada da rolagem de
  perícia (Core p.18). O registro do período diz em que sentido ela vale.
* **Nova, desativada**: *A educação pré-carreira conta como uma carreira anterior*.
* *O dinheiro gasto durante a criação vira dívida* cobre também os cuidados médicos, os anagáticos e
  um novo treinamento psiônico.

### Demonstração e documentação

* **`Demo — Harbour Cadet School`** entra nos itens de demonstração: uma academia vinculada a
  `Demo — Harbour Patrol`, para ver uma educação do começo ao fim.
* **`Demo — Harbour Life Events`** também: uma tabela compartilhada inventada, a vincular em *Tabelas
  de criação compartilhadas*, cujas linhas mostram o que uma tabela faz — o Evento incomum e os
  Ferimentos como subtabelas, uma rolagem de Benefício perdida, um Rival ou um Inimigo, uma traição,
  MD pendentes, uma proibição.
* **`Demo — Harbour Patrol` mostra as novas linhas de Eventos**: um teste opcional, uma aposta com a
  concessão antes do teste, um teste sobre duas perícias que sobe um nível na usada, um sucesso
  automático pendente. Ela paga o seu bônus de patente 0 e nomeia a sua linha de Contas médicas.
* **O diário de auditoria das regras** (`mgt2.docs`) descreve a criação como ela está agora.

### Correções

* **Os bônus de patente de praça e civis nunca eram pagos**: só um posto de oficial pagava, depois de
  uma comissão. A patente 0 é paga na entrada, e cada promoção paga a sua (Core p.19).
* **«Role na tabela de Reveses» não rolava a tabela** (Core p.23). Agora ela é rolada, e o Viajante
  permanece na carreira quando a linha o diz.
* ⚠ **O formulário de carreira apagava dados a cada salvamento**: a referência a um Outro Benefício,
  a relação de um contato (Aliado, Rival, Inimigo), o piso de «SOC 10 ou SOC +1» e uma lista de
  especialidades sumiam assim que outro campo era editado, e um MD de qualificação condicional não
  podia ser digitado. Uma carreira importada e depois retocada pode ter perdido algum: confira-a.
* **Um MD «para a sua próxima rolagem de Sobrevivência» era gasto pela rolagem de envelhecimento**, e
  um MD de Progressão duradouro se somava aos testes dos Eventos.
* **Um Revés que não expulsa anulava mesmo assim** o Evento, a Comissão e a Progressão do período
  (Core p.18).
* **Uma Conexão não acrescentava nada a uma perícia já possuída** (Core p.19): ela a sobe um nível,
  até 3.
* **As perdas do envelhecimento podiam cair todas na mesma característica** (Core p.49).
* **A Telepatia só era gratuita enquanto nenhum talento era possuído**: ela é gratuita enquanto
  nenhum teste foi tentado (Core p.228-229).
* **O número de perícias de antecedentes** diferia entre o chip e a janela de escolha, e uma espécie
  que as dá «além disso», como os Hiver, as via ocupar a contagem.
* **Uma coluna de Dinheiro vazia**, numa carreira digitada à mão, pagava Cr0 e gastava uma rolagem:
  agora ela pede o valor. Um benefício de característica ou de perícia escolhido à mão se aplica na
  hora.
* **A geração solo não concedia a sua perícia de nível 1**, e um Viajante morto em Iron Man seguia
  com o seu período (Companion p.13).

---

## [0.2.2]

**Verificado no Foundry VTT 14.368.**

### Correções

* **A janela *Regras opcionais e variantes* rola**: o fim da lista ficava inacessível, mesmo em tela
  cheia ([#6](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/6)). Três janelas tinham o mesmo
  defeito: a descrição completa de uma espécie, a escolha de um benefício de baixa e o *Treinamento
  psiônico*.
* Trocar de espécie durante a criação não exibe mais um aviso de compatibilidade no console.

---

## [0.2.1]

**Os passos que a criação nunca teve.** A 0.2.0 trouxe o laço de períodos sem os três passos que vêm
antes dele, e sem controles para várias regras que ela já calculava.

### Criação de Viajantes

* **As características agora rolam**, pela tela de criação — um chip antes dos períodos, que guarda o
  PUP obtido — e pelo banner da ficha assim que a criação começa.
* **Os quatro métodos de atribuição do ajuste funcionam**: em qualquer ordem, na ordem impressa, ou os
  12D do Companion atribuídos aos pares, variante heroica incluída. Onde um quadro impõe seus
  próprios dados, ou há dados de vantagem em jogo, a reserva é recusada **em uma frase** em vez de em
  silêncio.
* **As perícias de juventude agora são tomadas** (Core p.9) — DM de EDU + 3, um segundo chip antes
  dos períodos, no nível 0. Uma perícia que o quadro *declara* preenche sua própria linha: ela é
  imposta e não oferecida.
* **A Força Psiônica é testada e treinada** (Core p.228), onde a mesa adotou a característica:
  primeiro o teste, depois a janela de treinamento — a escada de talentos, a Telepatia grátis como
  primeira, a penalidade cumulativa por tentativa. **Um novo treinamento é um controle à parte**,
  porque quatro meses e Cr100000 não são efeito colateral de olhar, e é ele que enfim zera essa
  penalidade, como sua configuração sempre disse.
* **A regra de conexões agora é jogável** (Core p.19): dois Viajantes, uma perícia cada, o evento
  compartilhado anotado. Ela fica no cabeçalho da tela porque escreve em dois Viajantes de uma vez,
  o que nenhuma ficha consegue; as quatro recusas impressas são ditas pelo nome.
* **Uma traição vira uma relação em vez de inventar outra** (Core p.20): um Contato ou Aliado vira
  Rival ou Inimigo, e o recuo impresso vale quando não há nenhum.
* **Uma coluna aceita a espécie solta nela** — cabeçalho ou célula — e **substitui** a que já está
  lá, após confirmação. As trilhas que só o quadro anterior declarava vão junto.
* **O cabeçalho declara os termos da mesa**: o método de atribuição, e apenas o que se afasta do
  jogo impresso.

### Correções

* Soltar uma espécie em um Viajante em branco **tirava o botão *Começar* da ficha dele**.
* O que a tela de criação não pode aceitar agora é **recusado em voz alta** em vez de sumir.
* ⚠ **Um custo incorrido durante a criação levava os créditos abaixo de zero**, e a configuração
  *O dinheiro gasto durante a criação vira dívida* não tinha efeito nenhum. Esse custo agora paga o
  que há, carrega o resto como dívida, e **recusa por inteiro** onde a regra está desligada.

---

## [0.2.0]

**A maior versão que este sistema já teve.** A 0.1.x era uma ficha de personagem; a 0.2.0 é um sistema
de jogo. Sete tipos de Ator, dezoito tipos de Item, criação de Viajantes em grupo, combate espacial
e batalhas entre frotas, comércio especulativo e tráfego de escala, viagens e salto, adestramento, a
cadeia de dano completa, quarenta e nove regras opcionais, um compêndio de documentação em quatro
idiomas e uma demonstração comentada de cada tipo que o sistema declara.

### ⚠ Mudanças incompatíveis

* **Exige o Foundry VTT v14** (14.366 no mínimo). Não funciona mais nas v11 a v13.
* **O tipo de Ator `vehicule` desaparece**, substituído por `vehicle`, e **nenhuma migração é
  fornecida** — os dois não compartilham quase nenhum campo, então uma conversão não levaria quase
  nada. Um Ator do tipo antigo **não é apagado**: a linha dele continua no banco. Mas o Foundry não
  consegue mais construí-lo, então ele some do diretório de Atores e o console informa *is not a
  valid type* a cada carregamento. Se você tem veículos, **anote o que eles carregavam antes de
  atualizar** e digite-os de novo na ficha nova.
* **Soltar uma Espécie não altera mais a Característica armazenada.** A Espécie passa a ser um Item
  embarcado e seu modificador é derivado. A migração subtrai o bônus já gravado e **registra cada
  subtração** no console, por nome de Ator. Dois casos não podem ser resolvidos e são relatados em vez
  de adivinhados: um Viajante cuja Espécie sumiu do mundo fica exatamente como está, e **um Viajante
  que recebeu duas vezes a mesma Espécie mantém uma cópia do bônus** — nada nos dados distingue um
  soltar de dois. Verifique à mão.
* **O PUG digitado à mão desaparece**: ele deriva das seis Características canônicas.
* **O combustível muda de campo.** `fuelPerJump` vira `fuelPerMaxJump`, chega `fuelPerParsec`, e a
  linha *Combustível* do bloco de Finanças passa a ser um custo por tonelada mais um tanque cheio —
  antes cobrava um tanque por período, quantidade que nenhuma regra enuncia.
* **A folha de estilo é carregada na camada CSS `system`**, o que finalmente permite aos módulos
  sobrescrever o sistema de forma limpa — e muda a precedência se você tinha CSS próprio.

### Criação de Viajantes

* **Criação em grupo**, numa grade de Viajantes × períodos. Cada jogador rola pelo seu próprio
  Viajante; o árbitro acompanha todo mundo numa só tela.
* **Nada se perde se a sessão for interrompida.** Não há documento de sessão: cada resultado decidido
  é gravado no Ator no momento em que é decidido.
* **As carreiras são modelos que o árbitro escreve**, com um formulário completo: postos, designações,
  tabelas de perícias, benefícios, eventos e contratempos, recompensas. O sistema não traz nenhuma
  tabela de carreira — traz o registro que as faz funcionar.
* **As espécies são molduras de criação**, não blocos de parâmetros: uma espécie declara seus próprios
  períodos, testes, tabelas e trilhas. A sequência do livro básico é a moldura padrão.
* **Uma rolagem de qualificação pode carregar um DM condicional** — *DM+2 se SOC 9+*, a forma que
  algumas carreiras e algumas espécies imprimem, e que até agora era preciso lembrar e aplicar à mão.
* **Baixa**: benefícios, pensão, cotas de nave e um encerramento de grupo em que apenas um Viajante
  pode começar como proprietário de uma nave.
* **Vinte e duas regras opcionais de criação** (mais abaixo), dezesseis delas onde nenhum livro
  decide: os livros se calam, ou dizem duas coisas em duas linhas.
* **Registro assinado das perdas permanentes de Características** — envelhecimento, ferimentos,
  cuidados médicos — cuja soma é derivada. Funciona sem a criação e serve igualmente em jogo.
* **Adestramento**: um registro de programas, um por estudo em andamento, cada um indicando *qual
  livro o rege*. Os Períodos de Estudo do básico e os Pontos de Experiência do Companion são duas
  formas de mover o mesmo registro. Um programa pode mirar uma Característica (SOC e PSI excluídos), e
  um professor é um Ator cujo nível é lido no momento da rolagem.

### Combate

* **Combate espacial** — um subtipo de Combate próprio, com três fases por rodada e uma faixa de
  alcance para **cada par de naves**. O grupo é a nave, e sua tripulação age na Iniciativa da
  estrutura.
* **Batalhas entre frotas** (High Guard), atrás de um interruptor de regra opcional. Uma Ficha de nave
  de frota sobre a espaçonave, um motor que resolve num Fator de Ataque **sem rolagem para acertar**,
  esquadrões de caças, salvas de mísseis em voo, moral e dispersão. Numa batalha de frotas o grupo é a
  frota e a nave vira um combatente.
* **Mísseis e torpedos** (Companion cap. 29), atrás de três interruptores. Uma salva agora tem um
  **tipo** — padrão, dogfight, interceptador ou torpedo — e sua classe decide de quais faixas de
  alcance ela pode partir. A defesa se resolve em três camadas: defesa de área, defesa pontual e o
  fogo aproximado do básico. Um lançador em contêiner consome um ponto rígido, de modo que uma
  estrutura de menos de 100 toneladas não carrega nenhum.
* **Agarrão** — os oito resultados do livro: caído, desarmar, arremessar, dano, pistola ou lâmina
  curta, escapar, arrastar, continuar.
* **Duas armas**, **Faz-tudo** e **a ação prolongada interrompida** são aplicados.
* **Um modificador de Iniciativa permanente enfim tem onde pousar**, em todos os tipos de Ator. A
  ponte holográfica do básico e do High Guard (*DM+2 na Iniciativa*) é a primeira coisa a usá-lo.
* **Uma diagonal é medida em euclidiana**, como o Companion p.173 pede: dez quadros marcavam 15 m e
  agora marcam 21 m.
* **O alcance é medido a partir do alvo** na janela de rolagem, quando há um token marcado.

### Saúde, dano e recuperação

* **A cadeia de dano completa** — a ordem de dano é editada numa lista reordenável: arrastar para
  ordenar, remover, acrescentar a partir das Características disponíveis.
* **A carta de dano é resolvida do lado do defensor**: o jogador alvo a aplica, e a Armadura, a
  Proteção e o dano que ignora a armadura são considerados no lugar certo. **O dano que ignora a
  armadura estava documentado e não era aplicado** a Viajantes nem a NPCs.
* **Primeiros socorros, cirurgia e cuidados médicos** partem da carta de chat e escrevem nos Viajantes
  **controlados**. A cirurgia aplica o número digitado, que antes era exibido e descartado.
* **Recuperação psiônica**, com sua escala de horas.
* **Doenças, venenos e ferimentos são Itens**, e um traço de arma que inflige um **constrói o Item no
  defensor** — toda a mecânica existia e nada a chamava.
* **Doses de drogas e munição carregada**: uma dose é um Efeito Ativo, a munição carregada é uma
  derivação sobre a arma que a dispara.

### Espaçonaves, viagens e finanças

* **A nave carrega sua etapa de viagem** — aqui, próxima parada, distância em parsecs, fila — e seu
  nível real de combustível.
* **Salto e salto falho**, com o ramo do Companion, e um ajuste para o tempo percebido num salto
  atrasado.
* **A ficha impressa vence a fórmula.** Seis campos opcionais — pontos de estrutura, energia
  consumida, tonelagem de armadura, tonelagem e custo da ponte, combustível de salto — permitem
  transcrever uma nave publicada exatamente como impressa, com um marcador dizendo qual foi forçado.
* **Componentes de nave**, com verificação de projeto: seis conferências sobre tonelagem, energia e
  orçamento, atrás de um interruptor.
* **Computadores, programas e Largura de banda**: a soma contra o Processamento, o teto de Nível
  Tecnológico, o rebaixamento dos programas pesados demais e a exceção dos programas de Interface.
  Numa nave, quem limita é o NT **da estrutura**, nunca o do computador.
* **Hipoteca da nave**, com suas cotas, seu calendário, a opção de cobrança a cada quatro semanas, e
  **Fuga das dívidas**.
* **Um carimbo de manutenção**: a nave guarda o dia de campanha do seu último serviço, e a ficha diz
  de quantos períodos de quatro semanas ela está atrasada. Nada é rolado e nenhum modificador é
  derivado daí — o básico p.154 diz que a manutenção *deveria* ser feita, então os DM por tê-la pulado
  continuam sendo do árbitro.
* **Transferência de créditos** — a primeira tela do sistema que move dinheiro sob demanda.
* **Posto de tripulação** como tipo de Item: um posto é uma descrição de função, e dois artilheiros
  podem compartilhá-lo.

### Comércio

* **O Mundo vira um Ator**: Perfil Universal de Mundo colado de uma vez e analisado, dezoito códigos
  comerciais derivados com substituição Auto/Sim/Não para cada um, qualidade e preço do combustível,
  taxa de atracação, e o estado do comércio especulativo datado com o *Dia de campanha*.
* **Um mundo sabe onde está**: setor pelo nome e hex dentro desse setor — o par que os livros
  imprimem. O subsetor e uma coordenada absoluta derivam disso, de modo que dois mundos de setores
  diferentes passam a ser comparáveis. Conferido contra 1 165 mundos publicados sem uma única
  divergência.
* **Comércio especulativo**: as três tabelas do livro — os 18 códigos, a tabela 36×8 de Mercadorias e
  as 29 linhas de Preço Modificado. A tela aceita um **Mundo solto** e para de pedir o que o documento
  já sabe.
* **Tráfego de escala**: passageiros, frete e correio viram Itens na nave, e um **Manifesto** na ficha
  da nave permite entregar uma consignação e desembarcar um passagem.
* **Lote de carga** e **Passagem** como tipos de Item, com destino, prazo e tarifa — três campos que
  existiam desde o início e que nada jamais escrevia.
* **O circuito se fecha**: um preço negociado compra um lote e debita a tripulação, e o porão revende.

### Reputação e contratos

* **A Reputação (REP)** entra nas características que uma mesa pode adotar, desligada por padrão. Ela
  se lê como qualquer outra — `REP 0` vale DM−3 — e a rolagem de Mudança de reputação toma **DM−1 a
  cada quatro REP já conquistados**: um nome já feito é mais difícil de crescer. As onze
  circunstâncias impressas se sobrepõem de propósito, e **só a mais alta se aplica**: elas nunca são
  somadas.
* **Um contrato de recompensa** como tipo de Item, e ele é o documento **dos Viajantes** — a parte que
  o livro entrega a eles. As linhas do árbitro se dobram por cortesia na mesma ficha: a Reputação
  mínima, a última localização, quem sabe o quê, as complicações. O alvo pode ser uma pessoa, um lugar
  ou um objeto, e o alvo, o contratante, os associados e o caçador são cada um um Ator do mundo
  solto, que decai para um nome guardado para quem não pode vê-lo.
* **O grupo rola o próprio contrato.** As duas rolagens que o livro dá a eles — negociar a recompensa
  e se qualificar para um contrato que a Reputação deles não alcança — são feitas do assento dos
  jogadores, sobre um documento que de resto eles não podem editar.
* **Uma aba de geração** tira um das tabelas impressas: contratante, prioridade, alvo, recompensa,
  complicação — oito sorteios, cada um caindo no campo que o seu passo nomeia.

### O mundo ao redor dos Viajantes

* **Quatro comportamentos de região** — gravidade, temperatura, vácuo, radiação. Eles enunciam o
  intervalo e seu custo; **o sistema nunca agenda o tempo**. A rodada de combate é a única exceção,
  porque o Foundry já a conta.
* **Reserva** — um inventário que ninguém carrega: uma pilha de espólio, o estoque de uma loja, um
  esconderijo. Tem permissões próprias, e é toda a razão de ser um Ator.
* **Os recipientes funcionam fora de um Ator.** Uma bolsa criada na aba de Itens retém itens do mundo,
  enche-se arrastando um item sobre sua ficha e esvazia-se devolvendo o item à barra lateral. Apagar
  uma bolsa libera seu conteúdo em vez de levá-lo junto.
* **Os recipientes se aninham**, até cinco níveis, e o peso sobe pela cadeia. Um recipiente nunca pode
  acabar dentro de si mesmo.
* **Carga** atrás de um interruptor, lida na FOR e na RES atuais.

### Rolagens, cartas e pedidos

* **A janela de rolagem foi refeita**: a fórmula e o Efeito são lidos ao vivo enquanto você ajusta,
  incluindo Trunfo e Empecilho.
* **Cadeia de tarefas** — uma carta de rolagem pode citar a anterior e tirar dela seu modificador.
* **O Docket**: o árbitro compõe um pedido — perícia, característica, dificuldade, Trunfo ou
  Empecilho, prazo, um DM nomeado e seu motivo — resolve-o contra uma lista de Viajantes **antes de
  enviá-lo**, e o publica como uma carta que cada jogador responde do seu lugar.
* **As cartas de chat carregam seus dados**, então o Dice So Nice as anima.
* **Arrastar uma perícia ou uma arma para a barra de macros cria a rolagem certa.** Antes criava
  silenciosamente uma macro que abria a ficha do item.

### Interface

* **A ficha de personagem foi refeita**: coluna de Características com medidor de esgotamento, barra
  de abas trazida de volta para dentro da ficha, tabelas mais leves.
* **Modo de jogo e modo de edição** nas fichas, ao estilo dnd5e: os controles de estrutura somem
  enquanto você joga.
* **Uma só paleta, e ela é do leitor.** Quatro predefinições, onze cores de destaque e um eixo *claro
  ou escuro* que segue o Foundry por padrão ou o substitui apenas para este sistema. Todas as cores de
  uma ficha derivam desse único destaque, e cada cor de texto foi medida em 4,5:1 ou melhor sobre
  todos os fundos. Dois interruptores o acompanham: uma barra de janela escura nos dois fundos, e um
  par de sucesso e falha para daltonismo. Cinco ajustes pessoais, e nenhum pede para recarregar. **Os
  três temas da 0.1.x somem** — um cliente que carregava um é migrado e mantém a sua cor.
* **Fichas, diálogos e cartas de chat seguem o tema claro ou escuro do jogador.**
* **As fichas de item passam a cinco abas** sobre os mesmos blocos, com um cabeçalho acima: uma ficha
  de arma vai de 956 px para 489 px.
* **A ficha não é mais redesenhada inteira a cada tecla**: apenas as seções afetadas são
  reconstruídas.
* **Uma regra e sua página não são mais texto na ficha**: a ficha enuncia o que faz, e a regra por
  trás é uma dica de contexto.
* **Explorador de compêndios**, ao estilo dnd5e: compêndios do mundo e dos módulos, filtráveis por
  Nível Tecnológico, subtipo e escala.
* **Botão de criação dos compêndios do mundo** a partir dos ajustes: entrega a estrutura e nunca o
  conteúdo.

### Regras opcionais e variantes

**Quarenta e nove regras em seis grupos**: *Viajantes* 4, *Criação* 22, *Combate* 5, *Saúde* 4,
*Espaço* 11, *Naves e robôs* 3. Um único menu nos ajustes do mundo, e **nem todas começam
desligadas** — cada valor padrão é a leitura que os livros melhor sustentam, então uma regra opcional
vem desligada e uma regra que os livros imprimem *como* regra (carga, carregadores, radiação) vem
ligada.

Quatro formas: um interruptor, uma seleção múltipla (um conjunto), uma escolha de procedimento e uma
contagem — porque um booleano não consegue dizer *qual procedimento impresso está em vigor* quando
dois capítulos não são a negação um do outro. Dezesseis linhas não citam livro: catorze exibem *regra
da casa* e duas *não oficial*. Uma regra da casa existe exatamente onde os livros se calam, ou onde
dizem duas coisas em duas linhas.

Mudar um interruptor reprepara e redesenha as fichas abertas; nada pede para recarregar.

### Documentação e idiomas

* **O sistema traz seu primeiro compêndio**: `mgt2.docs`, um diário por idioma, vinte e três páginas
  cada. Cada página diz duas coisas sobre uma tela — **do que ela cuida por você** e **o que ela deixa
  para você na mesa**. É documentação *sobre o sistema*, nunca texto de regras.
* **Dois compêndios de demonstração, anotados**: um documento para **cada tipo e subtipo que o sistema
  declara** — 8 Atores e 27 Itens, todos chamados `Demo — `. Cada um carrega para que serve o
  documento, o que lê cada campo e a única armadilha que ele existe para mostrar. Um exemplo
  trabalhado em vez de um mundo inicial, e todos os seus números são inventados.
* **Quatro idiomas declarados** — francês, inglês, espanhol e português (Brasil), e **os quatro estão
  completos**. O francês é o alvo do sistema; o vocabulário espanhol e português segue as traduções
  comunitárias da Mongoose, e os títulos dos livros e os nomes de traços permanecem em inglês onde
  nenhuma edição publicada os nomeia.

### Correções

* `system.json` não gera mais avisos
  ([#3](https://github.com/JDR-Ninja/foundryvtt-mgt2/issues/3))
* As fontes Roboto, Roboto Condensed e Rubik Mono One eram usadas pelas fichas e nunca carregadas
* Os dados das linhas de inventário, perícias, talentos psiônicos e doenças não rolavam nada: só a
  iniciativa e as Características respondiam
* As notas financeiras nunca eram salvas (o campo tinha um nome ausente do esquema)
* O rótulo vertical das fichas de item continuava vermelho nos temas Mwamba e Azul
* Soltar um item sobre a linha de um recipiente no inventário não guardava nada: o gerenciador
  procurava uma classe CSS que nenhum modelo emitia
* **Seis tipos de Item não podiam ser soltos em nenhuma ficha do sistema**, quatro deles dos que
  compõem uma estrutura
* **Nenhuma zona de soltura era destacada corretamente**: o cache de arrasto ficava sempre vazio
* **Soltar uma pessoa na linha do segundo artilheiro a inscrevia na do primeiro**
* Uma nave-mãe pagava manutenção de todas as naves transportadas menos uma
* Os programas adicionados pelo botão `+` do bloco Computador eram invisíveis ao resto do sistema
* Uma perícia cujo nome já carrega sua especialidade — *Animais (Adestramento)* — a enunciava duas
  vezes
* O combustível de salto era calculado com o alcance máximo da nave em vez da taxa impressa (10 % da
  estrutura por parsec)
* **O botão de primeiros socorros sumia num mundo francês**, pois a lista de perícias de cura existia
  só em inglês
* Três ajustes não aplicavam nada até recarregar
* Uma chave de duração tinha um nome francês no dicionário inglês, e esse erro ficava **gravado em
  cada talento psiônico** medido em horas; a migração reescreve o valor
* Onze citações de página estavam uma página acima, três delas visíveis aos jogadores
* Os códigos comerciais exibiam sua condição em inglês fixo, o único texto do sistema a escapar da
  tradução

---

## [0.1.4] (2024-05-25)

### Correções
* Erro ao calcular o peso em vários eventos (soltar, apagar)

## [0.1.3] (2024-05-24)

### Correções
* Localização
* Acrescentar o valor da dificuldade no rótulo

### Novidades
* Suporte à v12

## [0.1.2] (2024-05-16)

### Correções
* Exibição da dificuldade nos Talentos Psiônicos
* Barra de rolagem acrescentada à ficha de personagem
* Arrastar e soltar nas fichas de Carreira, Doença, Contato e Espécie
* Estilo retirado das mensagens, à espera de uniformizá-las
* Diversos ajustes de CSS

### Novidades
* Tema Azul
* Modelo de Espécie melhorado: Descrição detalhada, Modificadores (tabela) e Traços (tabela)
* Ao soltar uma Espécie, suas informações são copiadas na ficha
* Duração acrescentada aos Talentos Psiônicos
* Botão nas mensagens para rolar a Duração de um Talento Psiônico
* Dificuldade acrescentada na janela de rolagens
