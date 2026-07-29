export interface HelpItem {
  icon: string;
  title: string;
  description: string;
}

export interface HelpContent {
  title: string;
  items: HelpItem[];
}

const helpContent: Record<string, HelpContent> = {
  "/dashboard": {
    title: "Painel",
    items: [
      { icon: "ti-chart-bar", title: "Gráficos de progresso", description: "Mostram sua % de presença em aulas, aulas especiais e questionários respondidos até agora." },
      { icon: "ti-alert-circle", title: "Alertas", description: "Avisa quando há presença pendente ou questionário prestes a fechar." },
      { icon: "ti-file-text", title: "Card do TCC", description: "Aparece após a abertura do período. Mostra se seu TCC está pendente, aguardando aprovação ou aprovado." },
      { icon: "ti-bell", title: "Notificações", description: "O sino no topo mostra avisos e eventos recentes. No PWA você pode ativar alertas no celular." },
    ],
  },
  "/dashboard/avisos": {
    title: "Avisos",
    items: [
      { icon: "ti-message", title: "Comunicados", description: "Mensagens enviadas pelo professor ou coordenação para toda a turma." },
      { icon: "ti-calendar", title: "Data de publicação", description: "Avisos aparecem na data agendada pelo professor." },
    ],
  },
  "/dashboard/presenca": {
    title: "Presença",
    items: [
      { icon: "ti-map-pin", title: "Registro por GPS", description: "Para registrar presença você precisa estar no local da aula. O sistema verifica sua localização automaticamente." },
      { icon: "ti-clock", title: "Janela de registro", description: "O registro fica disponível a partir de 30 minutos antes do início da aula até 2 horas após o término." },
      { icon: "ti-check", title: "Confirmação", description: "Após registrar, um check verde aparece na aula. Você não pode desfazer o registro." },
    ],
  },
  "/dashboard/aulas": {
    title: "Aulas",
    items: [
      { icon: "ti-book", title: "Módulos e aulas", description: "O conteúdo está organizado em módulos. Clique em um módulo para ver as aulas disponíveis." },
      { icon: "ti-video", title: "Vídeo da aula", description: "Algumas aulas possuem vídeo do YouTube disponível para revisão." },
      { icon: "ti-download", title: "Materiais", description: "Arquivos PDF, Word e outros documentos podem ser baixados diretamente." },
      { icon: "ti-circle-check", title: "Progresso", description: "A barra no topo mostra quantas aulas você participou em relação às já realizadas." },
    ],
  },
  "/dashboard/questionarios": {
    title: "Questionários",
    items: [
      { icon: "ti-clock", title: "Prazo", description: "Cada questionário tem uma data de abertura e fechamento. Após o prazo não é possível responder." },
      { icon: "ti-clipboard-list", title: "Respondendo", description: "Selecione sua resposta para cada pergunta e confirme ao final. Não é possível alterar após envio." },
      { icon: "ti-eye", title: "Gabarito", description: "Após responder você pode ver o gabarito clicando em 'Ver gabarito'." },
    ],
  },
  "/dashboard/calendario": {
    title: "Calendário",
    items: [
      { icon: "ti-calendar", title: "Eventos", description: "Mostra todas as aulas, aulas especiais e eventos cadastrados pela coordenação." },
      { icon: "ti-bell", title: "Notificação", description: "Eventos aparecem no sino de notificações no dia em que acontecem." },
    ],
  },
  "/dashboard/livros": {
    title: "Livros",
    items: [
      { icon: "ti-books", title: "Indicações", description: "Lista de livros indicados pela coordenação para aprofundar os temas do curso." },
      { icon: "ti-external-link", title: "Links", description: "Alguns livros possuem link para compra ou download gratuito." },
    ],
  },
  "/dashboard/materiais": {
    title: "Materiais Extras",
    items: [
      { icon: "ti-folder", title: "Recursos de apoio", description: "Materiais complementares disponibilizados pela coordenação: PDFs, apresentações, links e vídeos." },
      { icon: "ti-download", title: "Download", description: "Clique no arquivo para baixá-lo diretamente para o seu dispositivo." },
    ],
  },
  "/dashboard/testemunhos": {
    title: "Testemunhos",
    items: [
      { icon: "ti-heart", title: "Compartilhe", description: "Escreva como o curso impactou sua vida. Seu testemunho passa por aprovação antes de ser publicado." },
      { icon: "ti-users", title: "Comunidade", description: "Leia os testemunhos de outros alunos aprovados pela coordenação." },
    ],
  },
  "/dashboard/avaliacao": {
    title: "Avaliação",
    items: [
      { icon: "ti-star", title: "Avalie o curso", description: "Dê sua nota e deixe um comentário sobre sua experiência. Suas respostas são anônimas." },
    ],
  },
  "/dashboard/tcc": {
    title: "TCC",
    items: [
      { icon: "ti-upload", title: "Envio do trabalho", description: "Faça upload do seu TCC no período definido pelo professor. Formatos aceitos: PDF, Word." },
      { icon: "ti-clock", title: "Prazo", description: "Fique atento à data limite de entrega. Após o prazo o envio é bloqueado." },
      { icon: "ti-check", title: "Aprovação", description: "Após o envio o professor analisa e aprova ou solicita revisão. Você será notificado." },
    ],
  },
  "/dashboard/perfil": {
    title: "Meu Perfil",
    items: [
      { icon: "ti-user", title: "Seus dados", description: "Atualize seu nome e foto de perfil." },
      { icon: "ti-lock", title: "Senha", description: "Altere sua senha a qualquer momento. Use uma senha forte com letras, números e símbolos." },
    ],
  },
  "/professor": {
    title: "Gestão de Conteúdo",
    items: [
      { icon: "ti-book", title: "Módulos e Aulas", description: "Crie e organize os módulos do curso. Adicione aulas com datas, horários, arquivos e vídeos." },
      { icon: "ti-clipboard-list", title: "Questionários", description: "Crie quizzes com perguntas de múltipla escolha, defina abertura e prazo de respostas." },
      { icon: "ti-users", title: "Alunos", description: "Convide alunos por e-mail, visualize matrículas e gerencie o acesso à turma." },
      { icon: "ti-user-check", title: "Presença", description: "Configure o local e raio de presença para cada aula." },
      { icon: "ti-school", title: "Turmas", description: "Crie e gerencie turmas. Ative ou desative para controlar o acesso dos alunos." },
      { icon: "ti-award", title: "Certificados", description: "Visualize a elegibilidade de cada aluno e emita certificados para os aprovados." },
      { icon: "ti-message", title: "Avisos", description: "Publique comunicados para a turma. Você pode agendar para uma data futura." },
      { icon: "ti-file-text", title: "TCC", description: "Configure o período de entrega e acompanhe as submissões dos alunos." },
    ],
  },
  "/analytics": {
    title: "Análises",
    items: [
      { icon: "ti-chart-bar", title: "Visão geral", description: "Resumo de presença, questionários e elegibilidade de todos os alunos da turma." },
      { icon: "ti-award", title: "Elegibilidade", description: "Lista quem atingiu os 4 critérios: presença, aulas especiais, questionários e TCC aprovado." },
      { icon: "ti-download", title: "Exportar", description: "Baixe os dados em planilha para análise externa." },
    ],
  },
};

export function getHelpContent(pathname: string): HelpContent | null {
  // Tenta match exato primeiro
  if (helpContent[pathname]) return helpContent[pathname];
  // Tenta match por prefixo (ex: /professor/*)
  const prefix = Object.keys(helpContent).find(k => pathname.startsWith(k) && k !== "/dashboard");
  if (prefix) return helpContent[prefix];
  return null;
}
