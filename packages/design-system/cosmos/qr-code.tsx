"use client";

import QR from "react-qr-code";

/**
 * QR desenhado **no cliente**, em SVG.
 *
 * Existe para tirar da frente o caminho anterior, que montava a imagem em
 * `api.qrserver.com` passando o `otpauth://` numa query string. Aquela URI
 * carrega a chave compartilhada do segundo fator: mandá-la para um servidor de
 * terceiro a deixa no log de acesso dele, em qualquer proxy do caminho e no
 * histórico do navegador. Quem tem a string gera os mesmos códigos que o
 * celular da pessoa.
 *
 * Aqui o valor não sai da máquina. O segredo já está no cliente — veio na
 * resposta do `enable()` — então desenhá-lo aqui não acrescenta exposição
 * nenhuma; mandá-lo para fora acrescentava toda.
 *
 * SVG, não canvas: escala sem borrar e imprime, que é o caso de quem fotografa
 * o código de outra tela.
 */
export type QrCodeProps = {
  /** O conteúdo do código. Para 2FA, a `otpauth://` inteira. */
  value: string;
  /** Lado, em px. O padrão cabe num cartão sem estourar mobile. */
  size?: number;
  /** Descrição para leitor de tela. O valor **nunca** entra aqui. */
  title?: string;
};

const TAMANHO_PADRAO = 180;

export function QrCode({
  value,
  size = TAMANHO_PADRAO,
  title = "QR code de configuração",
}: QrCodeProps) {
  return (
    <QR
      // `level="M"` tolera ~15% de dano e mantém a matriz pequena o bastante
      // para ler bem em tela. `Q`/`H` só engordariam o código sem ganho aqui:
      // ninguém vai amassar este QR, ele vive numa tela por 30 segundos.
      level="M"
      size={size}
      style={{ height: "auto", maxWidth: "100%", width: size }}
      title={title}
      value={value}
      viewBox={`0 0 ${size} ${size}`}
    />
  );
}
