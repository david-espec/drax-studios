# Drax Studio

Gravador de tela + editor de vídeo, local-first. Grava, edita e exporta tudo no navegador — os vídeos ficam no dispositivo do usuário (IndexedDB), nada é enviado a servidor.

## Posicionamento

**Problema que resolve**: transforma gravações de tela em vídeos prontos, de forma rápida e simples — não é "mais um editor de vídeo genérico".

**Público-alvo**: criadores de conteúdo, professores e profissionais que precisam gravar a própria tela (tutoriais, aulas, demonstrações de produto/sistema) e sair de "gravei" para "vídeo pronto" com o mínimo de fricção possível.

**Critério para toda nova funcionalidade**: *isso torna mais fácil o usuário sair de uma tela em branco e chegar a um vídeo pronto?* Se a resposta for não, a feature espera. O editor deliberadamente não tenta competir feature-a-feature com CapCut/Premiere — o diferencial é a combinação gravação+edição+organização em um fluxo único, não a profundidade do editor.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) + TypeScript + Tailwind. Gravação via `getDisplayMedia`/`getUserMedia` + `MediaRecorder`. Edição e exportação via `ffmpeg.wasm` (self-hosted em `public/ffmpeg-core`, sem depender de CDN externo). Armazenamento em IndexedDB (`idb`).

## Princípios

- **Local-first**: processamento (gravação, edição, exportação) acontece no dispositivo. Nada é enviado a servidor por padrão.
- **Privacidade**: "seus vídeos são seus" — o usuário controla onde os vídeos ficam e quando são excluídos. Nenhum vídeo sai do dispositivo sem uma ação explícita do usuário (ex: compartilhar).
- **GRAVAR é a ação central**: o fluxo principal é Gravar → Editar → Vídeo Pronto, sem fricção.

## Roadmap

1. **Captura** (feito) — gravação de tela/janela/aba/câmera, áudio processado, qualidade configurável.
2. **Edição** (feito, além do MVP) — timeline, corte/divisão, filtros, overlays, exportação local. Editor manual está congelado em escopo: não adicionar mais ferramentas manuais por padrão (ver "Decisões em aberto" abaixo).
3. **Inteligência** (em andamento):
   - **Corte inteligente por silêncio** (feito) — analisa a trilha de áudio (Web Audio API, RMS por janela) e sugere remoção de trechos silenciosos direto na timeline, com revisão/seleção antes de aplicar.
   - **Melhorar áudio (1 clique)** (próximo) — expor o pipeline de processamento de áudio já existente (ruído/eco/ganho/normalização) como uma única ação, em vez de toggles separados.
   - Depois: legendas automáticas, transcrição. Avaliar se roda local (modelos pequenos via WASM) ou vira o gatilho para processamento em nuvem.
4. **Cloud** (futuro) — "DRAX Cloud" como evolução opt-in (sincronizar entre dispositivos), não como requisito. Não deve enfraquecer o modelo local-first por padrão.

Empacotamento para Desktop (Tauri) e Mobile (Capacitor) reaproveitando esta mesma base web: planejado para depois da Fase 1 web.

## Decisões em aberto (backlog)

- **Escopo do editor manual**: o editor já foi além do MVP original (filtros, overlays, rotação, música, substituição de áudio). Decisão (2026-08-30): não remover o que existe, mas congelar a adição de novas ferramentas manuais — o esforço vai para diferenciais de "inteligência" (corte por silêncio, melhorar áudio) em vez de mais controles manuais.
- **Bloqueio de app / login**: discutido, mas adiado a pedido do usuário (2026-08-29). Duas camadas possíveis, não implementadas ainda:
  - Trava de tela local (PIN/senha/biometria) — não criptografa os dados, só controla acesso à interface.
  - Criptografia real dos vídeos usando a senha como chave — proteção de verdade, mas exige decidir a política de recuperação (frase de recuperação vs. sem recuperação possível) antes de implementar.
  - **Retomar esse assunto quando**: o app ganhar sincronização em nuvem (Cloud), ou quando o volume de usuários/pedidos justificar o investimento em uma politica de recuperação de senha bem definida.
- **Retenção de dados**: hoje os vídeos ficam salvos indefinidamente até exclusão manual. Avaliar adicionar uma política de retenção configurável (ex: excluir automaticamente após X dias) na tela de Configurações.
