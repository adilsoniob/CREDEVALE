# MAPA GERAL DO PROJETO – VALE SAUDE

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Static)                     │
│  index.html │ cadastro.html │ escolha.html │ pagamento  │
│  ativacao.html │ admin.html │ styles.css │ assets/      │
└───────────────────────┬─────────────────────────────────┘
                        │ fetch() API
┌───────────────────────▼─────────────────────────────────┐
│                 BACKEND (Express.js)                     │
│  server.js → routes/ → database.js (sql.js/SQLite)      │
│  auth.js → JWT tokens → middleware/permissions           │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              DATABASE (SQLite via sql.js)                │
│  clients │ users │ products │ plans │ requests │        │
│  payments │ reactivations │ notifications │ logs │       │
│  settings                                                │
└─────────────────────────────────────────────────────────┘
```

## Fluxos

### Fluxo Principal (Cliente)
```
index.html → cadastro.html → (modal processamento) → (aprovação)
    → escolha.html → pagamento.html → (PIX/Cartão) → ativacao.html
```

### Fluxo Administrativo
```
admin.html#login → admin.html#dashboard → clients/requests/payments/products/logs/users/settings
```

### Fluxo de Reativação
```
cadastro.html (CPF existente) → escolha.html → pagamento.html → ativacao.html
```

## Banco de Dados (10 tabelas)

| Tabela | Registros | Descrição |
|--------|-----------|-----------|
| `users` | 3 (seed) | Administradores e operadores |
| `clients` | Dinâmico | Cadastros de clientes |
| `products` | 2 (seed) | Virtual (R$ 4,99) e Físico (R$ 19,99) |
| `plans` | 2 (seed) | Básico (R$ 500) e Premium (R$ 1.500) |
| `requests` | Dinâmico | Solicitações de ativação |
| `payments` | Dinâmico | Pagamentos PIX e cartão |
| `reactivations` | Dinâmico | Solicitações de reativação |
| `notifications` | Dinâmico | Notificações do sistema |
| `logs` | Dinâmico | Auditoria de ações |
| `settings` | Dinâmico | Configurações do sistema |

## APIs (18 endpoints)

### Auth (3)
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Usuário atual
- `POST /api/auth/change-password` — Alterar senha

### Clients (6)
- `POST /api/clients` — Criar cliente (público)
- `GET /api/clients/by-cpf/:cpf` — Buscar por CPF (público)
- `GET /api/clients` — Listar (protegido)
- `GET /api/clients/:id` — Detalhes (protegido)
- `PATCH /api/clients/:id/status` — Atualizar status (protegido)
- `DELETE /api/clients/:id` — Excluir (protegido)

### Products (6)
- `GET /api/products` — Listar produtos (público)
- `GET /api/products/plans` — Listar planos (público)
- `POST /api/products` — Criar produto (protegido)
- `PUT /api/products/:id` — Atualizar produto (protegido)
- `DELETE /api/products/:id` — Excluir produto (protegido)
- `POST /api/products/plans` — Criar plano (protegido)

### Requests (3)
- `POST /api/requests` — Criar solicitação (público)
- `GET /api/requests` — Listar (protegido)
- `PATCH /api/requests/:id/status` — Atualizar status (protegido)

### Payments (4)
- `POST /api/payments/pix` — Criar pagamento PIX (público)
- `POST /api/payments/card` — Criar pagamento cartão (público)
- `GET /api/payments/:id/status` — Status (público)
- `GET /api/payments` — Listar (protegido)

### Admin (8)
- `GET /api/admin/dashboard` — KPIs e métricas
- `GET /api/admin/logs` — Logs de auditoria
- `GET /api/admin/notifications` — Notificações
- `PATCH /api/admin/notifications/:id/read` — Marcar como lida
- `GET /api/admin/users` — Listar usuários (admin)
- `POST /api/admin/users` — Criar usuário (admin)
- `GET /api/admin/settings` — Configurações (admin)
- `PUT /api/admin/settings` — Salvar configurações (admin)

### Webhooks (1)
- `POST /api/webhooks/pushinpay` — Confirmação de pagamento

## Integrações

| Integração | Status | Descrição |
|------------|--------|-----------|
| PushinPay | Webhook pronto | Pagamentos PIX e cartão |
| WhatsApp | Link no footer | Suporte ao cliente |
| ViaCEP | Funcionando | Consulta de CEP automática |
| QR Code API | Placeholder | Geração de QR PIX |

## Páginas

| Página | Arquivo | Status |
|--------|---------|--------|
| Landing Page | `index.html` | ✅ Pronta |
| Cadastro | `cadastro.html` | ✅ Conectado ao backend |
| Escolha do Cartão | `escolha.html` | ✅ Conectado ao backend |
| Pagamento | `pagamento.html` | ✅ Conectado ao backend |
| Ativação | `ativacao.html` | ✅ Conectado ao backend |
| Painel Admin | `admin.html` | ✅ SPA completa com backend |

## Credenciais de Acesso

| E-mail | Senha | Perfil |
|--------|-------|--------|
| admin@valesaude.com.br | admin123 | Administrador |
| operador@valesaude.com.br | admin123 | Operador |
| suporte@valesaude.com.br | admin123 | Suporte |

## Como Rodar

```bash
cd cartao-farmacia-landing/backend
npm install
npm start
# Acesse: http://localhost:3000
# Admin: http://localhost:3000/admin.html
```

## Pendências

1. Integrar PushinPay real (substituir QR placeholder)
2. Implementar envio de e-mail (notificações)
3. Implementar WhatsApp API (mensagens automáticas)
4. Deploy em produção (Railway/EdgeOne)
5. Configurar domínio e SSL
6. Testes automatizados
7. Monitoramento e logs estruturados

## Riscos

- SQLite não escala para múltiplos simultâneos (ok para MVP)
- Senhas com SHA-256 sem salt (trocar por bcrypt em produção)
- QR Code PIX simulado (precisa de gateway real)
- Sem rate limit por usuário (apenas por IP)

## Stack Técnica

- **Frontend:** HTML5, CSS3, Vanilla JS
- **Backend:** Node.js, Express.js
- **Database:** SQLite (sql.js)
- **Auth:** JWT (jsonwebtoken)
- **Security:** Helmet, CORS, Rate Limiting
- **Deploy:** XAMPP (local) / EdgeOne (produção)
