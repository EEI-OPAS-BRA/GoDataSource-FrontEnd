export const PortuguesePtLang = {
  id: 'portuguese_pt',
  tokens: {
    /**
     * User
     */
    'LNG_USER_FIELD_LABEL_VIEW_MULTIPLE_LOCATIONS': 'Ver vários locais',
    'LNG_USER_FIELD_LABEL_VIEW_MULTIPLE_LOCATIONS_DESCRIPTION': 'Permite que o usuário veja vários locais ao mesmo tempo',

    /**
     * Team notifications
     */
    'LNG_COMMON_BUTTON_MARK_ALL_AS_READ': 'Marcar tudo como lido',
    'LNG_LAYOUT_MENU_ITEM_TEAM_NOTIFICATIONS_LABEL': 'Notificações da equipe',
    'LNG_LAYOUT_MENU_ITEM_TEAM_NOTIFICATIONS_NO_DATA_LABEL': 'Nenhuma notificação',
    'LNG_LAYOUT_MENU_ITEM_NOTIFICATION_SETTINGS_LABEL': 'Configurações de notificações',
    'LNG_DIALOG_CONFIRM_DELETE_TEAM_NOTIFICATION': 'Tem certeza de que deseja excluir a notificação "{{name}}"?',

    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_TEAM': 'Equipe',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_TITLE': 'Título',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_MESSAGE': 'Mensagem',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_SEVERITY': 'Severidade',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_RECURRING': 'Recorrente',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_RECURRENCE_INTERVAL': 'Intervalo de recorrência',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_RECURRENCE_UNIT': 'Unidade de recorrência',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_ACTIVE': 'Ativa',
    'LNG_TEAM_NOTIFICATION_FIELD_LABEL_CREATED_AT': 'Criada em',

    'LNG_TEAM_NOTIFICATION_SEVERITY_GREEN': 'Verde',
    'LNG_TEAM_NOTIFICATION_SEVERITY_YELLOW': 'Amarelo',
    'LNG_TEAM_NOTIFICATION_SEVERITY_RED': 'Vermelho',
    'LNG_TEAM_NOTIFICATION_RECURRENCE_UNIT_HOURS': 'Horas',
    'LNG_TEAM_NOTIFICATION_RECURRENCE_UNIT_DAYS': 'Dias',
    'LNG_TEAM_NOTIFICATION_RECURRENCE_UNIT_WEEKS': 'Semanas',
    'LNG_TEAM_NOTIFICATION_RECURRENCE_UNIT_MONTHS': 'Meses',
    'LNG_TEAM_NOTIFICATION_RECURRENCE_UNIT_YEARS': 'Anos',

    'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_TITLE': 'Notificações da equipe',
    'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_MODIFY': 'Modificar notificação',
    'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_ENABLE_DISABLE': 'Ativar / Desativar',
    'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_TOGGLE_ENABLED_SUCCESS_MESSAGE': 'Notificação atualizada com sucesso',
    'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_DELETE': 'Excluir notificação',
    'LNG_PAGE_LIST_TEAM_NOTIFICATIONS_ACTION_DELETE_SUCCESS_MESSAGE': 'Notificação excluída com sucesso',

    'LNG_PAGE_CREATE_TEAM_NOTIFICATION_TITLE': 'Criar notificação da equipe',
    'LNG_PAGE_CREATE_TEAM_NOTIFICATION_ACTION_CREATE_TEAM_NOTIFICATION_SUCCESS_MESSAGE': 'Notificação criada com sucesso',
    'LNG_PAGE_MODIFY_TEAM_NOTIFICATION_TITLE': 'Modificar notificação da equipe',
    'LNG_PAGE_MODIFY_TEAM_NOTIFICATION_ACTION_MODIFY_TEAM_NOTIFICATION_SUCCESS_MESSAGE': 'Notificação modificada com sucesso',

    'LNG_PAGE_NOTIFICATION_SETTINGS_TITLE': 'Configurações de notificações',
    'LNG_PAGE_NOTIFICATION_SETTINGS_DESCRIPTION': 'Configure quantas notificações aparecem no histórico e com que frequência o sistema verifica as notificações recorrentes.',
    'LNG_PAGE_NOTIFICATION_SETTINGS_ACTION_CONFIGURE_BUTTON': 'Configurar',
    'LNG_PAGE_NOTIFICATION_SETTINGS_DIALOG_TITLE': 'Configurar notificações',
    'LNG_PAGE_NOTIFICATION_SETTINGS_DIALOG_EXISTING_CONFIGURATION_INFO': 'Configuração atual',
    'LNG_PAGE_NOTIFICATION_SETTINGS_DIALOG_SUCCESS_MESSAGE': 'Configurações salvas com sucesso',

    'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_HISTORY_COUNT': 'Número de notificações no histórico',
    'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_HISTORY_COUNT_DESCRIPTION': 'Número máximo de notificações exibidas no histórico de cada usuário',
    'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_CHECK_INTERVAL': 'Intervalo de verificação',
    'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_CHECK_INTERVAL_DESCRIPTION': 'Frequência com que o sistema verifica se há notificações recorrentes a enviar',
    'LNG_NOTIFICATION_SETTINGS_FIELD_LABEL_CHECK_INTERVAL_UNIT': 'Unidade do intervalo de verificação',
    'LNG_NOTIFICATION_SETTINGS_CHECK_INTERVAL_UNIT_MINUTES': 'Minutos',
    'LNG_NOTIFICATION_SETTINGS_CHECK_INTERVAL_UNIT_HOURS': 'Horas',
    'LNG_NOTIFICATION_SETTINGS_CHECK_INTERVAL_UNIT_DAYS': 'Dias',

    'LNG_PAGE_CREATE_OUTBREAK_LABEL_NOTIFY_TEAM': 'Notificar equipe',
    'LNG_PAGE_CREATE_OUTBREAK_LABEL_NOTIFY_TEAM_DESCRIPTION': 'Envia uma notificação para a equipe selecionada assim que o surto for criado',
    'LNG_PAGE_CREATE_OUTBREAK_LABEL_NOTIFY_TEAM_ID': 'Equipe a notificar',
    'LNG_PAGE_CREATE_OUTBREAK_LABEL_NOTIFY_TEAM_ID_DESCRIPTION': 'Equipe que vai receber a notificação',
    'LNG_PAGE_CREATE_OUTBREAK_NOTIFY_TEAM_DEFAULT_TITLE': 'Novo surto registrado',

    'LNG_PAGE_CREATE_CASE_TAB_NOTIFY_TEAM': 'Notificar equipe',
    'LNG_PAGE_CREATE_CASE_LABEL_NOTIFY_TEAM': 'Notificar equipe',
    'LNG_PAGE_CREATE_CASE_LABEL_NOTIFY_TEAM_DESCRIPTION': 'Envia uma notificação para a equipe selecionada assim que o caso for criado',
    'LNG_PAGE_CREATE_CASE_LABEL_NOTIFY_TEAM_ID': 'Equipe a notificar',
    'LNG_PAGE_CREATE_CASE_LABEL_NOTIFY_TEAM_ID_DESCRIPTION': 'Equipe que vai receber a notificação',
    'LNG_PAGE_CREATE_CASE_NOTIFY_TEAM_DEFAULT_TITLE': 'Novo caso registrado',

    'LNG_PAGE_CREATE_CONTACT_TAB_NOTIFY_TEAM': 'Notificar equipe',
    'LNG_PAGE_CREATE_CONTACT_LABEL_NOTIFY_TEAM': 'Notificar equipe',
    'LNG_PAGE_CREATE_CONTACT_LABEL_NOTIFY_TEAM_DESCRIPTION': 'Envia uma notificação para a equipe selecionada assim que o contato for criado',
    'LNG_PAGE_CREATE_CONTACT_LABEL_NOTIFY_TEAM_ID': 'Equipe a notificar',
    'LNG_PAGE_CREATE_CONTACT_LABEL_NOTIFY_TEAM_ID_DESCRIPTION': 'Equipe que vai receber a notificação',
    'LNG_PAGE_CREATE_CONTACT_NOTIFY_TEAM_DEFAULT_TITLE': 'Novo contato registrado'
  }
};
