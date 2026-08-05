# Frontend architecture

## Quy Æ°á»›c

- Má»—i khu vá»±c nghiá»‡p vá»¥ cÃ³ file route riÃªng táº¡i `src/app/features/<feature>/<feature>.routes.ts`.
- Routed page chá»‰ giá»¯ shell (header/sidebar); tá»«ng tráº¡ng thÃ¡i route náº±m trong view component riÃªng.
- Logic vÃ  mock data dÃ¹ng chung cá»§a cÃ¡c view náº±m trong `*.base.ts`. Khi ná»‘i API tháº­t, chuyá»ƒn data access sang facade/service theo feature.
- CSS cá»§a page Ä‘Æ°á»£c scope báº±ng root class cá»§a feature Ä‘á»ƒ trÃ¡nh selector nhÆ° `.panel`, `.sidebar`, `.tabs` Ä‘Ã¨ nhau.
- Global style chá»‰ chá»©a token, reset, typography, utility vÃ  theme.
- CÃ¡c feature cÅ© khÃ´ng cÃ²n route Ä‘Æ°á»£c chuyá»ƒn ra khá»i `src/app/features` bá»Ÿi PowerShell wrapper vÃ  váº«n náº±m trong báº£n backup.

## Káº¿t quáº£ refactor

- admin-center: 12 view component
- account-center: 10 view component
- author-suite: 12 view component
- public-site: 12 view component

- Route objects trÆ°á»›c khi dá»n: 57
- Route paths sau khi loáº¡i trÃ¹ng: 51
- Route modules: 5

## Cáº¥u trÃºc chuáº©n

```text
src/app/
â”œâ”€â”€ app.routes.ts
â”œâ”€â”€ features/
â”‚   â””â”€â”€ <feature>/
â”‚       â”œâ”€â”€ <feature>.routes.ts
â”‚       â””â”€â”€ pages/
â”‚           â””â”€â”€ <page>/
â”‚               â”œâ”€â”€ <page>.component.ts       # shell
â”‚               â”œâ”€â”€ <page>.component.html     # shell
â”‚               â”œâ”€â”€ <page>.component.scss    # style Ä‘Ã£ scope
â”‚               â”œâ”€â”€ <page>.base.ts            # state/data dÃ¹ng chung
â”‚               â””â”€â”€ <page>.*-view.component.* # view theo route
â”œâ”€â”€ shared/
â”‚   â””â”€â”€ ui/
â””â”€â”€ styles/
    â”œâ”€â”€ tokens/
    â”œâ”€â”€ base/
    â”œâ”€â”€ components/
    â”œâ”€â”€ utilities/
    â””â”€â”€ themes/
```
