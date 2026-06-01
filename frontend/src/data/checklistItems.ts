export interface ChecklistItemDef {
  key: string;
  label: string;
  question: string;
  okLabel: string;
  issueLabel: string;
}

export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  {
    key: "service_period",
    label: "수공기간",
    question:
      "(민간인) 해당 분야 공적기간이 2년 이상입니까? / (공무원) 현 소속기관(부서) 재직기간이 1년 이상입니까?",
    okLabel: "예 (해당 없음 — 기간 충족)",
    issueLabel: "아니오 (기간 미충족)",
  },
  {
    key: "prior_award",
    label: "기포상",
    question:
      "최근 2년 이내 도의회 의장 이상의 표창을 수여받은 적이 없습니까?",
    okLabel: "예 (해당 없음)",
    issueLabel: "있음",
  },
  {
    key: "discipline",
    label: "징계",
    question:
      "금품·향응 수수, 횡령·배임, 성폭력, 성희롱, 음주운전, 재산등록 의무 위반 등 주요 비위로 징계·불문경고 처분을 받은 적이 없습니까? (사면·말소 포함 추천 불가)",
    okLabel: "예 (해당 없음)",
    issueLabel: "있음",
  },
  {
    key: "investigation",
    label: "수사·기소",
    question:
      "현재 감사조사·수사 중이거나 형사사건으로 기소되어 있지 않습니까?",
    okLabel: "예 (해당 없음)",
    issueLabel: "진행 중",
  },
  {
    key: "criminal",
    label: "형사처분",
    question:
      "업무지침의 형사처분 제외 기준(징역/금고 실형·집행유예·선고유예, 최근 3년간 벌금형 등)에 해당하지 않습니까?",
    okLabel: "예 (해당 없음)",
    issueLabel: "해당 있음",
  },
  {
    key: "arrears",
    label: "체납",
    question:
      "추천일 현재 국세·관세·지방세를 체납하고 있지 않습니까?",
    okLabel: "예 (해당 없음)",
    issueLabel: "체납 중",
  },
  {
    key: "misconduct",
    label: "비위·물의",
    question:
      "공·사생활을 통하여 각종 비위, 부조리 등으로 사회적 물의(민원)를 일으킨 적이 없습니까?",
    okLabel: "예 (해당 없음)",
    issueLabel: "있음",
  },
  {
    key: "award_revoked",
    label: "표창 취소 이력",
    question:
      "경기도의회 의장 표창이 취소된 이력이 없습니까? (귀책 사유로 인한 취소만 해당)",
    okLabel: "예 (해당 없음)",
    issueLabel: "있음",
  },
];
