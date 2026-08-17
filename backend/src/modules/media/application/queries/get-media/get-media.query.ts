import type { AuthPrincipal } from '@/common/interfaces/auth'; export class GetMediaQuery { constructor(readonly mediaId:string,readonly principal:AuthPrincipal){} }
