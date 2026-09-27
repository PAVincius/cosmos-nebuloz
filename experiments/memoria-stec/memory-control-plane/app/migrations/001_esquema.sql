-- Memory Control Plane (laboratório STEC) — esquema do sistema de registro.
--
-- O Postgres é a fonte de verdade da memória. Qdrant, Neo4j e MinIO são
-- projeções refeitas a partir daqui (registro de decisões, D-12 e D-16).
--
-- Três garantias vivem no banco, não no código da API:
--   1. Isolamento por tenant com RLS forçada, e a API conecta com um papel sem
--      superuser (o contrário do que o ADR-0012 registra no app principal).
--   2. Memória não se reescreve: versão nova fecha a anterior (tempo de
--      transação) e a trigger só deixa mudar o fechamento ou apagar o conteúdo.
--   3. Auditoria só aceita INSERT.
--
-- Idempotente: roda a cada subida do serviço.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS stec;

CREATE TABLE IF NOT EXISTS stec.tenant (
  id        text PRIMARY KEY,
  nome      text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Chave guardada só como hash. O papel da API não lê esta tabela; autentica
-- pela função stec.autenticar, que roda com os direitos do dono.
CREATE TABLE IF NOT EXISTS stec.chave_api (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL REFERENCES stec.tenant(id) ON DELETE CASCADE,
  hash        text NOT NULL UNIQUE,
  rotulo      text NOT NULL,
  papel       text NOT NULL CHECK (papel IN ('leitura', 'escrita', 'admin')),
  criada_em   timestamptz NOT NULL DEFAULT now(),
  revogada_em timestamptz
);

-- Uma linha por versão. memory_id é a identidade estável; version cresce a
-- cada substituição.
--   valid_from / valid_to : quando o fato valeu no mundo (tempo de validade)
--   tx_from / tx_to       : quando o sistema acreditou nesta versão (tempo de
--                           transação). tx_to nulo = versão vigente.
CREATE TABLE IF NOT EXISTS stec.memoria (
  version_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id        uuid NOT NULL,
  version          integer NOT NULL,
  tenant_id        text NOT NULL REFERENCES stec.tenant(id),
  agent_id         text NOT NULL,
  project_id       text,
  kind             text NOT NULL CHECK (kind IN ('episodic', 'semantic', 'procedural')),
  category         text NOT NULL CHECK (category IN ('decision', 'commitment', 'lesson', 'fact', 'preference')),
  text             text NOT NULL,
  entities         jsonb NOT NULL DEFAULT '[]'::jsonb,
  relations        jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from       timestamptz NOT NULL,
  valid_to         timestamptz,
  tx_from          timestamptz NOT NULL DEFAULT clock_timestamp(),
  tx_to            timestamptz,
  source           text NOT NULL,
  source_id        text NOT NULL,
  extracted_by     text NOT NULL,
  -- Escala única da suíte (mapa de fronteiras, entidade 5). Sem nota decimal.
  confidence       text NOT NULL CHECK (confidence IN ('medido', 'estimado', 'declarado')),
  classification   text NOT NULL CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  retention_days   integer NOT NULL CHECK (retention_days > 0),
  pii              boolean NOT NULL DEFAULT false,
  domain           text,
  tags             text[] NOT NULL DEFAULT '{}',
  importance       real NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
  change_reason    text,
  supersedes       uuid REFERENCES stec.memoria(version_id),
  embedding        vector,
  embedding_model  text,
  erased_at        timestamptz,
  erased_reason    text,
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT memoria_versao_unica UNIQUE (memory_id, version),
  CONSTRAINT memoria_validade CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT memoria_transacao CHECK (tx_to IS NULL OR tx_to >= tx_from)
);

CREATE INDEX IF NOT EXISTS memoria_tenant_vigente_idx
  ON stec.memoria (tenant_id, memory_id) WHERE tx_to IS NULL;
CREATE INDEX IF NOT EXISTS memoria_tenant_fonte_idx
  ON stec.memoria (tenant_id, source, source_id);
CREATE INDEX IF NOT EXISTS memoria_fts_idx
  ON stec.memoria USING gin (to_tsvector('portuguese', text));

-- Só INSERT. Nunca guarda o texto da memória: o apagamento tem de apagar tudo.
CREATE TABLE IF NOT EXISTS stec.auditoria (
  id         bigserial PRIMARY KEY,
  tenant_id  text NOT NULL,
  at         timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor      text NOT NULL,
  action     text NOT NULL,
  memory_id  uuid,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS auditoria_tenant_at_idx ON stec.auditoria (tenant_id, at DESC);

-- Projeção que falhou fica aqui até o reconcile refazer a partir do Postgres.
CREATE TABLE IF NOT EXISTS stec.projecao_pendente (
  id         bigserial PRIMARY KEY,
  tenant_id  text NOT NULL,
  memory_id  uuid NOT NULL,
  target     text NOT NULL CHECK (target IN ('qdrant', 'neo4j', 'minio')),
  error      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- ── Imutabilidade ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION stec.proteger_memoria() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v stec.memoria;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Só a purga de tenant (saída do cliente), feita pelo dono do esquema.
    IF current_setting('stec.purga', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'memória não se apaga por DELETE; use o apagamento, que zera o conteúdo';
  END IF;

  -- Apagamento: zera conteúdo, marcadores e vetor, uma vez, com motivo.
  IF OLD.erased_at IS NULL AND NEW.erased_at IS NOT NULL THEN
    IF NEW.text <> '[apagado]' OR NEW.entities <> '[]'::jsonb
       OR NEW.relations <> '[]'::jsonb OR NEW.embedding IS NOT NULL
       OR NEW.tags <> '{}' OR NEW.domain IS NOT NULL OR NEW.erased_reason IS NULL THEN
      RAISE EXCEPTION 'apagamento precisa zerar texto, entidades, relações, marcadores e vetor, com motivo';
    END IF;
    v := NEW;
    v.text := OLD.text; v.entities := OLD.entities; v.relations := OLD.relations;
    v.embedding := OLD.embedding; v.embedding_model := OLD.embedding_model;
    v.tags := OLD.tags; v.domain := OLD.domain;
    v.erased_at := NULL; v.erased_reason := NULL;
    IF v IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'apagamento não pode mudar outros campos';
  END IF;

  -- Fechamento de versão: só tx_to, de nulo para preenchido.
  IF OLD.tx_to IS NULL AND NEW.tx_to IS NOT NULL THEN
    v := NEW;
    v.tx_to := NULL;
    IF v IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Reindexação: troca só vetor e modelo de uma linha não apagada.
  IF OLD.erased_at IS NULL AND NEW.erased_at IS NULL THEN
    v := NEW;
    v.embedding := OLD.embedding;
    v.embedding_model := OLD.embedding_model;
    IF v IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'memória é imutável: crie uma versão nova em vez de editar';
END $$;

DROP TRIGGER IF EXISTS memoria_imutavel ON stec.memoria;
CREATE TRIGGER memoria_imutavel
  BEFORE UPDATE OR DELETE ON stec.memoria
  FOR EACH ROW EXECUTE FUNCTION stec.proteger_memoria();

CREATE OR REPLACE FUNCTION stec.auditoria_so_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auditoria só aceita INSERT';
END $$;

DROP TRIGGER IF EXISTS auditoria_append_only ON stec.auditoria;
CREATE TRIGGER auditoria_append_only
  BEFORE UPDATE OR DELETE ON stec.auditoria
  FOR EACH ROW EXECUTE FUNCTION stec.auditoria_so_insert();

-- ── Isolamento por tenant ───────────────────────────────────────────────────
-- current_setting('app.tenant_id', true) devolve nulo sem configuração, e nulo
-- não casa com nada: conexão sem tenant não enxerga linha nenhuma.

ALTER TABLE stec.memoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE stec.memoria FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memoria_tenant ON stec.memoria;
CREATE POLICY memoria_tenant ON stec.memoria
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE stec.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE stec.auditoria FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auditoria_tenant ON stec.auditoria;
CREATE POLICY auditoria_tenant ON stec.auditoria
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE stec.projecao_pendente ENABLE ROW LEVEL SECURITY;
ALTER TABLE stec.projecao_pendente FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projecao_tenant ON stec.projecao_pendente;
CREATE POLICY projecao_tenant ON stec.projecao_pendente
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── Autenticação ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION stec.autenticar(p_hash text)
RETURNS TABLE (tenant_id text, papel text, rotulo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = stec, pg_temp AS $$
  SELECT c.tenant_id, c.papel, c.rotulo
  FROM stec.chave_api c
  WHERE c.hash = p_hash AND c.revogada_em IS NULL
$$;

-- ── Purga de tenant (saída do cliente) ─────────────────────────────────────
-- Roda só pela CLI de administração, com a conexão do dono. Apaga memória,
-- pendências e chaves. A auditoria fica: registra que a purga aconteceu, e
-- nunca guardou conteúdo.

CREATE OR REPLACE FUNCTION stec.purgar_tenant(p_tenant text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = stec, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  PERFORM set_config('stec.purga', 'on', true);
  PERFORM set_config('app.tenant_id', p_tenant, true);
  DELETE FROM stec.memoria WHERE tenant_id = p_tenant;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM stec.projecao_pendente WHERE tenant_id = p_tenant;
  UPDATE stec.chave_api SET revogada_em = now()
   WHERE tenant_id = p_tenant AND revogada_em IS NULL;
  INSERT INTO stec.auditoria (tenant_id, actor, action, detail)
  VALUES (p_tenant, 'admin', 'tenant.purged', jsonb_build_object('versions', n));
  RETURN n;
END $$;
