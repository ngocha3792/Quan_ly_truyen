export class GetSecurityQuestionCatalogQuery {
  constructor(
    readonly userId: string | undefined,

    readonly locale = 'vi',
  ) {}
}

export class GetSecurityQuestionsQuery {
  constructor(readonly userId: string | undefined) {}
}
