export interface ManualSection {
  id: string;
  group: string;
  title: string;
  content: string;
}

export const manualSections: ManualSection[] = [
  {
    id: "modulos",
    group: "Conteúdo",
    title: "Módulos & Aulas",
    content: `Os módulos organizam o conteúdo do curso em blocos temáticos. Cada módulo contém uma ou mais aulas.

Para criar um módulo, basta definir um título e uma descrição. Após criado, você pode adicionar aulas dentro dele.

Cada aula tem título, data, horário de início e término, professor responsável, leitura recomendada e um vídeo do YouTube opcional. Você também pode anexar arquivos como PDFs e apresentações — eles ficam disponíveis para download pelos alunos.

A data e o horário da aula são usados para controlar a janela de registro de presença: o aluno pode registrar a partir de 30 minutos antes do início até 2 horas após o término. Aulas sem horário definido ficam abertas para registro o dia todo.

A ordem das aulas segue a data cadastrada. Você pode editar ou excluir aulas a qualquer momento.`,
  },
  {
    id: "questionarios",
    group: "Conteúdo",
    title: "Questionários",
    content: `Os questionários são avaliações de múltipla escolha disponibilizadas após cada aula. Eles fazem parte dos critérios de formação do aluno.

Ao criar um questionário, você define o título, a aula vinculada (opcional), a data de abertura e a data de fechamento. Fora desse período o questionário não aparece para o aluno.

Após criar o questionário, você adiciona as perguntas uma a uma. Cada pergunta tem um enunciado e quatro alternativas, sendo uma delas a correta.

O aluno pode responder apenas uma vez. Após responder, ele pode visualizar o gabarito. O percentual de questionários respondidos pelo aluno é um dos critérios para emissão do certificado.`,
  },
  {
    id: "livros",
    group: "Conteúdo",
    title: "Livros",
    content: `A seção de livros é um espaço para indicar obras relevantes para os alunos durante o curso.

Você pode adicionar título, autor, descrição e um link externo — seja para compra, para download gratuito ou para visualização online. Os livros ficam disponíveis na aba Livros do portal do aluno.`,
  },
  {
    id: "materiais",
    group: "Conteúdo",
    title: "Materiais Extras",
    content: `Materiais extras são recursos complementares que não estão diretamente vinculados a uma aula específica — artigos, vídeos, apresentações, links e qualquer material de apoio geral do curso.

Você pode fazer upload de arquivos ou adicionar links externos. Os materiais aparecem ordenados conforme a ordem de cadastro, que pode ser ajustada pelo campo de ordenação.`,
  },
  {
    id: "alunos",
    group: "Alunos",
    title: "Alunos",
    content: `Nesta seção você visualiza todos os alunos matriculados nas turmas ativas e pode convidar novos alunos.

Para convidar, basta informar o nome e o e-mail. O sistema envia automaticamente um e-mail com o link para o aluno definir sua senha e acessar o portal.

Você também pode visualizar informações de cada aluno, como turma vinculada e data de ingresso.`,
  },
  {
    id: "presenca",
    group: "Alunos",
    title: "Presença",
    content: `As configurações de presença definem como o registro é feito pelos alunos. O sistema utiliza GPS para verificar se o aluno está no local da aula no momento do registro.

Você define a localização do ponto de presença (latitude e longitude) e o raio em metros — por exemplo, 100 metros. O aluno só consegue registrar presença se estiver dentro desse raio.

A presença em aulas obrigatórias e aulas especiais obrigatórias são critérios separados para emissão do certificado: o aluno precisa de pelo menos 75% nas aulas regulares e 20% nas especiais.`,
  },
  {
    id: "turmas",
    group: "Alunos",
    title: "Turmas",
    content: `As turmas organizam os alunos em grupos por período. Cada turma tem nome, ano, semestre, data de início e data de término.

Uma turma ativa dá acesso ao portal para todos os alunos vinculados a ela. Ao desativar uma turma, os alunos perdem o acesso — e os que atingiram os critérios de formação veem a tela de encerramento com parabéns. Os que não atingiram veem a tela de sem acesso.

Você pode ter múltiplas turmas — uma ativa por vez é o recomendado, mas o sistema suporta mais de uma ativa simultaneamente.`,
  },
  {
    id: "certificados",
    group: "Alunos",
    title: "Certificados",
    content: `A tela de certificados mostra a elegibilidade de cada aluno com base nos quatro critérios de formação: presença em aulas (mínimo 75%), presença em aulas especiais (mínimo 20%), questionários respondidos (mínimo 75%) e TCC aprovado.

Enquanto o curso estiver em andamento, o status aparece como "Em andamento". Após a última data cadastrada (última aula, aula especial ou questionário), o sistema avalia os critérios e exibe "Apto" ou "Não apto".

Para os alunos aptos, você pode emitir e enviar os certificados em lote com um clique. Cada aluno recebe o certificado em PDF por e-mail.`,
  },
  {
    id: "avisos",
    group: "Comunicação",
    title: "Avisos",
    content: `Os avisos são comunicados enviados para todos os alunos da turma. Eles aparecem na aba Avisos do portal e também no sino de notificações.

Você pode criar um aviso com título e texto e publicá-lo imediatamente ou agendá-lo para uma data futura — útil para programar comunicados com antecedência.

O sino de notificações exibe os avisos a partir da data agendada, não da data de criação. Isso permite que você prepare os comunicados antes sem que apareçam para os alunos antes da hora.`,
  },
  {
    id: "eventos",
    group: "Comunicação",
    title: "Eventos",
    content: `Os eventos aparecem no calendário do portal e no sino de notificações dos alunos no dia em que acontecem.

Você pode cadastrar qualquer tipo de evento: aulas especiais, encontros, retiros, datas importantes. Ao criar uma aula no módulo com marcação de evento, ela é automaticamente adicionada ao calendário.

Eventos futuros não aparecem no sino — apenas no dia do evento, para não poluir as notificações com datas distantes.`,
  },
  {
    id: "testemunhos",
    group: "Comunicação",
    title: "Testemunhos",
    content: `Os testemunhos são relatos enviados pelos alunos sobre o impacto do curso em suas vidas. Antes de aparecerem publicamente no portal, passam por aprovação.

Nesta tela você vê todos os testemunhos enviados. Pode aprovar os que devem ser publicados ou recusá-los. Apenas os aprovados ficam visíveis para outros alunos.`,
  },
  {
    id: "tcc",
    group: "Curso",
    title: "TCC",
    content: `O TCC (Trabalho de Conclusão de Curso) é um dos critérios obrigatórios para a formação do aluno. Nesta seção você configura o período de entrega e acompanha as submissões.

Defina a data e horário de abertura (a partir de quando o aluno pode enviar) e a data e horário limite de entrega. Fora desse período o upload fica bloqueado.

Você também pode adicionar orientações para os alunos e disponibilizar um modelo de TCC para download. Após o aluno enviar, você visualiza o arquivo e aprova ou solicita revisão. A aprovação do TCC é necessária para que o aluno seja considerado apto.`,
  },
  {
    id: "avaliacoes",
    group: "Curso",
    title: "Avaliações",
    content: `A seção de avaliações reúne os feedbacks enviados pelos alunos sobre o curso. As respostas são anônimas.

Você pode ver a nota média e ler os comentários individuais. Use essas informações para entender a percepção dos alunos e melhorar as próximas turmas.`,
  },
  {
    id: "importar",
    group: "Curso",
    title: "Importar Dados",
    content: `A importação permite cadastrar aulas, questionários e outros dados em lote a partir de uma planilha Excel, economizando tempo ao configurar uma nova turma.

Baixe o modelo de planilha, preencha com os dados e faça o upload. O sistema mostra uma prévia antes de confirmar a importação, permitindo revisar o que será cadastrado.

Atenção às datas e horários na planilha — use o formato indicado no modelo para evitar erros de importação.`,
  },
];
