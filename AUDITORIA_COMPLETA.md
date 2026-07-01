# AUDITORIA COMPLETA — SISTEMA CREDVALE

> **Data:** 30/06/2026  
> **Escopo:** Landing page (index.html), cadastro (cadastro.html + cadastro.js), app (app.html), admin (admin.html + admin-panel/admin.js), backend (Node.js/Express)  
> **Equipe simulada:** UX/UI, CRO, Front-end, Back-end, Performance, SEO, Acessibilidade, Segurança, Copywriting  
> **Total de problemas identificados:** ~300

---

## NOTAS GERAIS (0 a 10)

| Categoria | Nota | Status |
|-----------|------|--------|
| **Geral** | **3.5** | Muito abaixo do ideal |
| UX (Experiência do Usuário) | 3.0 | Fluxo quebrado, delays artificiais, sem estado salvo |
| UI (Interface Visual) | 4.5 | Visual moderno mas inconsistente entre páginas |
| Performance | 3.5 | Imagens enormes, sem lazy loading, CSS/JS não minificado |
| SEO | 1.5 | Sem meta desc, OG, schema, sitemap, canonical; React SPA sem SSR |
| Segurança | 2.0 | 10 críticos: JWT hardcoded, auth desabilitada, XSS massivo, CSP off |
| Conversão (CRO) | 2.5 | Formulário de 16 passos, selfie obrigatória, animações de 30s, pagamento falso |
| Responsividade | 4.0 | Travado em 480px, sem adaptação para desktop/tablet |
| Acessibilidade | 2.0 | Zoom bloqueado, sem labels, sem focus trap, sem skip nav, contraste insuficiente |

---

## TOP 10 PROBLEMAS MAIS CRÍTICOS

| # | ID | Problema | Categoria | Impacto |
|---|----|----------|-----------|---------|
| 1 | **SEC001** | JWT secret hardcoded + auth desabilitada em rotas críticas | Segurança | Qualquer pessoa pode forjar tokens, deletar todos os clientes, aprovar pagamentos |
| 2 | **SEC004/005** | CSP desabilitado + XSS massivo via innerHTML sem sanitização | Segurança | Injeção de scripts em dados do usuário; roubo de tokens/admin |
| 3 | **SEC006** | Dados de cartão de crédito enviados sem gateway real; pagamento simulado (Math.random) | Segurança/CRO | Risco legal, dados sensíveis expostos, quebra de confiança |
| 4 | **SEC008** | Rota `POST /api/clients/delete-all` pública sem autenticação | Segurança | Qualquer pessoa pode destruir toda a base de clientes |
| 5 | **CRO011** | Animações artificiais de 27-33s obrigatórias (terminal + análise) | Conversão | Abandono massivo no meio do fluxo |
| 6 | **CRO009/010** | 16 etapas de cadastro + selfie obrigatória | Conversão | Maior gargalo: 50-70% de abandono estimado |
| 7 | **CRO014/015** | "Pagamento" falso: formulário de cartão + Pix que só abrem WhatsApp | Conversão/Segurança | Usuário digita dados sensíveis e nada acontece; fraude potencial |
| 8 | **UX048** | SPA sem skeleton: tela em branco até JS carregar | UX/Performance | Usuário vê nada por segundos em 3G |
| 9 | **SEO009-012** | Zero meta descriptions em todas as páginas | SEO | Google não mostra descrição nos resultados; perda de CTR |
| 10 | **A11Y001/005/007** | Zoom bloqueado, inputs sem labels, modais sem focus trap | Acessibilidade | Viola WCAG, exclui usuários com deficiência, risco legal |

---

## TABELA COMPLETA DE PROBLEMAS

> **Legenda:** P = Prioridade (C=Crítica, A=Alta, M=Média, B=Baixa) | Comp = Complexidade (Alt/Alta, Méd/Média, Bx/Baixa)

### CÓDIGO E ARQUITETURA

| ID | Arquivo | Problema | P | Comp | Solução |
|----|---------|----------|---|------|---------|
| C01 | cadastro.js | 150+ ocorrências de style inline em HTML strings | C | Alt | Extrair para classes CSS |
| C02 | cadastro.js | Funções com 200+ linhas (etapaPlano, etapaPagamento) | A | Méd | Quebrar em funções menores |
| C03 | cadastro.js | Código morto comentado (~5KB) | M | Bx | Remover |
| C04 | cadastro-chat.css | !important em 30+ regras | A | Méd | Refatorar especificidade |
| C05 | admin.js | onclick em HTML strings vaza funções para escopo global | M | Méd | Usar addEventListener |
| C06 | backend/* | try/catch sem tratamento adequado; erros expostos ao cliente | C | Méd | Error handler genérico em produção |
| C07 | backend/servers | CSP desabilitado (helmet CSP: false) | C | Bx | Ativar CSP |
| C08 | backend/routes | authMiddleware comentado em múltiplas rotas | C | Bx | Reativar |
| C09 | backend/database | SHA256 sem salt para senhas | C | Méd | Migrar para bcrypt |
| C10 | admin-panel | Token JWT armazenado em localStorage | C | Alt | Migrar para cookie httpOnly |

### PERFORMANCE

| ID | Arquivo | Problema | P | Comp | Solução |
|----|---------|----------|---|------|---------|
| P01 | assets/ | PNGs de 1MB, 571KB, 543KB sem WebP/AVIF | C | Bx | Converter para WebP (< 200KB cada) |
| P02 | Geral | Nenhuma imagem com loading="lazy" | A | Bx | Adicionar lazy loading |
| P03 | styles.css | CSS 51KB não minificado | A | Bx | Minificar com cssnano |
| P04 | cadastro.js | JS 86KB não minificado | A | Bx | Minificar com terser |
| P05 | index.html | 3 Google Fonts sem display=swap | A | Bx | Adicionar &display=swap |
| P06 | index.html | 6 MutationObservers causando CLS severo | A | Alt | SSR ou espaços reservados |
| P07 | Geral | Nenhum service worker / PWA | M | Méd | Implementar Workbox |
| P08 | cadastro.js | SVG de cartão gerado como string JS enorme | M | Bx | Template pré-compilado |
| P09 | deploy.js | Sem cache headers para assets | M | Bx | Configurar Cache-Control |
| P10 | assets/WHATS.png | Ícone WhatsApp 121KB (poderia ser SVG <1KB) | M | Bx | Substituir por SVG |

### SEO

| ID | Página | Problema | P | Comp | Solução |
|----|--------|----------|---|------|---------|
| SEO01 | index.html | Title "Vale Saúde Card" inconsistente com marca "CREDVALE" | A | Bx | Unificar para "CREDVALE" |
| SEO02 | Todas | NENHUMA meta description | C | Bx | Adicionar descriptions únicas |
| SEO03 | Todas | NENHUM Open Graph / Twitter Card | C | Méd | Adicionar OG e Twitter tags |
| SEO04 | Todas | NENHUM schema.org JSON-LD | C | Méd | Adicionar Organization + WebSite |
| SEO05 | /robots.txt | NÃO EXISTE | A | Bx | Criar robots.txt |
| SEO06 | /sitemap.xml | NÃO EXISTE | C | Bx | Criar sitemap.xml |
| SEO07 | Todas | NENHUMA tag canonical | C | Bx | Adicionar canonical |
| SEO08 | ativacao,escolha,pagamento,parabens | 4 páginas com conteúdo duplicado idêntico | C | Bx | Remover ou redirect 301 |
| SEO09 | index.html | SPA sem fallback de conteúdo: <div id="root"> vazia sem JS | C | Alt | SSR ou <noscript> fallback |
| SEO10 | admin.html | Credenciais admin hardcoded no HTML | C | Crt | Remover do HTML |
| SEO11 | cadastro.html | NENHUM H1 na página | C | Bx | Adicionar h1.sr-only |
| SEO12 | app.html | user-scalable=no (penalidade mobile SEO) | A | Bx | Remover |

### SEGURANÇA

| ID | Arquivo | Problema | P | Comp | Solução |
|----|---------|----------|---|------|---------|
| S01 | auth.js | JWT_SECRET com fallback hardcoded 'vale-saude-secret' | C | Bx | Remover fallback; usar env var |
| S02 | clients.js | authMiddleware desabilitado; rotas públicas | C | Bx | Reativar em delete-all, PATCH |
| S03 | database.js | admin123 hardcoded, SHA256 sem salt | C | Méd | bcrypt + senha aleatória |
| S04 | server.js | CSP: false + CORS com '*' + credentials | C | Méd | CSP rigoroso + origens explícitas |
| S05 | cadastro.js,app.html,admin.js | XSS: innerHTML com dados não sanitizados (centenas de ocorrências) | C | Alt | Usar textContent ou escHtml() |
| S06 | payments.js | Dados de cartão em texto puro; Math.random() simula pagamento | C | Alt | Gateway real + tokenização |
| S07 | clients.js | POST /api/clients/delete-all sem auth | C | Bx | Adicionar authMiddleware |
| S08 | server.js | Erros internos expostos (err.message na resposta) | C | Bx | Error handler genérico |
| S09 | admin.js | JWT em localStorage | C | Alt | Cookie httpOnly + Secure |
| S10 | clients.js | Validação de CPF só verifica length !== 11 | A | Bx | Implementar dígitos verificadores |

### UX/UI

| ID | Onde | Problema | P | Comp | Solução |
|----|------|----------|---|------|---------|
| UX01 | index.html | Layout Shift severo: 6 scripts injetam conteúdo no DOM pós-load | C | Alt | SSR ou espaços reservados com min-height |
| UX02 | cadastro.html | Header, main, footer com display:none (tela 100% dependente de JS) | C | Alt | Conteúdo estático funcional |
| UX03 | Todas | Stack de tecnologia diferente entre páginas (React SPA vs Vanilla JS) | C | Alt | Unificar stack |
| UX04 | cadastro.js | 150+ style inline — viola separation of concerns | C | Alt | Classes CSS |
| UX05 | styles.css | Variável --radius-xxl usada mas não definida | M | Bx | Corrigir para --radius-2xl |
| UX06 | app.html | Modal de CPF aparece só após setTimeout 400ms | A | Bx | Mostrar imediatamente |
| UX07 | index.html | Popup promocional automático aos 700ms sem consentimento | C | Méd | Mostrar só após interação |
| UX08 | Todas | Botões com altura < 44px (padrão WCAG) | A | Méd | min-height: 44px |
| UX09 | cadastro.js | Formulário de cartão sem validação inline (Luhn, CVV, validade) | C | Méd | Validar em tempo real |
| UX10 | admin.html | Credenciais pré-preenchidas no login | C | Bx | Remover valores default |

### CRO / COPY / FUNIL

| ID | Onde | Problema | P | Comp | Solução |
|----|------|----------|---|------|---------|
| CR01 | index.html | Hero sem gancho emocional; não aborda a dor do usuário | A | Méd | Testar headline focada na dificuldade de comprar remédios |
| CR02 | index.html | CTA "Solicitar meu cartão" é genérico e passivo | A | Bx | "QUERO MEU CARTÃO GRÁTIS" |
| CR03 | index.html | Zero prova social acima da dobra | A | Méd | Adicionar depoimentos + selos |
| CR04 | index.html | Objeções (SPC, renda, anuidade) não são endereçadas prominentemente | A | Bx | Badge fixo "Sem consulta SPC • Sem comprovação • Anuidade Zero" |
| CR05 | cadastro.js | 16 etapas de cadastro — gargalo enorme | C | Alt | Reduzir para 4-5 etapas |
| CR06 | cadastro.js | Selfie obrigatória — maior causa de abandono (50-70%) | C | Méd | Mover para pós-pagamento |
| CR07 | cadastro.js | Terminal popup de 15s + análise de 12-18s = 27-33s de animações artificiais | C | Méd | Eliminar terminal; reduzir análise para 5s |
| CR08 | cadastro.js | Pagamento falso: formulário de cartão + Pix só abrem WhatsApp | C | Alt | Gateway real + webhook de confirmação |
| CR09 | cadastro.js | Sem botão "Voltar" em nenhuma etapa | A | Bx | Adicionar navegação bidirecional |
| CR10 | cadastro.js | Confirmação WhatsApp perguntada 2x | M | Bx | Manter confirmação única |

### RESPONSIVIDADE

| ID | Breakpoint | Problema | P | Comp | Solução |
|----|-----------|----------|---|------|---------|
| R01 | 768-1920px | Layout travado em max-width: 480px | C | Alt | Layout responsivo verdadeiro |
| R02 | 320px | Cartão virtual 300px causa overflow (só 280px disponíveis) | A | Bx | width: 100%; max-width: 300px |
| R03 | 320-390px | 10 dots de progresso não cabem horizontalmente | M | Bx | Esconder labels < 420px |
| R04 | Mobile | Touch targets < 44px na navegação | A | Méd | Aumentar padding para 10px 12px |
| R05 | Todos | Nenhuma imagem com srcset/picture | M | Méd | Adicionar srcset 1x/2x/3x |
| R06 | 320-480px | Navegação sem hamburger menu | M | Méd | Implementar drawer lateral |
| R07 | 320-768px | Admin panel sem responsividade real | A | Alt | Breakpoints para grid e tabelas |

### ACESSIBILIDADE

| ID | Elemento | Problema | P | Comp | Solução |
|----|----------|----------|---|------|---------|
| A01 | cadastro.html, app.html | user-scalable=no — zoom bloqueado (WCAG 1.4.4) | C | Bx | Remover |
| A02 | Geral | Inputs sem label (só placeholder) (WCAG 1.3.1, 3.3.2) | C | Méd | <label> com .sr-only |
| A03 | Modais | Sem role="dialog", aria-modal, focus trap (WCAG 2.4.3, 4.1.2) | C | Méd | Implementar focus trap completo |
| A04 | Geral | Sem skip navigation link (WCAG 2.4.1) | A | Bx | Adicionar skip-link |
| A05 | index.html | SPA sem landmarks semânticos (header, nav, main) (WCAG 1.3.1) | A | Méd | Envolver com elementos semânticos |
| A06 | Vários | Contraste insuficiente (#6b7a8f, rgba branco 0.35) (WCAG 1.4.3) | A | Bx | Clarear cores para 4.5:1 |
| A07 | Vários | Sem aria-live para conteúdo dinâmico (WCAG 4.1.3) | A | Bx | Adicionar role="alert"/aria-live |
| A08 | Vários | Botões sem :focus-visible (WCAG 2.4.7) | A | Bx | Adicionar outline no foco |
| A09 | Vários | Font-size < 16px em inputs causa zoom iOS (WCAG 1.4.4) | A | Bx | Mínimo 16px em inputs |
| A10 | cadastro.js | div/span com onClick sem role="button" ou suporte teclado (WCAG 2.1.1) | C | Méd | tabindex + role + keydown |

---

## PLANO DE AÇÃO PRIORIZADO

### FASE 1 — CRÍTICO (executar imediatamente, dias 1-3)

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 1 | **Remover credenciais hardcoded** do admin.html (admin123) e banco de seed | 30min | Segurança |
| 2 | **Remover fallback JWT_SECRET** do código; usar variável de ambiente Railway | 15min | Segurança |
| 3 | **Reativar authMiddleware** em rotas críticas (delete-all, PATCH payments, alterar status) | 30min | Segurança |
| 4 | **Desativar rota de cartão de crédito** (ou integrar gateway real) — remover formulário | 1h | Segurança/CRO |
| 5 | **Remover user-scalable=no** de cadastro.html e app.html | 5min | A11Y/SEO |
| 6 | **Remover páginas duplicadas** (ativacao, escolha, pagamento, parabens) | 15min | SEO |
| 7 | **Adicionar meta descriptions** em index.html, cadastro.html, app.html | 30min | SEO |
| 8 | **Adicionar meta robots noindex** no admin.html | 5min | SEO |

### FASE 2 — ALTA PRIORIDADE (dias 4-7)

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 9 | **Criar CSP** e corrigir sanitização XSS (innerHTML → textContent/escHtml) | 4h | Segurança |
| 10 | **Eliminar animações artificiais** (terminal popup + análise popup) | 3h | CRO |
| 11 | **Adicionar skeleton loading** no index.html (SPA) e app.html | 4h | UX/Performance |
| 12 | **Converter imagens PNG para WebP** (assets/) | 2h | Performance |
| 13 | **Adicionar lazy loading** em todas as imagens | 1h | Performance |
| 14 | **Adicionar labels .sr-only** em inputs do chat e modal CPF | 2h | A11Y |
| 15 | **Adicionar focus trap** nos modais (CPF, chat, pagamento, popup) | 4h | A11Y |
| 16 | **Adicionar Open Graph + Twitter Cards** em todas as páginas | 1h | SEO |
| 17 | **Adicionar tags canonical** em todas as páginas | 30min | SEO |
| 18 | **Criar robots.txt + sitemap.xml** | 30min | SEO |

### FASE 3 — MÉDIA PRIORIDADE (dias 8-14)

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 19 | **Reduzir cadastro de 16 para 5 etapas** (mover selfie/docs para pós-pagamento) | 8h | CRO |
| 20 | **Migrar JWT para cookie httpOnly** | 4h | Segurança |
| 21 | **Migrar SHA256 para bcrypt** no hash de senhas | 2h | Segurança |
| 22 | **Implementar rate limiting** (login, consulta CPF, criação cliente) | 2h | Segurança |
| 23 | **Minificar CSS/JS** no build/deploy | 2h | Performance |
| 24 | **Adicionar display=swap** nas Google Fonts | 15min | Performance |
| 25 | **Adicionar skip-nav link** em todas as páginas | 30min | A11Y |
| 26 | **Refatorar !important** do CSS (30+ ocorrências) | 4h | Código |
| 27 | **Adicionar srcset** nas imagens do carrossel | 2h | Performance |
| 28 | **Adicionar aria-live** em regiões dinâmicas (erros, progresso, toasts) | 2h | A11Y |
| 29 | **Criar service worker** com Workbox para cache de assets | 4h | Performance |
| 30 | **Adicionar botão Voltar** no fluxo de cadastro | 3h | UX/CRO |

### FASE 4 — BAIXA PRIORIDADE/MELHORIAS CONTÍNUAS (dias 15+)

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 31 | Unificar stack (React ou Vanilla, não ambos) | 40h+ | Arquitetura |
| 32 | Design system unificado com variáveis CSS | 16h | UI/Manutenção |
| 33 | Layout responsivo verdadeiro (remover max-width: 480px fixo) | 16h | Responsividade |
| 34 | Implementar SSR ou pré-renderização para SEO | 24h+ | SEO/Performance |
| 35 | Validação de CPF com dígitos verificadores no backend | 1h | Segurança |
| 36 | Implementar pagamento real com gateway (Pix + cartão) | 40h+ | CRO/Negócio |
| 37 | Adicionar prova social, depoimentos, selos de confiança | 4h | CRO |
| 38 | Testes A/B de headline, CTA, cores | Contínuo | CRO |

---

## RESUMO EXECUTIVO

O sistema CREDVALE possui uma base visual moderna com glassmorphism e gradientes, mas sofre de problemas críticos em **segurança** (10 falhas críticas), **conversão** (fluxo de 16 etapas com animações artificiais de 30s e pagamento falso), **SEO** (páginas invisíveis para mecanismos de busca) e **acessibilidade** (violações WCAG que excluem usuários).

**Pontos fortes:**
- Identidade visual consistente (cores, fontes, glassmorphism)
- Chat interativo bem implementado tecnicamente
- Boa separação front-end/back-end
- Backend com sql.js e queries parametrizadas (sem SQL injection)

**Pontos fracos críticos:**
- **Segurança:** Sistema aberto para ataques (auth desabilitada, XSS massivo, CSP off)
- **Conversão:** Fluxo de cadastro inviável (16 etapas, selfie, 30s de loading falso, pagamento simulado)
- **SEO:** Zero meta tags, sem sitemap, sem schema, SPA sem SSR
- **Acessibilidade:** Zoom bloqueado, inputs sem label, modais sem focus trap
- **Performance:** Imagens de >1MB, CSS/JS não minificado, sem lazy loading

**Recomendação:** Executar Fase 1 em 3 dias para eliminar riscos de segurança e violações críticas. Fase 2 em 4 dias para recuperar conversão e performance. Fases 3-4 para consolidação.

---

*Relatório gerado por auditoria automatizada em 30/06/2026.*
