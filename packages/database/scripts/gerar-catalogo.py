import json, sys

cat = json.load(open("/Users/azos/Downloads/nebuloz-catalogo.json"))

UNIDADE_COBRANCA = {"fixed":"PROJETO","sprint":"SPRINT","hourly":"HORA","retainer":"RETAINER"}
UNIDADE_TEXTO    = {"fixed":"projeto","sprint":"sprint","hourly":"hora","retainer":"mês"}
MODALIDADE       = {"fixed":"PROJETO","sprint":"PROJETO","hourly":"PROJETO","retainer":"RETAINER"}
NOME_PLANO       = {"starter":"Starter","scale":"Scale","enterprise":"Enterprise"}

# Os ids de prazo do JSON (monthly/annual/biennial) NÃO são os slugs do banco.
# O 2026-08-comercial.sql já criou os mesmos três prazos como MENSAL/ANUAL/
# BIENAL, e `Proposal.termoSlug` guarda esse texto — toda proposta feita aponta
# para eles. Gerar os ids do JSON como slug criou três duplicatas na primeira
# carga; o mapa existe para que a chave natural continue sendo a que o
# histórico já usa.
SLUG_PRAZO       = {"monthly":"MENSAL","annual":"ANUAL","biennial":"BIENAL"}

def q(v):
    if v is None: return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def arr(xs):
    if not xs: return "ARRAY[]::text[]"
    return "ARRAY[" + ",".join(q(x) for x in xs) + "]"

L = []
w = L.append

w("-- Catálogo Nebuloz — serviços de consultoria e preços de plataforma.")
w("--")
w(f"-- Gerado de nebuloz-catalogo.json ({cat['$meta']['gerado_em']}) por script, não à mão.")
w("-- Moeda: BRL. Os preços do JSON estão em reais; aqui viram centavos inteiros,")
w("-- porque ponto flutuante em dinheiro acumula erro na soma dos itens da proposta.")
w("--")
w("-- Idempotente: cada bloco é UPSERT pela chave natural (código do serviço, slug")
w("-- do plano/termo/add-on, módulo). Rodar de novo atualiza; não duplica e não apaga.")
w("--")
w("-- Rodar no SQL editor do banco do ambiente certo — confira se é produção.")
w("")
w("BEGIN;")
w("")
w("-- ── Serviços ────────────────────────────────────────────────────────────")
w("INSERT INTO \"Service\" (")
w('  id, "tenantId", codigo, nome, descricao, modalidade, "precoBaseCentavos",')
w('  unidade, ativo, trilha, "unidadeDeCobranca", duracao,')
w('  entregaveis, papeis, "preRequisitos", "moduloVinculado", "exigeLab",')
w('  "criadoEm", "atualizadoEm"')
w(") VALUES")
linhas=[]
for s in cat["servicos"]:
    linhas.append(
      "  (gen_random_uuid()::text, 'system', {cod}, {nome}, {desc}, {mod}, {preco},\n"
      "   {un}, {ativo}, {trilha}, {unc}, {dur},\n"
      "   {ent}, {pap}, {pre}, {vinc}, {lab}, now(), now())".format(
        cod=q(s["id"]), nome=q(s["nome"]), desc=q(s["descricao"]),
        mod=q(MODALIDADE[s["unidade"]]), preco=s["preco"]*100,
        un=q(UNIDADE_TEXTO[s["unidade"]]), ativo=str(s["ativo"]).lower(),
        trilha=q(s["trilha"]), unc=q(UNIDADE_COBRANCA[s["unidade"]]),
        dur=q(s["duracao"]), ent=arr(s["entregaveis"]), pap=arr(s["papeis"]),
        pre=arr(s["pre_requisitos"]),
        vinc=(q(s["produto_anexo"])+'::"ProductModule"' if s["produto_anexo"] else "NULL"),
        lab=str(s["usa_lab"]).lower()))
w(",\n".join(linhas))
w('ON CONFLICT ("tenantId", codigo) DO UPDATE SET')
w("  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,")
w('  modalidade = EXCLUDED.modalidade, "precoBaseCentavos" = EXCLUDED."precoBaseCentavos",')
w("  unidade = EXCLUDED.unidade, ativo = EXCLUDED.ativo, trilha = EXCLUDED.trilha,")
w('  "unidadeDeCobranca" = EXCLUDED."unidadeDeCobranca", duracao = EXCLUDED.duracao,')
w('  entregaveis = EXCLUDED.entregaveis, papeis = EXCLUDED.papeis,')
w('  "preRequisitos" = EXCLUDED."preRequisitos", "moduloVinculado" = EXCLUDED."moduloVinculado",')
w('  "exigeLab" = EXCLUDED."exigeLab", "atualizadoEm" = now();')
w("")

w("-- ── Planos de plataforma ────────────────────────────────────────────────")
w('INSERT INTO "PlanoComercial" (')
w('  id, "tenantId", slug, nome, ordem, "precoAssentoCentavos", "minimoAssentos",')
w('  ativo, "criadoEm", "atualizadoEm"')
w(") VALUES")
linhas=[]
for i,p in enumerate(cat["plataforma"]["planos"]):
    linhas.append("  (gen_random_uuid()::text, 'system', {slug}, {nome}, {ordem}, {preco}, {minimo}, true, now(), now())".format(
        slug=q(p["id"]), nome=q(NOME_PLANO.get(p["id"], p["id"].title())), ordem=i,
        preco=p["preco_por_assento_mes"]*100, minimo=p["minimo_assentos"]))
w(",\n".join(linhas))
w('ON CONFLICT ("tenantId", slug) DO UPDATE SET')
w('  nome = EXCLUDED.nome, ordem = EXCLUDED.ordem,')
w('  "precoAssentoCentavos" = EXCLUDED."precoAssentoCentavos",')
w('  "minimoAssentos" = EXCLUDED."minimoAssentos", ativo = true, "atualizadoEm" = now();')
w("")

w("-- ── Preço mensal por módulo ─────────────────────────────────────────────")
w('INSERT INTO "PrecoDeModulo" (id, "tenantId", modulo, "precoMensalCentavos", "atualizadoEm")')
w("VALUES")
linhas=[]
for m,v in cat["plataforma"]["modulos_adicionais_mes"].items():
    linhas.append(f"  (gen_random_uuid()::text, 'system', {q(m)}::\"ProductModule\", {v*100}, now())")
w(",\n".join(linhas))
w('ON CONFLICT ("tenantId", modulo) DO UPDATE SET')
w('  "precoMensalCentavos" = EXCLUDED."precoMensalCentavos", "atualizadoEm" = now();')
w("")

w("-- ── Termos de contrato ──────────────────────────────────────────────────")
w('INSERT INTO "TermoDeContrato" (id, "tenantId", slug, nome, meses, "descontoPercent", ordem)')
w("VALUES")
linhas=[]
for i,t in enumerate(cat["plataforma"]["prazos"]):
    linhas.append("  (gen_random_uuid()::text, 'system', {slug}, {nome}, {meses}, {desc}, {ordem})".format(
        slug=q(SLUG_PRAZO.get(t["id"], t["id"])), nome=q(t["nome"]), meses=t["meses"],
        desc=round(t["desconto"]*100), ordem=i))
w(",\n".join(linhas))
w('ON CONFLICT ("tenantId", slug) DO UPDATE SET')
w('  nome = EXCLUDED.nome, meses = EXCLUDED.meses,')
w('  "descontoPercent" = EXCLUDED."descontoPercent", ordem = EXCLUDED.ordem;')
w("")

w("-- ── Add-ons ─────────────────────────────────────────────────────────────")
w('-- `recorrente` vem da nota do catálogo: o onboarding é one-time, o resto é')
w("-- mensal. É essa coluna que decide se o item entra na mensalidade da")
w("-- proposta ou uma vez só (ver lib/comercial/precificar).")
w('INSERT INTO "AddOnComercial" (')
w('  id, "tenantId", slug, nome, nota, "precoCentavos", recorrente, ativo, ordem')
w(") VALUES")
linhas=[]
for i,a in enumerate(cat["plataforma"]["addons"]):
    recorrente = "one-time" not in (a.get("nota") or "").lower()
    linhas.append("  (gen_random_uuid()::text, 'system', {slug}, {nome}, {nota}, {preco}, {rec}, true, {ordem})".format(
        slug=q(a["id"]), nome=q(a["nome"]), nota=q(a.get("nota")),
        preco=a["preco"]*100, rec=str(recorrente).lower(), ordem=i))
w(",\n".join(linhas))
w('ON CONFLICT ("tenantId", slug) DO UPDATE SET')
w('  nome = EXCLUDED.nome, nota = EXCLUDED.nota,')
w('  "precoCentavos" = EXCLUDED."precoCentavos", recorrente = EXCLUDED.recorrente,')
w("  ativo = true, ordem = EXCLUDED.ordem;")
w("")
w("COMMIT;")
w("")
w("-- ── Conferência ─────────────────────────────────────────────────────────")
w("SELECT 'servicos' AS tabela, count(*) FROM \"Service\" WHERE \"tenantId\" = 'system'")
w("UNION ALL SELECT 'planos', count(*) FROM \"PlanoComercial\" WHERE \"tenantId\" = 'system'")
w("UNION ALL SELECT 'modulos', count(*) FROM \"PrecoDeModulo\" WHERE \"tenantId\" = 'system'")
w("UNION ALL SELECT 'termos', count(*) FROM \"TermoDeContrato\" WHERE \"tenantId\" = 'system'")
w("UNION ALL SELECT 'addons', count(*) FROM \"AddOnComercial\" WHERE \"tenantId\" = 'system';")
w("")
w("-- Módulos da plataforma que ficaram SEM preço — o gerador de proposta trata")
w("-- ausência como zero (proposta-escopo.ts: `?.precoMensalCentavos ?? 0`), então")
w("-- um módulo listado aqui é vendável de graça sem ninguém perceber.")
w("SELECT unnest(enum_range(NULL::\"ProductModule\"))::text AS modulo_sem_preco")
w("EXCEPT")
w("SELECT modulo::text FROM \"PrecoDeModulo\" WHERE \"tenantId\" = 'system';')".rstrip("')"))

open(sys.argv[1],"w").write("\n".join(L) + "\n")
print(f"servicos={len(cat['servicos'])} planos={len(cat['plataforma']['planos'])} "
      f"modulos={len(cat['plataforma']['modulos_adicionais_mes'])} "
      f"termos={len(cat['plataforma']['prazos'])} addons={len(cat['plataforma']['addons'])}")
