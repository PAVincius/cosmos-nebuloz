// Recarrega a página. Em módulo próprio para o teste do componente do cliente
// poder trocá-lo: o `location.reload` do jsdom não existe.
export const reloadPage = (): void => {
  window.location.reload();
};
