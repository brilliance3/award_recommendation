import { api } from "./client";
import type {
  CouncilCommittee,
  CouncilMember,
  CouncilMemberRecommender,
} from "../types";

export const councilApi = {
  listCommittees: () =>
    api.get<CouncilCommittee[]>("/api/council/committees").then((r) => r.data),

  listMembers: (params?: { committee?: string; q?: string }) =>
    api
      .get<CouncilMember[]>("/api/council/members", { params })
      .then((r) => r.data),

  getMember: (memberId: string) =>
    api
      .get<CouncilMember>(`/api/council/members/${memberId}`)
      .then((r) => r.data),

  recommenderForMember: (memberId: string) =>
    api
      .get<CouncilMemberRecommender>(
        `/api/council/members/${memberId}/recommender`
      )
      .then((r) => r.data),
};
