import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cancelAdminReview, deleteRecipient, getCase, importXlsx, updateCase, updateRecipient, getManageCredentials, setManageCredentials, type ManageCredentials } from "../api";
import { absoluteUrl } from "../api/client";
import type { AwardCaseDetail } from "../types";
import { Button, Input } from "../components/Field";
import DateInput from "../components/DateInput";
import ShareLinkBox from "../components/ShareLinkBox";

/** 추천관 표시 — full_title이 이미 이름을 포함하면 그대로, 아니면 이름을 덧붙인다(이름 중복 방지). */
function recommenderDisplay(fullTitle?: string, name?: string): string {
  const ft = (fullTitle || "").trim();
  const nm = (name || "").trim();
  if (!nm) return ft;
  if (!ft) return nm;
  return ft.endsWith(nm) ? ft : `${ft} ${nm}`;
}

export default function RecipientListPage() {
  const { caseId = "" } = useParams();
  const [detail, setDetail] = useState<AwardCaseDetail | null>(null);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  // 표창건명 인라인 편집
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // 표창일 일괄 적용(건 단위 → 전체 대상자) 인라인 편집
  const [editingAwardDate, setEditingAwardDate] = useState(false);
  const [awardDateDraft, setAwardDateDraft] = useState("");
  const [savingAwardDate, setSavingAwardDate] = useState(false);

  // 대상자 개인별 표창일 인라인 편집
  const [editRcpDateId, setEditRcpDateId] = useState<string | null>(null);
  const [rcpDateDraft, setRcpDateDraft] = useState("");
  const [savingRcpDate, setSavingRcpDate] = useState(false);

  // 공유 링크 회수/재개
  const [savingShare, setSavingShare] = useState(false);

  // 관리 링크 자격(아이디/비밀번호) — 담당자 조회·재설정 (대표가 잊으면 안내)
  const [manageCred, setManageCred] = useState<ManageCredentials | null>(null);
  const [credUser, setCredUser] = useState("");
  const [credPw, setCredPw] = useState("");
  const [savingCred, setSavingCred] = useState(false);

  const loadManageCred = async () => {
    try {
      const c = await getManageCredentials(caseId);
      setManageCred(c);
      setCredUser(c.username);
      setCredPw(c.password);
    } catch (err: any) {
      alert("자격 조회 실패: " + (err?.response?.data?.detail || err?.message || ""));
    }
  };

  const onSaveCred = async () => {
    if (!credUser.trim() || credPw.length < 4) {
      alert("아이디와 4자 이상 비밀번호를 입력하세요.");
      return;
    }
    setSavingCred(true);
    try {
      const c = await setManageCredentials(caseId, credUser.trim(), credPw);
      setManageCred(c);
      alert("관리 링크 자격을 재설정했습니다. 대표자에게 새 아이디·비밀번호를 알려주세요.");
    } catch (err: any) {
      alert("재설정 실패: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setSavingCred(false);
    }
  };


  const load = () => getCase(caseId).then(setDetail);
  useEffect(() => {
    load();
  }, [caseId]);

  const onToggleShare = async (next: boolean) => {
    setSavingShare(true);
    try {
      await updateCase(caseId, { share_enabled: next });
      await load();
    } catch (err: any) {
      alert(
        "공유 링크 설정 변경 실패: " +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSavingShare(false);
    }
  };

  if (!detail) return <div className="text-ink-500">불러오는 중...</div>;

  const startEditTitle = () => {
    setTitleDraft(detail.title);
    setEditingTitle(true);
  };
  const cancelEditTitle = () => {
    setEditingTitle(false);
    setTitleDraft("");
  };
  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (!t) {
      alert("표창건명을 입력해 주세요.");
      return;
    }
    if (t === detail.title) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await updateCase(caseId, { title: t });
      await load();
      setEditingTitle(false);
    } catch (err: any) {
      alert(
        "건명 저장에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSavingTitle(false);
    }
  };

  const startEditAwardDate = () => {
    setAwardDateDraft(detail.award_date || "");
    setEditingAwardDate(true);
  };
  const cancelEditAwardDate = () => {
    setEditingAwardDate(false);
    setAwardDateDraft("");
  };
  // 표창일 전체 일괄 적용 — 건 대표값 + 모든 대상자 개인 표창일을 동일하게 설정
  const saveAwardDate = async () => {
    setSavingAwardDate(true);
    try {
      const val = awardDateDraft || undefined;
      await updateCase(caseId, { award_date: val });
      await Promise.all(
        (detail.recipients || []).map(r =>
          updateRecipient(r.id, { award_date: val })
        )
      );
      await load();
      setEditingAwardDate(false);
    } catch (err: any) {
      alert(
        "표창일 일괄 적용에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSavingAwardDate(false);
    }
  };

  // 대상자 개인별 표창일 저장
  const startEditRcpDate = (r: { id: string; award_date?: string }) => {
    setEditRcpDateId(r.id);
    // 개인 표창일 미설정이면 건 대표값(폴백)으로 시작 — 실제 출력값과 일치
    setRcpDateDraft(r.award_date || detail.award_date || "");
  };
  const cancelEditRcpDate = () => {
    setEditRcpDateId(null);
    setRcpDateDraft("");
  };
  const saveRcpDate = async (id: string) => {
    setSavingRcpDate(true);
    try {
      await updateRecipient(id, { award_date: rcpDateDraft || undefined });
      await load();
      setEditRcpDateId(null);
    } catch (err: any) {
      alert(
        "표창일 저장에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSavingRcpDate(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("이 대상자와 관련 문서를 삭제합니다. 계속할까요?")) return;
    await deleteRecipient(id);
    load();
  };

  // 검토 완료 표시 해제(미검토로 되돌리기)
  const onCancelReview = async (id: string, name: string) => {
    if (!confirm(`${name} 대상자의 검토 완료를 해제하고 미검토로 되돌립니다. 계속할까요?`))
      return;
    try {
      await cancelAdminReview(id);
      await load();
    } catch (err: any) {
      alert(
        "검토 해제에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    }
  };

  // 문서 생성 진입 — 전원 검토 완료 전이면 팝업 안내 후 차단
  const onGenerateDocs = () => {
    const pending = (detail.recipients || [])
      .filter(r => !r.admin_reviewed)
      .map(r => r.recipient_name);
    if (pending.length > 0) {
      alert(
        "모든 대상자의 ‘검토’를 완료해야 문서를 생성할 수 있습니다.\n\n" +
          `미검토 대상자 (${pending.length}명): ${pending.join(", ")}`
      );
      return;
    }
    navigate(`/cases/${caseId}/download`);
  };

  const onUploadXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await importXlsx(caseId, f);
    load();
    if (fileRef.current) fileRef.current.value = "";
  };

  // 업로드용 빈 서식(XLSX) 다운로드
  const onDownloadTemplate = () => {
    const a = document.createElement("a");
    a.href = absoluteUrl("/api/recipient-xlsx-template");
    a.download = "표창대상자_업로드서식.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-xs text-ink-500 mb-3" aria-label="이동 경로">
        <Link to="/" className="hover:text-brand-700">
          대시보드
        </Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <span className="text-ink-700">{detail.title}</span>
      </nav>

      <div className="krds-page-header">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder="예) 홍길동 의장표창 추천 / 경기복지재단 표창 추천"
                autoFocus
                className="sm:flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveTitle();
                  } else if (e.key === "Escape") {
                    cancelEditTitle();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveTitle}
                  disabled={savingTitle}
                >
                  {savingTitle ? "저장 중..." : "저장"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={cancelEditTitle}
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="krds-page-title break-keep">{detail.title}</h1>
              <Button
                size="sm"
                variant="ghost"
                onClick={startEditTitle}
                title="표창건명 수정"
              >
                ✎ 건명 수정
              </Button>
            </div>
          )}
          <div className="krds-page-sub flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="krds-badge krds-badge-brand">
              {detail.award_grade}
            </span>
            <span>
              {recommenderDisplay(
                detail.recommender_full_title,
                detail.recommender_name
              )}
            </span>
            <span className="text-ink-300">·</span>
            {editingAwardDate ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-36 inline-block">
                  <DateInput
                    value={awardDateDraft}
                    onChange={setAwardDateDraft}
                    autoFocus
                    placeholder="예: 2026.07.25"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveAwardDate();
                      } else if (e.key === "Escape") {
                        cancelEditAwardDate();
                      }
                    }}
                  />
                </span>
                <Button
                  size="sm"
                  onClick={saveAwardDate}
                  disabled={savingAwardDate}
                >
                  {savingAwardDate ? "저장 중..." : "저장"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={cancelEditAwardDate}
                >
                  취소
                </Button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span>
                  표창일 {detail.award_date || "미정"}
                  {(detail.award_date_count || 0) > 1 && (
                    <span className="text-ink-500">
                      {" "}외 {(detail.award_date_count || 1) - 1}일(대상자별)
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={startEditAwardDate}
                  title="표창일 전체 일괄 적용 (대상자 개인별은 아래 표에서 수정)"
                >
                  일괄 ✎
                </Button>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="md" variant="ghost" onClick={onDownloadTemplate}>
            서식 다운로드
          </Button>
          <Button
            size="md"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
          >
            XLSX 업로드
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={onUploadXlsx}
          />
          <Button onClick={() => navigate(`/cases/${caseId}/recipients/new`)}>
            ＋ 대상자 추가
          </Button>
          <Button
            variant="accent"
            onClick={onGenerateDocs}
            title={
              detail.all_reviewed
                ? undefined
                : "모든 대상자의 ‘검토’를 완료해야 문서를 생성할 수 있습니다."
            }
          >
            문서 생성
          </Button>
        </div>
      </div>

      {/* 검토 미완료 안내 — 모든 대상자 검토 후 문서 생성 가능 */}
      {detail.recipients.length > 0 && !detail.all_reviewed && (
        <div className="mb-4 rounded-lg border border-warn-500/40 bg-warn-50 px-4 py-2.5 text-sm text-warn-700">
          ⚠ 아직 검토하지 않은 대상자가 있습니다. <b>모든 대상자의 ‘검토’를 완료</b>해야
          문서를 생성할 수 있습니다.
          {" "}(미검토:{" "}
          {detail.recipients
            .filter(r => !r.admin_reviewed)
            .map(r => r.recipient_name)
            .join(", ")}
          )
        </div>
      )}

      {/* 신청자 정보 (민간인 /apply 신청 건만 표시) */}
      {detail.applicant_name && (
        <div className="krds-card krds-card-pad mb-4 border-ink-200">
          <h2 className="text-sm font-bold text-ink-800 mb-2">
            신청자 정보 (민간인 신청)
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-500 shrink-0 w-20">신청자</dt>
              <dd className="text-ink-800">
                {detail.applicant_name}
                {detail.applicant_role === "organization" && (
                  <span className="ml-1 text-xs text-ink-500">
                    (기관 대표)
                  </span>
                )}
              </dd>
            </div>
            {detail.applicant_organization && (
              <div className="flex gap-2">
                <dt className="text-ink-500 shrink-0 w-20">기관·단체</dt>
                <dd className="text-ink-800">{detail.applicant_organization}</dd>
              </div>
            )}
            {detail.applicant_contact && (
              <div className="flex gap-2">
                <dt className="text-ink-500 shrink-0 w-20">연락처</dt>
                <dd className="text-ink-800">{detail.applicant_contact}</dd>
              </div>
            )}
            {detail.applicant_delivery_address && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-ink-500 shrink-0 w-20">등기수령</dt>
                <dd className="text-ink-800 break-all">
                  {detail.applicant_delivery_address}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* 기관 대표 신청 — 대상자 자가추가 공유 링크 (보기·재복사·회수) */}
      {detail.share_token && (
        <div className="krds-card krds-card-pad mb-4 border-blue-200 bg-blue-50/40">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-ink-800">
              대상자 자가추가 공유 링크
            </h2>
            <span
              className={`text-xs font-semibold ${
                detail.share_enabled ? "text-success-700" : "text-danger-600"
              }`}
            >
              {detail.share_enabled ? "활성" : "회수됨"}
            </span>
          </div>
          <p className="text-xs text-ink-600 mt-1 leading-relaxed">
            이 링크를 추천대상자에게 전달하면 본인 정보를 직접 추가할 수 있습니다.
            {detail.share_expires_at &&
              ` 만료일: ${new Date(detail.share_expires_at).toLocaleDateString("ko-KR")}`}
          </p>
          {detail.share_enabled ? (
            <>
              <ShareLinkBox token={detail.share_token} />
              <div className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={savingShare}
                  onClick={() => {
                    if (
                      confirm(
                        "공유 링크를 회수하면 더 이상 대상자가 추가할 수 없습니다. 진행할까요?"
                      )
                    )
                      onToggleShare(false);
                  }}
                >
                  {savingShare ? "처리 중..." : "링크 회수"}
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={savingShare}
                onClick={() => onToggleShare(true)}
              >
                {savingShare ? "처리 중..." : "링크 다시 활성화"}
              </Button>
            </div>
          )}

          {/* 관리 링크 자격(아이디/비밀번호) — 담당자 조회·재설정 */}
          <div className="mt-4 pt-4 border-t border-blue-200/70">
            {!manageCred ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadManageCred}
              >
                관리 링크 비밀번호(아이디/비밀번호) 보기·관리
              </Button>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-ink-800">
                    관리 링크 비밀번호
                  </h3>
                  <span
                    className={`text-xs font-semibold ${
                      manageCred.protected ? "text-success-700" : "text-ink-500"
                    }`}
                  >
                    {manageCred.protected ? "설정됨" : "미설정(링크만으로 접근)"}
                  </span>
                </div>
                <p className="text-xs text-ink-600 mt-0.5 leading-relaxed">
                  기관 대표자가 잊었을 때 아래 값을 알려주거나, 새로 재설정해 전달하세요.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-ink-700">아이디</span>
                    <Input
                      className="mt-1"
                      value={credUser}
                      onChange={e => setCredUser(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-ink-700">비밀번호</span>
                    <Input
                      className="mt-1 font-mono"
                      value={credPw}
                      onChange={e => setCredPw(e.target.value)}
                      placeholder="4자 이상"
                    />
                  </label>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button type="button" size="sm" onClick={onSaveCred} disabled={savingCred}>
                    {manageCred.protected ? "자격 재설정" : "자격 설정"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 데스크탑/태블릿 — 표 */}
      <div className="hidden md:block krds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="krds-table">
            <thead>
              <tr>
                <th className="w-14 text-center">No</th>
                <th>성명</th>
                <th>생년월일</th>
                <th>소속</th>
                <th>직위</th>
                <th>공적분야</th>
                <th>표창일</th>
                <th className="text-right">조치</th>
              </tr>
            </thead>
            <tbody>
              {detail.recipients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-ink-500 py-8">
                    대상자가 없습니다. 우측 상단에서 추가하거나 XLSX를 업로드하세요.
                  </td>
                </tr>
              ) : (
                detail.recipients.map(r => (
                  <tr key={r.id}>
                    <td className="text-center text-ink-500">
                      {r.sequence_no}
                    </td>
                    <td className="font-semibold">
                      <Link className="krds-link" to={`/recipients/${r.id}`}>
                        {r.recipient_name}
                      </Link>
                    </td>
                    <td>{r.birth_date || "-"}</td>
                    <td>{r.organization_name || "-"}</td>
                    <td>{r.recipient_position_title || "-"}</td>
                    <td>{r.merit_category || "-"}</td>
                    <td className="whitespace-nowrap">
                      {editRcpDateId === r.id ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-28 inline-block">
                            <DateInput
                              value={rcpDateDraft}
                              onChange={setRcpDateDraft}
                              autoFocus
                              placeholder="예: 2026.07.25"
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveRcpDate(r.id);
                                } else if (e.key === "Escape") {
                                  cancelEditRcpDate();
                                }
                              }}
                            />
                          </span>
                          <Button
                            size="sm"
                            onClick={() => saveRcpDate(r.id)}
                            disabled={savingRcpDate}
                          >
                            저장
                          </Button>
                          <Button size="sm" variant="secondary" onClick={cancelEditRcpDate}>
                            취소
                          </Button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span>{r.award_date || detail.award_date || "미정"}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditRcpDate(r)}
                            title="표창일 수정"
                          >
                            ✎
                          </Button>
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            navigate(`/recipients/${r.id}/merit`)
                          }
                        >
                          공적
                        </Button>
                        <Button
                          size="sm"
                          variant={r.admin_reviewed ? "secondary" : "primary"}
                          onClick={() =>
                            navigate(`/recipients/${r.id}/admin-review`)
                          }
                          title={r.admin_reviewed ? "검토 완료 (다시 보기)" : "관리자 검토 필요"}
                        >
                          {r.admin_reviewed ? "✓ 검토완료" : "검토"}
                        </Button>
                        {r.admin_reviewed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onCancelReview(r.id, r.recipient_name)}
                            title="검토 완료 해제(미검토로)"
                          >
                            검토취소
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onDelete(r.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모바일 — 카드 리스트 */}
      <div className="md:hidden space-y-3">
        {detail.recipients.length === 0 ? (
          <div className="krds-card krds-card-pad text-center text-ink-500">
            대상자가 없습니다. 상단 버튼에서 추가하세요.
          </div>
        ) : (
          detail.recipients.map(r => (
            <div key={r.id} className="krds-card krds-card-pad">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={`/recipients/${r.id}`}
                  className="text-base font-bold text-ink-900 hover:text-brand-700"
                >
                  {r.sequence_no}. {r.recipient_name}
                </Link>
                {r.merit_category && (
                  <span className="krds-badge krds-badge-accent">
                    {r.merit_category}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
                <dt className="text-ink-500">생년월일</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.birth_date || "-"}
                </dd>
                <dt className="text-ink-500">소속</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.organization_name || "-"}
                </dd>
                <dt className="text-ink-500">직위</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.recipient_position_title || "-"}
                </dd>
                <dt className="text-ink-500">표창일</dt>
                <dd className="col-span-2 text-ink-800">
                  {editRcpDateId === r.id ? (
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      <span className="w-28 inline-block">
                        <DateInput
                          value={rcpDateDraft}
                          onChange={setRcpDateDraft}
                          autoFocus
                          placeholder="예: 2026.07.25"
                        />
                      </span>
                      <Button size="sm" onClick={() => saveRcpDate(r.id)} disabled={savingRcpDate}>
                        저장
                      </Button>
                      <Button size="sm" variant="secondary" onClick={cancelEditRcpDate}>
                        취소
                      </Button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span>{r.award_date || detail.award_date || "미정"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditRcpDate(r)}
                        title="표창일 수정"
                      >
                        ✎
                      </Button>
                    </span>
                  )}
                </dd>
              </dl>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/recipients/${r.id}/merit`)}
                >
                  공적
                </Button>
                <Button
                  size="sm"
                  variant={r.admin_reviewed ? "secondary" : "primary"}
                  onClick={() => navigate(`/recipients/${r.id}/admin-review`)}
                >
                  {r.admin_reviewed ? "✓ 검토완료" : "검토"}
                </Button>
                {r.admin_reviewed && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCancelReview(r.id, r.recipient_name)}
                  >
                    검토취소
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(r.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
