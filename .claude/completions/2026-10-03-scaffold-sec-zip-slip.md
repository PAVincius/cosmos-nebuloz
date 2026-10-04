# Scaffold — security maxing: zip-slip no handover (ALTO)

Branch `fix/scaffold-sec-zip-slip`, a partir de github/main e67c1069. Origem: nota "Andaime - checklist", achado alto 2.

`exportHandoverPack` gravava cada artefato no ZIP em `artefatos/<fase>/<nome cru>`. O nome vem do navegador de quem anexou, e o pacote é extraído fora do nosso controle: "../../x" gravava fora da pasta de quem extrai.

- `handover-pack.ts`: o manifesto (`pack.files`) passa a ter o caminho seguro: `safeFileName` (último segmento, sem controle) e dedupe por fase sem diferenciar caixa (`plano.pdf`, `plano (2).pdf`), na mesma ordem em que a action baixa os objetos.
- `export.ts`: cada objeto vai para `pack.files[i].path`, nunca para o nome cru; se o manifesto e os objetos tiverem tamanhos diferentes, falha em vez de desalinhar.
- Defesa em duas camadas: a origem do nome cru (anexo de passo) é fechada na branch `fix/scaffold-sec-anexo-passo`; esta cobre também os registros que já estão no banco.
- Testes: 5 em `handover-pack.test.ts` (`../`, caminho absoluto, barra invertida, nome vazio ou `..`, invariante de 3 segmentos, nomes repetidos) e 2 em `handover-export-zip.test.ts`, que roda a action e confere as entradas do ZIP e a ordem dos downloads. `__tests__/scaffold` 1114 verdes.
