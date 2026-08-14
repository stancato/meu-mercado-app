# Meu Mercado

PWA para criar listas de mercado, registrar compras e comparar preços ao longo do tempo.

## Desenvolvimento

```powershell
npm install
npm run dev
```

Sem configuração adicional, o app funciona em modo local/offline. Para ativar login Google e sincronização:

1. Crie um projeto no Firebase.
2. Ative Authentication > Google e crie um banco Firestore.
3. Copie `.env.example` para `.env.local` e preencha as credenciais do aplicativo Web.
4. Publique `firestore.rules` antes de disponibilizar o app.

## Dados

Os dados privados são separados por usuário e por domínio:

- `users/{uid}/shoppingList/current`
- `users/{uid}/purchases/{purchaseId}`
- `users/{uid}/products/{productId}`
- `users/{uid}/markets/{marketId}`
- `users/{uid}/app/preferences`

O cache local permite usar a lista sem conexão. No primeiro login, dados existentes no navegador são enviados para a conta quando ela ainda não possui dados na nuvem. Documentos da primeira versão são migrados automaticamente para a estrutura acima.

## Publicação

```powershell
npm run build
firebase deploy --only firestore:rules,hosting
```
