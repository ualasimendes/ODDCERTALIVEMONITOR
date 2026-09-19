# Guidelines do Projeto: OddCerta Live Monitor

Este projeto adota rigorosamente as diretrizes combinadas dos 4 plugins e skills de engenharia e design:

---

## 1. UI/UX Pro Max Skill (`nextlevelbuilder/ui-ux-pro-max-skill`)
- **Grid e Espaçamento Matemático**:
  - Escala estrita de múltiplos de 4px e 8px (4, 8, 12, 16, 24, 32px).
  - Regra de Padding para Botões: o padding horizontal deve ser rigorosamente 2x o padding vertical (ex: `px-4 py-2`, `px-3 py-1.5`).
  - Regra dos Cantos Arredondados Aninhados (*Nested Radius Math*):
    $$\text{Raio Interno} = \text{Raio Externo} - \text{Padding entre eles}$$
    Exemplo: Container `rounded-2xl` (16px) com `p-2.5` (10px) deve conter elementos internos com `rounded-md` ou `rounded-lg` (6px).
- **Acessibilidade e Contraste**:
  - Padrão WCAG AA (mínimo de 4.5:1 para texto de leitura).
  - Sem texto cinza sobre fundos coloridos de baixo contraste.
  - Alvos de toque (touch targets) de no mínimo 44px em dispositivos móveis.
  - Estados claros para todos os componentes: Default, Hover, Active, Focus-Visible e Disabled.
- **Rótulos e Badges**:
  - Rótulos em badges, pills e botões devem ficar sempre em linha única (`whitespace-nowrap`), sem quebra indesejada.

---

## 2. Frontend Design Plugin (`anthropics/claude-code/plugins/frontend-design`)
- **Rejeição do "AI Slop"**:
  - Proibido uso de gradientes genéricos roxo-para-azul ou neon sem propósito.
  - Sem aninhamento excessivo de cards dentro de cards desnecessários; utilize espaços negativos e divisores sutis para separar a hierarquia.
  - Sem sombras brilhantes (*glow*) artificiais ou "hero eyebrows" vazios.
- **Craft & Estética Funcional**:
  - Paleta com tons escuros neutros e frios profundos (`slate-900`, `slate-950`, bordas `slate-800`).
  - Acentos funcionais pontuais e de alto significado:
    - Verde Esmeralda (`emerald-400`/`emerald-500`): Mandante, dados ao vivo, xG positivo e status ativo.
    - Azul Céu (`sky-400`/`sky-500`): Visitante e métricas complementares.
    - Âmbar (`amber-400`): Partidas HOT e chances claras.
    - Rosa/Vermelho (`rose-400`): Partidas MEGA HOT e cartões vermelhos.
- **Tipografia Escalar**:
  - Fontes nítidas com números tabulares alinhados para estatísticas esportivas.
  - Hierarquia clara e previsível: H1 -> H2 -> H3 -> Labels -> Captions.

---

## 3. Humanizer Skill (`blader/humanizer`)
- **Linguagem Natural e Clara em Português Brasileiro**:
  - Eliminação de jargões robóticos, prolixidade ou clichês corporativos vazios.
  - Terminologia autêntica de analistas de futebol e operadores esportivos:
    - *"Ao vivo"* (em vez de *"Transmissão em execução"*).
    - *"Mandante"* e *"Visitante"* (ou *"Casa"* e *"Fora"*).
    - *"Pressão recente"* (em vez de *"Índice de aceleração de chutes calculada"*).
    - *"Finalizações no alvo"*, *"Dentro da área"*, *"Chances claras"*.
    - *"Odd de referência"*, *"Linha Over"*.
- **Microcopy Direta e Sem Ruído**:
  - Mensagens de erro objetivas com ação clara de resolução.
  - Estados vazios (*empty states*) explicativos que indicam claramente o motivo (ex: *"Nenhum jogo nesta janela no momento"*).

---

## 4. Ponytail Plugin (`dietrichgebert/ponytail`)
- **Princípio do "Desenvolvedor Sênior Preguiçoso" (YAGNI & Simplicidade)**:
  - *"O melhor código é o código que você não precisou escrever."*
  - Evitar abstrações prematuras, camadas intermediárias redundantes e boilerplate excessivo.
  - Eliminar estados duplicados e manter fluxo de dados unidirecional e direto.
  - Reutilização inteligente de componentes e funções utilitárias nativas.
  - Performance focada: memoização seletiva (`useMemo`, `useCallback`), re-renders controlados e zero dependências desnecessárias.
