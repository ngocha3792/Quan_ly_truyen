export interface AnalyticsIdentityPort { hashAuthenticated(userId:string):string; hashAnonymous(anonymousReaderId:string):string; }
export const ANALYTICS_IDENTITY_PORT=Symbol('ANALYTICS_IDENTITY_PORT');
