-- Concede acesso de equipe ao back-office (tenant "system").
--
-- Ser staff da Nebuloz é ter uma linha em "TenantMember" com tenantId
-- 'system'. O papel decide o que a pessoa pode fazer lá dentro:
--   ADMIN  → lê e escreve
--   MEMBER → somente leitura (o painel mostra o selo e desabilita os botões)
--
-- COMO USAR
--   1. A pessoa cria a própria conta em https://app.nebuloz.ai/sign-up
--      (ou no ambiente correspondente). Ela escolhe a própria senha — este
--      script não cria conta e não toca em senha, de propósito. Ver abaixo.
--   2. Troque o e-mail e o papel no bloco de parâmetros.
--   3. Rode no SQL editor do banco do ambiente certo — confira duas vezes se é
--      produção ou dev antes de apertar.
--   4. A pessoa entra em backoffice.nebuloz.ai e cadastra o autenticador em
--      /seguranca. O painel exige segundo fator; sem ele o portão barra.
--
-- POR QUE NÃO CRIA CONTA
--   Criar a linha de "User" aqui obrigaria a gravar uma senha que alguém além
--   do dono conheceria — e uma senha que passou por terceiro não é mais dela.
--   Pior: `grant-admin-vinicius-dev.sql`, o script que serviu de precedente
--   para este, tem a senha em texto puro num comentário versionado no Git.
--   Este exige que a conta já exista e para com erro se não existir.
--
-- NÃO APAGA NADA. Rodar de novo é seguro: só cria ou promove a linha.

DO $$
DECLARE
  -- ── parâmetros ──────────────────────────────────────────────────────────
  p_email text := 'willian.m.marchi@gmail.com';
  p_papel text := 'ADMIN';
  -- ────────────────────────────────────────────────────────────────────────
  v_user_id   text;
  v_nome      text;
  v_papel_ant text;
BEGIN
  SELECT id, name INTO v_user_id, v_nome FROM "User" WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'Não existe conta para %. Peça para a pessoa se cadastrar primeiro em /sign-up e rode de novo — este script concede papel, não cria conta.',
      p_email;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Tenant" WHERE id = 'system') THEN
    RAISE EXCEPTION
      'O tenant "system" não existe neste banco. Você está no ambiente certo?';
  END IF;

  SELECT role::text INTO v_papel_ant
  FROM "TenantMember" WHERE "tenantId" = 'system' AND "userId" = v_user_id;

  INSERT INTO "TenantMember" (id, "tenantId", "userId", role, "createdAt")
  VALUES (gen_random_uuid()::text, 'system', v_user_id, p_papel::"MemberRole", now())
  ON CONFLICT ("tenantId", "userId")
  DO UPDATE SET role = EXCLUDED.role;

  IF v_papel_ant IS NULL THEN
    RAISE NOTICE 'Concedido: % (%) agora é % da equipe.', p_email, v_user_id, p_papel;
  ELSIF v_papel_ant = p_papel THEN
    RAISE NOTICE 'Sem mudança: % já era %.', p_email, p_papel;
  ELSE
    RAISE NOTICE 'Alterado: % passou de % para %.', p_email, v_papel_ant, p_papel;
  END IF;
END $$;

-- Conferência — quem tem acesso ao back-office depois de rodar:
SELECT u.email, u.name, m.role, m."createdAt", u."twoFactorEnabled"
FROM "TenantMember" m
JOIN "User" u ON u.id = m."userId"
WHERE m."tenantId" = 'system'
ORDER BY m.role, u.email;

-- Para REVOGAR o acesso de alguém (troque o e-mail):
--   DELETE FROM "TenantMember"
--   WHERE "tenantId" = 'system'
--     AND "userId" = (SELECT id FROM "User" WHERE email = 'pessoa@exemplo.com');
--
-- Revogar o papel não encerra a sessão aberta. O cache de sessão do
-- better-auth vale 60s, então o acesso cai no minuto seguinte. Se for caso de
-- conta comprometida e não de desligamento comum, apague também as linhas de
-- "Session" dessa pessoa.
