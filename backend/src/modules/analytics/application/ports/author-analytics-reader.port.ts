export interface AuthorAnalyticsReaderPort {
 overview(userId:string|undefined,from?:string,to?:string):Promise<unknown>;
 stories(userId:string|undefined,input:{from?:string;to?:string;page:number;pageSize:number}):Promise<unknown>;
 story(userId:string|undefined,storyId:string,from?:string,to?:string):Promise<unknown>;
}
export const AUTHOR_ANALYTICS_READER_PORT=Symbol('AUTHOR_ANALYTICS_READER_PORT');
