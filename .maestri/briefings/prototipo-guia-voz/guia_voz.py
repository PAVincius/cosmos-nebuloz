"""Demo local: guia de voz da triagem do eixo Dados (piloto da D-26).

Tudo roda no Mac, sem nuvem:
- fala: `say` com voz pt_BR do macOS
- escuta: ffmpeg gravando o microfone (AVFoundation)
- transcrição: mlx-whisper (modelo small, em português)

Uso:
  .venv/bin/python guia_voz.py            # conversa por voz
  .venv/bin/python guia_voz.py --texto    # mesma triagem digitando (sem microfone)
"""

import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

VOZ = "Luciana"
MODELO = "mlx-community/whisper-small-mlx"
SEGUNDOS_RESPOSTA = 6
MICROFONE = ":0"  # [0] Microfone (MacBook Pro)

# Grafo do piloto: 3 perguntas com opções fechadas. Cada opção lista as
# palavras que, ditas na resposta, a identificam.
PERGUNTAS = [
    {
        "chave": "banco",
        "texto": "Onde ficam hoje os dados que o seu processo usa? Por exemplo: Postgres, SQL Server, Oracle, MongoDB, planilha, data lake ou outro.",
        "opcoes": {
            "relacional": ["postgres", "postgre", "sql server", "oracle", "mysql", "relacional"],
            "documento": ["mongo", "mongodb", "firestore", "documento", "dynamo"],
            "planilha": ["planilha", "excel", "sheets", "google sheets"],
            "lake": ["data lake", "lake", "s3", "bigquery", "snowflake", "databricks"],
        },
    },
    {
        "chave": "tipo",
        "texto": "E que tipo de dado é a maior parte do que está lá: estruturado, como tabelas; semiestruturado, como JSON; ou não estruturado, como textos, PDFs e áudios?",
        "opcoes": {
            "estruturado": ["estruturado", "tabela", "tabelas", "colunas"],
            "semiestruturado": ["semi", "json", "semiestruturado", "semi estruturado", "xml"],
            "nao_estruturado": ["não estruturado", "nao estruturado", "texto", "textos", "pdf", "documentos", "áudio", "audio", "imagem"],
        },
    },
    {
        "chave": "arranjo",
        "texto": "Esses dados ficam num lugar só, centralizado, ou espalhados em vários sistemas?",
        "opcoes": {
            "centralizado": ["centralizado", "um lugar", "um só", "único", "unico"],
            "espalhado": ["espalhado", "vários", "varios", "descentralizado", "cada área", "cada area", "muitos"],
        },
    },
]

# Folhas: regra sobre as respostas -> recomendação (vira passo/entregável condicional da trilha).
FOLHAS = [
    (lambda r: r.get("banco") == "planilha",
     "Sua base principal é planilha. O primeiro passo da trilha é levar as fontes críticas para um banco governado, com dono e catálogo, antes de qualquer piloto de IA."),
    (lambda r: r.get("banco") == "relacional" and r.get("tipo") == "nao_estruturado",
     "Você guarda principalmente texto e documentos num banco relacional. A trilha recomenda complementar com um repositório de documentos e um índice vetorial para busca semântica, mantendo o relacional para o que é tabela."),
    (lambda r: r.get("banco") == "relacional" and r.get("tipo") == "semiestruturado",
     "Muito JSON dentro de banco relacional. A trilha recomenda padronizar o esquema dessas colunas ou mover esse volume para um banco de documentos, e catalogar os campos usados pela IA."),
    (lambda r: r.get("banco") == "documento" and r.get("tipo") == "estruturado",
     "Dado tabular num banco de documentos. A trilha recomenda levar a parte analítica para um relacional ou colunar, onde qualidade e integridade são mais fáceis de medir."),
    (lambda r: r.get("arranjo") == "espalhado",
     "Seus dados estão espalhados. A trilha começa pelo catálogo mínimo: três a cinco fontes críticas, com dono, sensibilidade e uso em IA, antes de integrar."),
    (lambda r: r.get("banco") == "lake",
     "Você já tem um data lake. A trilha foca em qualidade e catálogo dentro dele: medição automática de completude e frescor nas fontes que o piloto vai usar."),
]
PADRAO = "Sua base parece adequada ao tipo de dado. A trilha segue para o catálogo mínimo e a medição de qualidade das fontes do piloto."


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in sem_acento if not unicodedata.combining(c))


def falar(texto: str) -> None:
    print(f"\n🗣  {texto}")
    subprocess.run(["say", "-v", VOZ, texto], check=False)


def ouvir() -> str:
    import mlx_whisper

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "resposta.wav"
        print(f"🎙  gravando {SEGUNDOS_RESPOSTA}s... fale agora")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "avfoundation",
             "-i", MICROFONE, "-t", str(SEGUNDOS_RESPOSTA), "-ac", "1", "-ar", "16000", "-y", str(wav)],
            check=True,
        )
        resultado = mlx_whisper.transcribe(str(wav), path_or_hf_repo=MODELO, language="pt")
    texto = resultado.get("text", "").strip()
    print(f"📝 entendi: {texto!r}")
    return texto


def classificar(resposta: str, opcoes: dict) -> str | None:
    alvo = normalizar(resposta)
    for opcao, palavras in opcoes.items():
        if any(normalizar(p) in alvo for p in palavras):
            return opcao
    return None


def main() -> None:
    modo_texto = "--texto" in sys.argv
    respostas: dict[str, str] = {}
    falar("Oi! Eu sou o guia da trilha de Fundação de Dados. Seu diagnóstico mostrou o eixo Dados na faixa inicial. Vou fazer três perguntas rápidas.")
    for pergunta in PERGUNTAS:
        for tentativa in range(2):
            falar(pergunta["texto"])
            resposta = input("✍️  sua resposta: ") if modo_texto else ouvir()
            opcao = classificar(resposta, pergunta["opcoes"])
            if opcao:
                respostas[pergunta["chave"]] = opcao
                break
            if tentativa == 0:
                falar("Não entendi. Pode repetir com outras palavras?")
        else:
            falar("Tudo bem, vou anotar como outro e a consultora confere depois.")
            respostas[pergunta["chave"]] = "outro"
    print(f"\n📋 respostas estruturadas: {respostas}")
    recomendacao = next((texto for regra, texto in FOLHAS if regra(respostas)), PADRAO)
    falar(recomendacao)
    falar("Essa é uma recomendação. Quem confirma a ativação do passo é a sua consultora.")


if __name__ == "__main__":
    main()
