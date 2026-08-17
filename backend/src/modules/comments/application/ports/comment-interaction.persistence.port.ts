import type { CommentPageView, CommentReportView, CommentView, ReactionName, ReactionSummaryView, ReportReasonName } from '../dto';
export interface CommentInteractionPersistencePort {
  createReply(input:{userId:string;parentCommentId:string;body:string;ipAddress?:string}):Promise<CommentView>;
  listReplies(rootCommentId:string,page:number,pageSize:number):Promise<CommentPageView>;
  setReaction(input:{userId:string;commentId:string;type:ReactionName;ipAddress?:string}):Promise<ReactionSummaryView>;
  clearReaction(input:{userId:string;commentId:string;ipAddress?:string}):Promise<void>;
  viewerReactions(userId:string,commentIds:readonly string[]):Promise<Record<string, ReactionName | null>>;
  createReport(input:{userId:string;commentId:string;reason:ReportReasonName;description?:string;ipAddress?:string}):Promise<CommentReportView>;
}
export const COMMENT_INTERACTION_PERSISTENCE_PORT = Symbol('COMMENT_INTERACTION_PERSISTENCE_PORT');
