# Changelog — MGT2

[Français](CHANGELOG.fr.md) · [English](CHANGELOG.en.md) · [Español](CHANGELOG.es.md)

> A interface do sistema em português cobre os elementos genéricos (botões, ajustes, erros).
> O vocabulário Traveller permanece em inglês, chave por chave, como o Foundry resolve.
> Os termos desta página seguem a tradução comunitária do sistema oficial da Mongoose.

---

## [0.2.0]

**A maior versão que este sistema já teve.** A 0.1.x era uma ficha de personagem; a 0.2.0 é um sistema
de jogo. Sete tipos de Ator, dezessete tipos de Item, criação de Viajantes em grupo, combate espacial
e batalhas entre frotas, comércio especulativo e tráfego de escala, viagens e salto, adestramento, a
cadeia de dano completa, trinta e seis regras opcionais e um compêndio de documentação em quatro
idiomas.

### ⚠ Mudanças incompatíveis

* **Exige o Foundry VTT v14** (14.366 no mínimo). Não funciona mais nas v11 a v13.
* **O tipo de Ator `vehicule` desaparece**, substituído por `vehicle`. Nenhuma migração é fornecida:
  nenhum mundo conhecido o usava.
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
* **Baixa**: benefícios, pensão, cotas de nave e um encerramento de grupo em que apenas um Viajante
  pode começar como proprietário de uma nave.
* **Vinte e duas regras opcionais de criação** (mais abaixo), dezesseis delas regras da casa assumidas,
  onde os livros se calam em vez de serem ambíguos.
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

**Trinta e seis regras em seis grupos**, todas desligadas por padrão: *Viajantes* 3, *Criação* 22,
*Combate* 2, *Saúde* 2, *Espaço* 5, *Naves e robôs* 2. Um único menu nos ajustes do mundo.

Três formas: um interruptor, uma seleção múltipla (um conjunto) e uma escolha de procedimento —
porque um booleano não consegue dizer *qual procedimento impresso está em vigor* quando dois capítulos
não são a negação um do outro. Dezesseis linhas não citam livro e exibem *regra da casa*: uma regra da
casa existe exatamente onde os livros se calam.

Mudar um interruptor reprepara e redesenha as fichas abertas; nada pede para recarregar.

### Documentação e idiomas

* **O sistema traz seu primeiro compêndio**: `mgt2.docs`, um diário por idioma, vinte e uma páginas
  cada. Cada página diz duas coisas sobre uma tela — **do que ela cuida por você** e **o que ela deixa
  para você na mesa**. É documentação *sobre o sistema*, nunca texto de regras.
* **Quatro idiomas declarados** — francês, inglês, espanhol e português (Brasil). O francês é o alvo
  do sistema; o espanhol e o português cobrem a interface genérica, com o Foundry recorrendo ao inglês
  chave por chave.

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
* **Seis dos dezessete tipos de Item não podiam ser soltos em nenhuma ficha do sistema**, quatro deles
  dos que compõem uma estrutura
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
