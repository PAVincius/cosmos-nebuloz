# Decisões provisórias — encarregado e cláusula C8

- **Data:** 2026-09-30
- **Autor:** Compliance / DPO
- **Pedido por:** Morgana, por delegação do CEO ("fechar o Meridian apto sem ação dele").
- **Natureza:** decisões com fundamento, para destravar a publicação do canal do titular e o contrato do primeiro cliente. Não é aconselhamento jurídico; o jurídico revisa junto com o DPA.
- **Atualização, 2026-09-30 (mesmo dia):** o CEO **confirmou** os três fatos F1, F2 e F3 (§1.2), segundo a Morgana; não vi a confirmação original nem documento. **A dispensa do encarregado (§1) deixa de ser provisória e passa a decisão, "confirmada pelo CEO, 2026-09-30".** A **C8 (§2) segue provisória, "a confirmar pelo CEO"**.

## 1. Encarregado: a Nebuloz pode dispensar a indicação?

**Resposta: sim, se três fatos sobre a empresa forem verdadeiros.** Eles não constam de nenhum documento do repositório; o CEO os **confirmou em 2026-09-30** (§1.3). A análise abaixo foi escrita antes da confirmação e está mantida como fundamento.

### 1.1 Fundamento (texto literal da Resolução)

Fonte: Resolução CD/ANPD nº 2, de 27 de janeiro de 2022, texto consolidado com a Resolução CD/ANPD nº 15/2024, em gov.br/anpd (regulamentações), lido em 2026-09-30. O site avisa que o texto não substitui a publicação no DOU.

- **Art. 2º, I:** agentes de tratamento de pequeno porte são "microempresas, empresas de pequeno porte, startups, pessoas jurídicas de direito privado, inclusive sem fins lucrativos, (…) que realizam tratamento de dados pessoais, assumindo obrigações típicas de controlador ou de operador". Vale, portanto, também para operadora.
- **Art. 2º, II e III:** microempresa e empresa de pequeno porte são as que "se enquadre[m] nos termos do art. 3º e 18-A, § 1º da Lei Complementar nº 123"; startup é a que "atend[e] aos critérios previstos no Capítulo II da Lei Complementar nº 182".
- **Art. 3º:** "Não poderão se beneficiar do tratamento jurídico diferenciado (…) os agentes de tratamento de pequeno porte que: I - realizem tratamento de alto risco para os titulares (…); II - aufiram receita bruta superior ao limite estabelecido no art. 3º, II, da Lei Complementar nº 123, de 2006 ou, no caso de startups, no art. 4º, § 1º, I, da Lei Complementar nº 182, de 2021; ou III - pertençam a grupo econômico de fato ou de direito, cuja receita global ultrapasse os limites referidos no inciso II".
- **Art. 4º:** tratamento de alto risco é o que atende "cumulativamente a pelo menos um critério geral e um critério específico". Gerais: larga escala, ou possibilidade de afetar significativamente interesses e direitos fundamentais. Específicos: tecnologias emergentes ou inovadoras; vigilância de zonas acessíveis ao público; decisões unicamente automatizadas, inclusive de perfil; dados sensíveis ou de crianças, adolescentes e idosos. Larga escala (§ 1º) considera número significativo de titulares, volume de dados, duração, frequência e extensão geográfica.
- **Art. 11:** "Os agentes de tratamento de pequeno porte não são obrigados a indicar o encarregado (…) exigido no art. 41 da LGPD. § 1º O agente (…) que não indicar um encarregado deve disponibilizar um canal de comunicação com o titular de dados para atender o disposto no art. 41, § 2º, I da LGPD. § 2º A indicação de encarregado (…) será considerada política de boas práticas e governança para fins do disposto no art. 52, § 1º, IX da LGPD."

### 1.2 Aplicação à Nebuloz

**Alto risco (art. 4º), hoje: não configurado.** É o teste que eu consigo fazer só com o código.
- Critério específico: "tecnologias emergentes ou inovadoras" provavelmente é atendido (modelos de linguagem em vários pontos do produto). Um critério específico sozinho não basta.
- Critério geral: larga escala não se verifica com um primeiro cliente e algumas dezenas de respondentes (não conheço o número; é hipótese). Afetar significativamente direitos também não: o Meridian pontua a organização, não decide sobre a pessoa.
- Por isso a conta fecha "não alto risco" hoje. **Ela muda** com volume, com a inteligência de reunião (áudio e transcrição de participantes externos, processados por modelo de linguagem) e se evidência livre trouxer dado sensível (o anexo aceita qualquer arquivo até 10 MB, `MeridianEvidence`). São os três gatilhos de reavaliação.

**Os três fatos que só a empresa sabe:**
| # | Fato | Como o CEO ou o contador confirmam |
|---|---|---|
| F1 | A Nebuloz é microempresa, empresa de pequeno porte ou startup, nos termos das LC 123 e 182 (registro na Junta ou Registro Civil; no caso de startup, os critérios do Capítulo II da LC 182) | Cartão CNPJ (porte) e contrato social |
| F2 | A receita bruta do ano anterior está dentro do limite do inciso II do art. 3º da LC 123 (EPP) ou do art. 4º, § 1º, I da LC 182 (startup) | Contador. Não abri as duas leis nesta sessão: os valores dos limites devem ser conferidos no texto delas, não neste documento |
| F3 | Não há grupo econômico de fato ou de direito cuja receita global ultrapasse esse limite (sócio-empresa controladora, holding, coligadas) | Contrato social e quadro societário |

Nenhum desses dados aparece em `memoria-empresa.md` nem em `docs/`; procurei CNPJ, regime, porte e receita.

### 1.3 Decisão — **confirmada pelo CEO em 2026-09-30**

Os fatos F1 a F3 foram confirmados pelo CEO em 2026-09-30 (a Nebuloz é microempresa, empresa de pequeno porte ou startup; a receita bruta anual está dentro do limite; não integra grupo econômico acima do limite). **É declaração do CEO, relatada pela Morgana; nenhum documento foi anexado ao repositório.** Recomendo guardar o cartão CNPJ e a declaração do contador no arquivo societário, fora do repositório, para o caso de o enquadramento ser questionado.

1. **A Nebuloz não indica encarregado**, apoiada no art. 11 da Resolução, com F1, F2 e F3 confirmados e o "não alto risco" acima.
2. **O canal é `privacy@nebuloz.com`** (decisão do CEO, 2026-09-29), que é o que o § 1º do art. 11 exige em lugar do encarregado.
3. **O texto público não cita nome de encarregado nem afirma ser agente de pequeno porte.** Ele só dá o canal. Isso mantém o texto verdadeiro mesmo se o enquadramento mudar. Ver `2026-09-29-texto-publico-canal-do-titular.md`.
4. **Validade:** a decisão vale enquanto F1 a F3 continuarem verdadeiros e não ocorrer um gatilho de reavaliação: mudança de porte ou de grupo econômico; lançamento de reunião a cliente externo; volume que caracterize larga escala; dado sensível recorrente em evidência. Ocorrendo um deles, a Compliance reavalia e, se o art. 3º ou o art. 4º da Resolução deixarem de permitir, **a indicação passa a ser obrigatória** (art. 41 da LGPD). Quem pode ser encarregado, e os cuidados de conflito de interesse, não está decidido aqui; o jurídico avalia.

### 1.4 Ressalvas

- **A dispensa é da indicação, não do canal nem do art. 18.** O pedido do titular continua a ser atendido, e o canal precisa ter dono que o leia (Ordem, pela decisão de 2026-09-29).
- **Risco comercial, hipótese minha, sem dado de venda:** comprador corporativo costuma pedir encarregado nomeado no questionário de segurança e no DPA. Nomear é barato e o art. 11, § 2º trata a indicação como boa prática (conta no art. 52, § 1º, IX). Recomendo nomear assim que o primeiro questionário pedir, mesmo com a dispensa válida.
- **`site-riscos-juridicos.md` §1.1** diz que a indicação é obrigatória e lista nome e e-mail do encarregado como dado que falta. Fica **superado provisoriamente** por esta decisão. A guarda `pnpm legal:guard` falha o build enquanto houver o marcador `[[DADO NECESSÁRIO]]` do encarregado na página; quem publica deve tirá-lo junto com a linha do encarregado. A revisão de advogado do site (`site-riscos-juridicos.md` §1.2) segue **bloqueando a publicação**; esta decisão não a substitui.

## 2. C8 — instrução prévia de eliminação após 10 dias úteis

**Adotada como provisória, marcada "a confirmar pelo CEO".** A recomendação do memo de 2026-09-29 (§4, item 6) vira texto vigente no rascunho, no `dpa-modelo.md` §9.3 e no `dpa-aditivo-provisorio.md` §4.4.

**Fundamento.** A operadora segue instruções do controlador (art. 39 da LGPD); instrução dada de antemão, por escrito, no contrato, é instrução documentada (DPA §3.1). É o único meio de o respondente externo ter pedido atendido "sem depender do cliente" sem a Nebuloz decidir o mérito.

**Prazo.** 10 dias úteis do encaminhamento fecha antes dos 15 dias úteis que a policy promete ao titular. É palpite meu, a validar pelo jurídico.

**Riscos de adotar, e o que os contém:**
- *Cliente contesta uma eliminação que ele não viu:* a cláusula tem ressalva (dado que o Cliente informe ter de reter por obrigação legal ou exercício regular de direitos) e a Nebuloz **avisa o Cliente no encaminhamento e de novo no 8º dia útil**, antes de executar. O playbook do titular ganha esse passo.
- *Eliminação não tem volta:* ela anonimiza nome, e-mail e cargo do respondente e apaga o anexo; preserva `MeridianResponse` e o score, que são do cliente (`lgpd-ropa-e-lacunas.md` §5). O efeito sobre o diagnóstico é mínimo.
- *Cliente recusa a cláusula na negociação:* cai para o comportamento de antes (sem instrução escrita, a Nebuloz não executa). A cláusula é isolada e pode sair sem afetar o resto.

**Condição de revalidação:** o CEO confirma ou rejeita; o jurídico valida o prazo e o texto. Enquanto não houver resposta, o texto fica com a marca "a confirmar pelo CEO" no DPA e no aditivo.

## 3. Prova de que elimina em produção

Roteiro do teste sintético em `2026-09-30-roteiro-teste-sintetico-eliminacao-producao.md`. Escrita em produção precisa do "vai" do CEO ou de delegação escrita dele à Morgana para esta operação. Não presumo a delegação.

## Decisões

- 2026-09-30 — **Decisão, confirmada pelo CEO em 2026-09-30:** dispensa da indicação de encarregado, art. 11 da Resolução CD/ANPD nº 2/2022, com F1, F2 e F3 confirmados; canal `privacy@nebuloz.com`; texto público sem nome de encarregado e sem afirmar o enquadramento. Foi decisão provisória de Compliance/DPO no início do dia; a confirmação dos fatos a tornou definitiva.
- 2026-09-30 — Compliance/DPO (decisão provisória, a confirmar pelo CEO): C8 adotada em DPA §9.3 e aditivo §4.4, com aviso duplo ao Cliente antes de executar.
